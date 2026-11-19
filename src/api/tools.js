import { Hono } from 'hono'
import { store, requireUser } from '../utils/session.js'
import { loadCfg, btzCreate, btzCancel, btzQr, httpsOnly, settleBtzDeposit } from '../utils/btzpay.js'

/* Tools: fitur tambahan khusus member berbayar. Saat ini: Aktivasi AM (/api/tools/am/*).
 * Kunci layanan (CUPZ_API_KEY) hanya ada di server (wrangler secret), tidak pernah dikirim ke browser. */
export const tools = new Hono()

const CUPZ = 'https://alightmotion.cupzstore.web.id/api'
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/
const body = (c) => c.req.json().catch(() => ({}))
const out = (c, status, error, message) => c.json({ ok: false, error, message, status }, status)

tools.use('*', requireUser)

/* Premium 1 ke atas (premium/vip yang masih aktif). Pengelola juga boleh. */
tools.use('/am/*', async (c, next) => {
    const u = c.get('user')
    let ok = !!u.active && (u.role === 'premium' || u.role === 'vip')
    if (!ok) { try { ok = !!(await store(c).adminLevel(u.id)) } catch {} }
    if (!ok) return out(c, 403, 'premium_only', 'Fitur ini khusus pengguna Premium 1 ke atas.')
    await next()
})

const cupz = async (c, path, payload) => {
    const key = c.env.CUPZ_API_KEY
    if (!key) return { err: out(c, 503, 'not_configured', 'Layanan belum dikonfigurasi (CUPZ_API_KEY belum diisi).') }
    let r
    try {
        r = await fetch(CUPZ + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(20000),
        })
    } catch (e) {
        return { err: out(c, 504, 'upstream_unreachable', e.name === 'TimeoutError' ? 'Layanan aktivasi tidak merespons (timeout).' : 'Tidak bisa menghubungi layanan aktivasi.') }
    }
    const j = await r.json().catch(() => null)
    if (!j) return { err: out(c, 502, 'upstream_bad_response', 'Respons layanan aktivasi tidak valid.') }
    if (!r.ok || j.ok !== true) {
        /* 401/403 dari upstream = masalah kunci kita, bukan salah user */
        if (r.status === 401 || r.status === 403) { console.error('[tools/am] upstream menolak kunci', r.status, j.message || j.error); return { err: out(c, 502, 'upstream_auth', 'Layanan aktivasi sedang bermasalah. Hubungi admin.') } }
        return { err: out(c, r.status >= 400 && r.status < 500 ? 400 : 502, 'upstream_error', j.message || j.error || 'Permintaan gagal.') }
    }
    return { j }
}

/* 1) Kirim magic link ke email Alight Motion */
tools.post('/am/generate', async (c) => {
    const email = String((await body(c)).email || '').trim()
    if (!EMAIL_RE.test(email)) return out(c, 400, 'bad_email', 'Email tidak valid.')
    const { j, err } = await cupz(c, '/generate', { email })
    if (err) return err
    return c.json({ ok: true, job_id: j.job_id, message: j.message || 'Permintaan diterima. Periksa email masuk dan folder Spam.' })
})

/* 2) Verifikasi magic link yang diterima di email */
tools.post('/am/verify', async (c) => {
    const b = await body(c), job_id = String(b.job_id || '').trim(), link = String(b.link || '').trim()
    if (!job_id || job_id.length > 200) return out(c, 400, 'bad_job', 'Job ID tidak ada. Kirim magic link dulu.')
    let u; try { u = new URL(link) } catch {}
    if (!u || u.protocol !== 'https:' || link.length > 4000) return out(c, 400, 'bad_link', 'Link verifikasi tidak valid.')
    const { j, err } = await cupz(c, '/generate-verify', { job_id, link })
    if (err) return err
    return c.json({ ok: true, status: j.job?.status || 'completed', message: j.message || 'Verifikasi berhasil. Premium sudah aktif.' })
})

/* ================= Layanan SMM =================
 * Satu API key panel SMM milik Arvo (secret SMM_API_KEY). Saldo tiap user dicatat sendiri di database Arvo (dompet per user):
 *  - deposit dibuat lewat panel, lalu ID deposit dicatat milik user yang membuatnya; saldo user bertambah setelah deposit lunas (sekali saja)
 *  - pesanan: saldo user dipotong dulu, baru dipesan ke panel; gagal = dikembalikan */
const SMM = 'https://smm.barz.web.id/api/v2'
const DONE_BAD = /cancel|fail|error|refund/i

const smmCall = async (key, params) => {
    let r
    try {
        r = await fetch(SMM, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ key, ...params }),
            signal: AbortSignal.timeout(20000),
        })
    } catch (e) { return { status: 504, error: 'upstream_unreachable', message: e.name === 'TimeoutError' ? 'Panel SMM tidak merespons (timeout).' : 'Tidak bisa menghubungi panel SMM.' } }
    const j = await r.json().catch(() => null)
    if (j === null || typeof j !== 'object') return { status: 502, error: 'upstream_bad_response', message: 'Respons panel SMM tidak valid.' }
    if (!Array.isArray(j) && j.error) return { status: 400, error: 'smm_error', message: String(j.error).slice(0, 300) }
    if (!r.ok) return { status: 502, error: 'upstream_error', message: 'Panel SMM sedang bermasalah.' }
    return { j }
}
const noKey = (c) => out(c, 503, 'not_configured', 'Layanan SMM belum dikonfigurasi (SMM_API_KEY belum diisi).')
/* panggil panel dengan key Arvo; mengembalikan {j} atau {res: Response error, r: hasil mentah} */
const master = async (c, params) => {
    const key = c.env.SMM_API_KEY; if (!key) return { res: noKey(c) }
    const r = await smmCall(key, params)
    return r.j === undefined ? { res: out(c, r.status, r.error, r.message), r } : { j: r.j }
}
const https = (u) => { try { return new URL(u).protocol === 'https:' ? String(u) : null } catch { return null } }
const uidOf = (c) => c.get('user').id
/* galat dari BTZPay: admin melihat penyebab aslinya, user biasa pesan umum */
const btzErr = (c, e) => out(c, e.status || 502, e.error || 'btzpay_error', c.get('isOwner') ? `BTZPay: ${e.message}` : 'Pembayaran sedang bermasalah, coba lagi sebentar atau hubungi admin.')

/* daftar layanan di-cache di memori Worker 5 menit (dipakai untuk menghitung harga di server, bukan dari kiriman browser) */
let SVC = { t: 0, list: null }
const getServices = async (c) => {
    if (SVC.list && Date.now() - SVC.t < 300000) return { list: SVC.list }
    const { j, res } = await master(c, { action: 'services' }); if (res) return { res }
    if (!Array.isArray(j)) return { res: out(c, 502, 'upstream_bad_response', 'Daftar layanan tidak valid.') }
    SVC = { t: Date.now(), list: j.map((s) => ({ id: String(s.service), name: String(s.name || ''), category: String(s.category || 'Lainnya'), rate: Number(s.rate) || 0, min: Number(s.min) || 1, max: Number(s.max) || 0, refill: !!s.refill })).sort((a, b) => az(a.category, b.category) || az(a.name, b.name)) }
    return { list: SVC.list }
}

/* cocokkan satu deposit dengan panel; kalau lunas, saldo user dikreditkan (sekali) */
const settleDeposit = async (c, id) => {
    const st = store(c), d = await st.smmDepGet(id); if (!d) return null
    if (d.credited) return { status: 'success', amount: d.amount, bonus: 0, balance: await st.smmBal(d.user_id) }
    if (d.provider === 'btzpay') {
        const r = await settleBtzDeposit(c, d)
        return r.err ? { err: btzErr(c, r.err) } : r
    }
    const { j, res } = await master(c, { action: 'deposit_status', deposit: id }); if (res) return { err: res }
    const status = String(j.status || 'pending').toLowerCase(), bonus = Math.max(0, Math.floor(Number(j.bonus) || 0))
    if (status === 'success') {
        const r = await st.smmDepCredit(id, d.amount + bonus)
        return { status, amount: d.amount, bonus, credited: r.credited, balance: r.balance }
    }
    if (/expire|fail|cancel|reject/.test(status)) await st.smmDepStatus(id, 'expired')
    return { status, amount: d.amount, bonus: 0, balance: await st.smmBal(d.user_id) }
}

tools.get('/smm/balance', async (c) => {
    const st = store(c), uid = uidOf(c)
    /* deposit yang sudah dibayar tapi halaman keburu ditutup tetap ikut dikreditkan di sini */
    try { for (const d of await st.smmDepPending(uid, Date.now())) await settleDeposit(c, d.id) } catch (e) { console.error('[smm] rekonsiliasi deposit', e.message || e) }
    const cfg = await loadCfg(c)
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true, balance: await st.smmBal(uid), currency: 'IDR', deposit_min: cfg.enabled ? cfg.min_amount : 1000, deposit_max: cfg.enabled ? cfg.max_amount : 50000000 })
})

tools.get('/smm/services', async (c) => {
    const { list, res } = await getServices(c); if (res) return res
    c.header('Cache-Control', 'private, max-age=300')
    return c.json({ ok: true, services: list })
})

tools.get('/smm/orders', async (c) => {
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true, orders: await store(c).smmOrders(uidOf(c)) })
})

tools.post('/smm/order', async (c) => {
    const b = await body(c), service = String(b.service || '').trim(), link = String(b.link || '').trim(), q = Number(b.quantity)
    if (!/^\d{1,10}$/.test(service)) return out(c, 400, 'bad_service', 'Layanan tidak valid.')
    let u; try { u = new URL(link) } catch {}
    if (!u || !/^https?:$/.test(u.protocol) || link.length > 500) return out(c, 400, 'bad_link', 'Link target tidak valid (harus diawali http:// atau https://).')
    if (!Number.isInteger(q) || q < 1) return out(c, 400, 'bad_qty', 'Jumlah tidak valid.')
    const key = c.env.SMM_API_KEY; if (!key) return noKey(c)
    const { list, res } = await getServices(c); if (res) return res
    const s = list.find((x) => x.id === service)
    if (!s) return out(c, 400, 'bad_service', 'Layanan tidak ditemukan.')
    if (q < s.min || q > s.max) return out(c, 400, 'bad_qty', `Jumlah harus ${s.min}-${s.max}.`)
    const cost = Math.max(1, Math.ceil((s.rate * q) / 1000)), st = store(c), uid = uidOf(c)

    const rv = await st.smmReserve(uid, cost)   /* saldo dipotong dulu (atomik) */
    if (rv.ok === false) return c.json({ ok: false, error: rv.error, message: rv.message, balance: rv.balance ?? 0, need: cost, status: rv.status }, rv.status)

    const r = await smmCall(key, { action: 'add', service, link, quantity: String(q) })
    if (r.j === undefined || !r.j.order) {
        if (r.status === 504) {   /* hasil tidak pasti: pesanan mungkin sudah masuk, jadi biaya ditahan & dicatat untuk dicek admin */
            await st.smmOrderAdd({ order_id: 'unk_' + crypto.randomUUID().slice(0, 8), uid, service, name: s.name, link, qty: q, cost, status: 'Tidak pasti', now: Date.now() })
            return out(c, 504, 'uncertain', 'Panel tidak merespons, status pesanan tidak pasti. Saldo ditahan, jangan kirim ulang dan hubungi admin.')
        }
        await st.smmAdd(uid, cost)   /* gagal pasti: kembalikan saldo */
        const m = r.message || 'Panel tidak mengembalikan ID pesanan.'
        return out(c, r.status === 400 ? 400 : 502, r.error || 'upstream_bad_response', /saldo|balance|fund/i.test(m) ? 'Layanan sedang tidak bisa memproses pesanan. Hubungi admin.' : m)
    }
    await st.smmOrderAdd({ order_id: String(r.j.order), uid, service, name: s.name, link, qty: q, cost, status: 'Pending', now: Date.now() })
    return c.json({ ok: true, order: String(r.j.order), cost, balance: await st.smmBal(uid) })
})

tools.get('/smm/status', async (c) => {
    const order = String(c.req.query('order') || '').trim()
    if (!/^[\w]{1,20}$/.test(order)) return out(c, 400, 'bad_order', 'ID pesanan tidak valid.')
    const st = store(c), uid = uidOf(c), o = await st.smmOrderGet(order, uid)
    if (!o) return out(c, 404, 'not_found', 'Pesanan tidak ditemukan di akunmu.')
    c.header('Cache-Control', 'no-store')
    if (order.startsWith('unk_')) return c.json({ ok: true, order, status: o.status, cost: o.cost, refunded: 0, balance: await st.smmBal(uid) })
    const { j, res } = await master(c, { action: 'status', order }); if (res) return res
    const status = String(j.status || '-'), remains = Math.max(0, Number(j.remains) || 0)
    const refund = DONE_BAD.test(status) ? o.cost : /partial/i.test(status) && o.qty > 0 ? Math.floor((o.cost * Math.min(remains, o.qty)) / o.qty) : 0
    const r = await st.smmOrderSettle(order, uid, status, refund)
    return c.json({ ok: true, order, status, start_count: j.start_count ?? null, remains: j.remains ?? null, cost: o.cost, refunded: r.refunded || 0, balance: r.balance })
})

/* Deposit lewat BTZPay (aktif kalau admin menyalakannya di Admin > Pembayaran). Saldo dikredit sebesar nominal yang diminta; fee unik dibayar user. */
const btzDeposit = async (c, cfg, amount) => {
    const apikey = c.env.BTZPAY_APIKEY
    if (!apikey || !c.env.BTZPAY_CALLBACK_TOKEN) return out(c, 503, 'not_configured', c.get('isOwner') ? 'BTZPay belum lengkap: isi secret BTZPAY_APIKEY dan BTZPAY_CALLBACK_TOKEN.' : 'Deposit belum bisa dibuat. Hubungi admin.')
    const st = store(c), u = c.get('user'), now = Date.now(), origin = new URL(c.req.url).origin
    const live = (await st.smmDepPending(u.id, now)).filter((r) => !r.expired_at || r.expired_at > now)
    if (live.length >= cfg.max_pending) return out(c, 429, 'too_many', `Masih ada ${live.length} deposit yang belum dibayar. Selesaikan atau tunggu kedaluwarsa dulu.`)
    const r = await btzCreate(c.env, apikey, {
        amount, fee: cfg.fee, paymentMethod: cfg.payment_method, timeout: cfg.timeout_min * 60000,
        callback_url: `${origin}/callback?t=${encodeURIComponent(c.env.BTZPAY_CALLBACK_TOKEN)}`,
        return_url: cfg.return_url || `${origin}/smm`,
        notes: `Deposit saldo Arvo (${u.username})`.slice(0, 200),
        metadata: { orderId: `dep-${u.id}-${now}`, productName: 'Deposit Saldo Arvo' },
    })
    if (!r.ok) { console.error('[btzpay] create', r.message); return btzErr(c, r) }
    const t = r.data || {}
    if (!t.transactionId || !t.accessKey) return out(c, 502, 'upstream_bad_response', 'BTZPay tidak mengembalikan ID transaksi.')
    const total = Number(t.totalAmount) || amount, exp = Date.parse(t.expiredAt || '') || now + cfg.timeout_min * 60000
    await st.smmDepNew(String(t.transactionId), u.id, amount, total, now, { provider: 'btzpay', access_key: String(t.accessKey), pay_url: httpsOnly(t.paymentUrl), expired_at: exp, fee: Number(t.fee) || 0, qr_data: t.qrisString || null })
    return c.json({ ok: true, deposit: String(t.transactionId), amount, total_amount: total, qr_url: t.qrisString ? `/api/tools/smm/deposit-qr?deposit=${encodeURIComponent(t.transactionId)}` : /^data:image\//.test(t.qrisImage || '') ? t.qrisImage : null, payment_url: httpsOnly(t.paymentUrl), expired_at: new Date(exp).toISOString(), currency: 'IDR', provider: 'btzpay' })
}

/* gambar QR deposit milik user ini (diteruskan dari BTZPay lewat server Arvo) */
tools.get('/smm/deposit-qr', async (c) => {
    const id = String(c.req.query('deposit') || '').trim()
    if (!/^[\w\-]{3,80}$/.test(id)) return out(c, 400, 'bad_deposit', 'ID deposit tidak valid.')
    const d = await store(c).smmDepGet(id)
    if (!d || d.user_id !== uidOf(c) || !d.qr_data) return out(c, 404, 'not_found', 'QR tidak ditemukan.')
    const q = await btzQr(c.env, d.qr_data)
    if (!q) return out(c, 502, 'qr_failed', 'QR gagal dibuat.')
    return c.body(q.body, 200, { 'Content-Type': q.type, 'Cache-Control': 'private, max-age=600' })
})

tools.post('/smm/deposit', async (c) => {
    const amount = Number((await body(c)).amount)
    const cfg = await loadCfg(c)
    const [lo, hi] = cfg.enabled ? [cfg.min_amount, cfg.max_amount] : [1000, 50000000]
    if (!Number.isInteger(amount) || amount < lo || amount > hi) return out(c, 400, 'bad_amount', `Nominal deposit minimal Rp${lo.toLocaleString('id-ID')} dan maksimal Rp${hi.toLocaleString('id-ID')}.`)
    if (cfg.enabled) return btzDeposit(c, cfg, amount)
    const st = store(c), uid = uidOf(c)
    if ((await st.smmDepPending(uid, Date.now())).length >= 3) return out(c, 429, 'too_many', 'Masih ada 3 deposit yang belum dibayar. Selesaikan atau tunggu kedaluwarsa dulu.')
    const { j, res } = await master(c, { action: 'deposit', amount: String(amount) }); if (res) return res
    if (!j.deposit) return out(c, 502, 'upstream_bad_response', 'Panel tidak mengembalikan ID deposit.')
    const nominal = Number(j.amount) || amount, total = Number(j.total_amount) || nominal
    await st.smmDepNew(String(j.deposit), uid, nominal, total, Date.now())   /* ID deposit ini sekarang tercatat milik user ini */
    return c.json({ ok: true, deposit: String(j.deposit), amount: nominal, total_amount: total, qr_url: https(j.qr_url), payment_url: https(j.payment_url), expired_at: j.expired_at || null, currency: j.currency || 'IDR' })
})

/* batalkan / tutup deposit yang belum dibayar. Kalau ternyata sudah dibayar, saldo dikreditkan dan deposit TIDAK dibatalkan. */
tools.post('/smm/deposit-cancel', async (c) => {
    const id = String((await body(c)).deposit || '').trim()
    if (!/^[\w\-]{3,80}$/.test(id)) return out(c, 400, 'bad_deposit', 'ID deposit tidak valid.')
    const st = store(c), uid = uidOf(c), d = await st.smmDepGet(id)
    if (!d || d.user_id !== uid) return out(c, 404, 'not_found', 'Deposit tidak ditemukan di akunmu.')
    if (d.credited) return c.json({ ok: true, paid: true, status: 'success', amount: d.amount, bonus: 0, balance: await st.smmBal(uid) })
    if (d.provider === 'btzpay' || c.env.SMM_API_KEY) {
        const r = await settleDeposit(c, id)
        if (r && r.err) return r.err
        if (r && r.status === 'success') return c.json({ ok: true, paid: true, ...r })
    }
    if (d.provider === 'btzpay' && c.env.BTZPAY_APIKEY) { const k = await btzCancel(c.env, c.env.BTZPAY_APIKEY, id); if (!k.ok) console.error('[btzpay] cancel', k.message) }
    await st.smmDepStatus(id, 'canceled')
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true, canceled: true, balance: await st.smmBal(uid) })
})

tools.get('/smm/deposit-status', async (c) => {
    const id = String(c.req.query('deposit') || '').trim()
    if (!/^[\w\-]{3,80}$/.test(id)) return out(c, 400, 'bad_deposit', 'ID deposit tidak valid.')
    const d = await store(c).smmDepGet(id)
    if (!d || d.user_id !== uidOf(c)) return out(c, 404, 'not_found', 'Deposit tidak ditemukan di akunmu.')
    const r = await settleDeposit(c, id)
    if (r.err) return r.err
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true, deposit: id, ...r })
})

/* ================= Layanan OTP (SMSCode) =================
 * Satu API token SMSCode milik Arvo (secret SMSCODE_API_KEY), memakai API v1 (semua nominal sudah rupiah bulat).
 * Saldo memakai dompet yang sama dengan Layanan SMM (isi saldo lewat deposit di halaman SMM).
 *  - pesan: saldo user dipotong dulu, baru order ke SMSCode; gagal = dikembalikan
 *  - batal / kedaluwarsa tanpa SMS: saldo dikembalikan SEKALI (dijaga kolom refunded di database)
 * Operator selalu "Any" (tanpa operator_id). Harga jual = harga SMSCode + markup (OTP_MARKUP_PCT persen + OTP_MARKUP_FLAT rupiah, opsional). */
const SC = 'https://api.smscode.gg/v1'
const OTP_MAX_QTY = 3
const OTP_LIVE = new Set(['ACTIVE', 'OTP_RECEIVED'])
const intStr = (v) => /^\d{1,12}$/.test(String(v ?? '').trim())
const markup = (c, n) => Math.max(1, Math.ceil(Number(n) * (1 + (Number(c.env.OTP_MARKUP_PCT) || 0) / 100) + (Number(c.env.OTP_MARKUP_FLAT) || 0)))

/* panggil SMSCode. Mengembalikan { j } (isi "data") atau { status, error, message, uncertain }.
 * uncertain = hasil tidak pasti (timeout / 5xx): untuk order uang, jangan anggap gagal. */
const scCall = async (c, method, path, { query, body, idem } = {}) => {
    const key = c.env.SMSCODE_API_KEY
    if (!key) return { status: 503, error: 'not_configured', message: 'Layanan OTP belum dikonfigurasi (SMSCODE_API_KEY belum diisi).' }
    const headers = { Authorization: 'Bearer ' + key }
    if (body) headers['Content-Type'] = 'application/json'
    if (idem) headers['Idempotency-Key'] = idem
    let r
    try {
        r = await fetch(SC + path + (query ? '?' + new URLSearchParams(query) : ''), { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) })
    } catch (e) { return { status: 504, error: 'upstream_unreachable', uncertain: true, message: e.name === 'TimeoutError' ? 'Penyedia OTP tidak merespons (timeout).' : 'Tidak bisa menghubungi penyedia OTP.' } }
    const j = await r.json().catch(() => null)
    if (!j || typeof j !== 'object') return { status: 502, error: 'upstream_bad_response', uncertain: r.status >= 500, message: 'Respons penyedia OTP tidak valid.' }
    if (r.ok && j.success === true) return { j: j.data, meta: j.meta }
    const code = String(j.error?.code || ''), msg = String(j.error?.message || '').slice(0, 300)
    if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN' || code === 'INSUFFICIENT_BALANCE' || code === 'SERVICE_UNAVAILABLE') {   /* masalah akun/kunci kita, bukan salah user */
        console.error('[otp] upstream', r.status, code, msg)
        return { status: 502, error: 'upstream_' + code.toLowerCase(), message: code === 'SERVICE_UNAVAILABLE' ? 'Penyedia OTP sedang maintenance. Coba lagi nanti.' : 'Layanan OTP sedang bermasalah. Hubungi admin.' }
    }
    if (code === 'NO_OFFER_AVAILABLE' || code === 'PROVIDER_ERROR') return { status: 409, error: 'no_stock', message: 'Nomor sedang kosong di server ini. Coba server lain.' }
    if (code === 'CANCEL_TOO_EARLY') return { status: 409, error: 'too_early', message: 'Pembatalan baru bisa dilakukan 2 menit setelah order.' }
    if (code === 'RATE_LIMIT_EXCEEDED') return { status: 429, error: 'rate_limited', message: 'Terlalu banyak permintaan, coba lagi sebentar.' }
    if (code === 'NOT_FOUND') return { status: 404, error: 'not_found', message: 'Pesanan tidak ditemukan di penyedia OTP.' }
    if (code === 'REQUEST_IN_PROGRESS') return { status: 409, error: 'in_progress', message: 'Permintaan sebelumnya masih diproses. Tunggu sebentar.' }
    if (r.status >= 500) return { status: 502, error: 'upstream_error', uncertain: true, message: 'Penyedia OTP sedang bermasalah.' }
    return { status: r.status === 409 ? 409 : 400, error: 'otp_error', message: msg || 'Permintaan ditolak penyedia OTP.' }
}
const scOut = (c, r) => out(c, r.status, r.error, r.message)

/* pembanding A-Z (tidak peka huruf besar/kecil, angka diurutkan sebagai angka) */
const az = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' })

/* daftar negara & layanan jarang berubah: simpan di memori Worker */
let OC = { t: 0, list: null }
const getCountries = async (c) => {
    if (OC.list && Date.now() - OC.t < 3600000) return { list: OC.list }
    const r = await scCall(c, 'GET', '/catalog/countries'); if (r.j === undefined) return { res: scOut(c, r) }
    if (!Array.isArray(r.j)) return { res: out(c, 502, 'upstream_bad_response', 'Daftar negara tidak valid.') }
    OC = { t: Date.now(), list: r.j.filter((x) => x.active !== false).map((x) => ({ id: Number(x.id), code: String(x.code || ''), name: String(x.name || ''), dial: String(x.dial_code || ''), emoji: String(x.emoji || '') })).sort((a, b) => az(a.name, b.name)) }
    return { list: OC.list }
}
const OS = new Map()
const getServicesOtp = async (c, country) => {
    const hit = OS.get(country)
    if (hit && Date.now() - hit.t < 600000) return { list: hit.list }
    const r = await scCall(c, 'GET', '/catalog/services', { query: { country_id: String(country) } }); if (r.j === undefined) return { res: scOut(c, r) }
    if (!Array.isArray(r.j)) return { res: out(c, 502, 'upstream_bad_response', 'Daftar layanan tidak valid.') }
    const list = r.j.filter((x) => x.active !== false).map((x) => ({ id: Number(x.id), code: String(x.code || ''), name: String(x.name || '') })).sort((a, b) => az(a.name, b.name))
    if (OS.size > 300) OS.clear()
    OS.set(country, { t: Date.now(), list })
    return { list }
}
/* server = produk "Any operator", diurutkan termurah (Server 1 = termurah). Harga SELALU dihitung ulang di server. */
const getServers = async (c, country, platform) => {
    const r = await scCall(c, 'GET', '/catalog/products', { query: { country_id: String(country), platform_id: String(platform), sort: 'price_asc', limit: '1000', page: '1' } })
    if (r.j === undefined) return { res: scOut(c, r) }
    if (!Array.isArray(r.j)) return { res: out(c, 502, 'upstream_bad_response', 'Daftar server tidak valid.') }
    const list = r.j.filter((p) => p.active !== false && Number(p.available) > 0 && Number(p.price) > 0 && p.operator_id == null)
        .map((p, i) => ({ id: Number(p.id), server: i + 1, available: Number(p.available), price: markup(c, p.price) }))
    return { list }
}

/* baris database -> bentuk untuk browser (tanpa data internal) */
const otpView = (o, extra) => {
    const live = OTP_LIVE.has(o.status)
    return {
        order_id: o.order_id, country: o.country, dial: o.dial, service: o.service, svc_code: o.svc_code, server_no: o.server_no, phone: o.phone,
        cost: o.cost, status: o.status, otp_code: o.otp_code, otp_message: o.otp_message, refunded: !!o.refunded, expires_at: o.expires_at, created_at: o.created_at,
        can_cancel: o.status === 'ACTIVE', can_resend: live, can_finish: o.status === 'OTP_RECEIVED', can_reactivate: false,
        cancel_available_at: o.status === 'ACTIVE' ? o.created_at + 120000 : null, ...extra,
    }
}
const ms = (t) => { const n = Date.parse(t || ''); return Number.isFinite(n) ? n : null }

/* sinkronkan satu pesanan dengan penyedia; batal/kedaluwarsa tanpa SMS = saldo kembali (sekali) */
const otpRefresh = async (c, uid, o) => {
    const r = await scCall(c, 'GET', '/orders/' + o.order_id); if (r.j === undefined) return { r }
    const u = r.j, st = store(c), status = String(u.status || o.status).toUpperCase()
    await st.otpSave(o.order_id, uid, { status, otp_code: u.otp_code || o.otp_code, otp_message: u.otp_message || o.otp_message, expires_at: ms(u.expires_at) })
    let rf = 0
    if ((status === 'CANCELED' || status === 'EXPIRED') && !o.refunded) rf = (await st.otpRefund(o.order_id, uid, status)).refunded || 0
    const fresh = await st.otpGet(o.order_id, uid), live = OTP_LIVE.has(status)
    return {
        view: otpView(fresh, {
            can_cancel: u.can_cancel ?? status === 'ACTIVE', can_resend: u.can_resend ?? live, can_finish: u.can_finish ?? status === 'OTP_RECEIVED', can_reactivate: !!u.can_reactivate,
            cancel_available_at: status === 'ACTIVE' ? ms(u.cancel_available_at) || (ms(u.created_at) || o.created_at) + 120000 : null,
            resend_available_at: ms(u.resend_available_at), refunded_now: rf,
        }), balance: await st.smmBal(uid),
    }
}
const myOtp = async (c) => {
    const order = String(c.req.query('order') || (await body(c)).order || '').trim()
    if (!intStr(order)) return { res: out(c, 400, 'bad_order', 'ID pesanan tidak valid.') }
    const o = await store(c).otpGet(order, uidOf(c))
    return o ? { o } : { res: out(c, 404, 'not_found', 'Pesanan tidak ditemukan di akunmu.') }
}
const idemKey = () => 'arvo-' + crypto.randomUUID()
/* order uang: kalau hasil tidak pasti, coba SEKALI lagi dengan Idempotency-Key yang sama (aman, tidak menggandakan pesanan) */
const scCreate = async (c, path, payload) => {
    const idem = idemKey()
    let r = await scCall(c, 'POST', path, { body: payload, idem })
    if (r.j === undefined && r.uncertain) r = await scCall(c, 'POST', path, { body: payload, idem })
    return r
}

tools.get('/otp/countries', async (c) => {
    const { list, res } = await getCountries(c); if (res) return res
    c.header('Cache-Control', 'private, max-age=600')
    return c.json({ ok: true, countries: list })
})

tools.get('/otp/services', async (c) => {
    const country = c.req.query('country_id'); if (!intStr(country)) return out(c, 400, 'bad_country', 'Negara tidak valid.')
    const { list, res } = await getServicesOtp(c, Number(country)); if (res) return res
    c.header('Cache-Control', 'private, max-age=300')
    return c.json({ ok: true, services: list })
})

tools.get('/otp/servers', async (c) => {
    const country = c.req.query('country_id'), platform = c.req.query('platform_id')
    if (!intStr(country) || !intStr(platform)) return out(c, 400, 'bad_request', 'Negara atau layanan tidak valid.')
    const { list, res } = await getServers(c, Number(country), Number(platform)); if (res) return res
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true, servers: list.slice(0, 60) })
})

tools.post('/otp/order', async (c) => {
    const b = await body(c), country = Number(b.country_id), platform = Number(b.platform_id), product = Number(b.product_id), q = Number(b.quantity || 1)
    if (![country, platform, product].every((n) => Number.isInteger(n) && n > 0)) return out(c, 400, 'bad_request', 'Pilihan tidak valid.')
    if (!Number.isInteger(q) || q < 1 || q > OTP_MAX_QTY) return out(c, 400, 'bad_qty', `Jumlah nomor 1-${OTP_MAX_QTY}.`)
    if (!c.env.SMSCODE_API_KEY) return out(c, 503, 'not_configured', 'Layanan OTP belum dikonfigurasi (SMSCODE_API_KEY belum diisi).')
    const [cs, ss, sv] = await Promise.all([getCountries(c), getServicesOtp(c, country), getServers(c, country, platform)])
    if (cs.res) return cs.res; if (ss.res) return ss.res; if (sv.res) return sv.res
    const ct = cs.list.find((x) => x.id === country), svc = ss.list.find((x) => x.id === platform), p = sv.list.find((x) => x.id === product)
    if (!ct || !svc) return out(c, 400, 'bad_request', 'Negara atau layanan tidak ditemukan.')
    if (!p) return out(c, 409, 'no_stock', 'Server ini sudah tidak tersedia. Pilih server lain.')
    if (p.available < q) return out(c, 409, 'no_stock', `Stok server ini tinggal ${p.available} nomor.`)
    const unit = p.price, cost = unit * q, st = store(c), uid = uidOf(c)

    const rv = await st.smmReserve(uid, cost)   /* saldo dipotong dulu (atomik) */
    if (rv.ok === false) return c.json({ ok: false, error: rv.error, message: rv.message, balance: rv.balance ?? 0, need: cost, status: rv.status }, rv.status)

    const r = await scCreate(c, '/orders/create', { product_id: product, quantity: q })
    if (r.j === undefined) {
        if (r.uncertain) return out(c, 504, 'uncertain', 'Penyedia OTP tidak merespons, status pesanan tidak pasti. Saldo ditahan, jangan kirim ulang dan hubungi admin.')
        await st.smmAdd(uid, cost)   /* gagal pasti: kembalikan saldo */
        return scOut(c, r)
    }
    const made = Array.isArray(r.j.orders) ? r.j.orders.filter((x) => x && x.id) : []
    const now = Date.now()
    for (const x of made) {
        await st.otpAdd({ order_id: String(x.id), uid, country: ct.name, dial: ct.dial, service: svc.name, svc_code: svc.code, server_no: p.server, product_id: product, phone: String(x.phone_number || ''),
            cost: unit, status: String(x.status || 'ACTIVE').toUpperCase(), expires_at: ms(x.expires_at), now })
    }
    const back = (q - made.length) * unit   /* nomor yang gagal dibuat dikembalikan */
    if (back > 0) await st.smmAdd(uid, back)
    if (!made.length) return out(c, 409, 'no_stock', 'Nomor sedang kosong di server ini. Saldo dikembalikan, coba server lain.')
    const rows = (await st.otpList(uid)).filter((o) => made.some((x) => String(x.id) === o.order_id))
    return c.json({ ok: true, orders: rows.map((o) => otpView(o)), refunded: back, balance: await st.smmBal(uid) })
})

tools.get('/otp/orders', async (c) => {
    const st = store(c), uid = uidOf(c)
    let rows = await st.otpList(uid)
    /* pesanan yang masih berjalan disinkronkan dulu, supaya yang kedaluwarsa otomatis mengembalikan saldo walau halaman sempat ditutup */
    const live = rows.filter((o) => OTP_LIVE.has(o.status)).slice(0, 5)
    if (live.length && c.env.SMSCODE_API_KEY) {
        const rs = await Promise.allSettled(live.map((o) => otpRefresh(c, uid, o)))
        const fresh = new Map(rs.filter((x) => x.status === 'fulfilled' && x.value.view).map((x) => [x.value.view.order_id, x.value.view]))
        rows = (await st.otpList(uid)).map((o) => fresh.get(o.order_id) || otpView(o))
    } else rows = rows.map((o) => otpView(o))
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true, orders: rows, balance: await st.smmBal(uid) })
})

tools.get('/otp/status', async (c) => {
    const { o, res } = await myOtp(c); if (res) return res
    c.header('Cache-Control', 'no-store')
    if (!OTP_LIVE.has(o.status)) return c.json({ ok: true, order: otpView(o), balance: await store(c).smmBal(uidOf(c)) })
    const x = await otpRefresh(c, uidOf(c), o)
    if (!x.view) return scOut(c, x.r)
    return c.json({ ok: true, order: x.view, balance: x.balance })
})

tools.post('/otp/cancel', async (c) => {
    const { o, res } = await myOtp(c); if (res) return res
    const st = store(c), uid = uidOf(c)
    if (o.refunded) return c.json({ ok: true, status: o.status, refunded: 0, balance: await st.smmBal(uid) })
    const r = await scCall(c, 'POST', '/orders/cancel', { body: { id: Number(o.order_id) } })
    if (r.j === undefined) {
        if (r.error === 'otp_error' || r.error === 'not_found') { try { await otpRefresh(c, uid, o) } catch {} }   /* mungkin sudah batal/kedaluwarsa: sinkronkan (dan refund bila perlu) */
        return scOut(c, r)
    }
    const rf = await st.otpRefund(o.order_id, uid, 'CANCELED')   /* refund hanya SETELAH penyedia mengonfirmasi pembatalan */
    return c.json({ ok: true, status: 'CANCELED', refunded: rf.refunded || 0, balance: rf.balance })
})

tools.post('/otp/finish', async (c) => {
    const { o, res } = await myOtp(c); if (res) return res
    const r = await scCall(c, 'POST', '/orders/finish', { body: { id: Number(o.order_id) } })
    if (r.j === undefined) return scOut(c, r)
    await store(c).otpSave(o.order_id, uidOf(c), { status: 'COMPLETED', otp_code: o.otp_code, otp_message: o.otp_message })
    return c.json({ ok: true, status: 'COMPLETED' })
})

tools.post('/otp/resend', async (c) => {
    const { o, res } = await myOtp(c); if (res) return res
    const r = await scCall(c, 'POST', '/orders/resend', { body: { id: Number(o.order_id) } })
    if (r.j === undefined) return scOut(c, r)
    return c.json({ ok: true, resent: r.j.resent !== false, message: r.j.resent === false ? 'Layanan ini tidak mendukung kirim ulang.' : 'Permintaan kirim ulang OTP dikirim.' })
})

/* pakai lagi nomor yang sama untuk kode berikutnya; biaya = harga reaktivasi saat ini + markup, dipotong dulu seperti order biasa */
tools.post('/otp/reactivate', async (c) => {
    const { o, res } = await myOtp(c); if (res) return res
    if (o.status !== 'COMPLETED') return out(c, 409, 'bad_status', 'Hanya pesanan yang sudah selesai yang bisa diaktifkan ulang.')
    const opt = await scCall(c, 'GET', `/orders/${o.order_id}/reactivate-options`); if (opt.j === undefined) return scOut(c, opt)
    const base = Number(opt.j.cost); if (!(base > 0)) return out(c, 409, 'not_available', 'Nomor ini tidak bisa diaktifkan ulang.')
    const cost = markup(c, base), st = store(c), uid = uidOf(c)
    const rv = await st.smmReserve(uid, cost)
    if (rv.ok === false) return c.json({ ok: false, error: rv.error, message: rv.message, balance: rv.balance ?? 0, need: cost, status: rv.status }, rv.status)
    const r = await scCreate(c, '/orders/reactivate', { id: Number(o.order_id), max_price: Math.ceil(base) })
    if (r.j === undefined) {
        if (r.uncertain) return out(c, 504, 'uncertain', 'Penyedia OTP tidak merespons, status tidak pasti. Saldo ditahan, jangan kirim ulang dan hubungi admin.')
        await st.smmAdd(uid, cost); return scOut(c, r)
    }
    const x = Array.isArray(r.j.orders) ? r.j.orders.find((y) => y && y.id) : null
    if (!x) { await st.smmAdd(uid, cost); return out(c, 409, 'not_available', 'Nomor ini tidak bisa diaktifkan ulang. Saldo dikembalikan.') }
    await st.otpAdd({ order_id: String(x.id), uid, country: o.country, dial: o.dial, service: o.service, svc_code: o.svc_code, server_no: o.server_no, product_id: o.product_id,
        phone: String(x.phone_number || o.phone), cost, status: String(x.status || 'ACTIVE').toUpperCase(), expires_at: ms(x.expires_at), now: Date.now() })
    return c.json({ ok: true, order: otpView(await st.otpGet(String(x.id), uid)), balance: await st.smmBal(uid) })
})
