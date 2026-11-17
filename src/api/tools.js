import { Hono } from 'hono'
import { store, requireUser } from '../utils/session.js'

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

/* daftar layanan di-cache di memori Worker 5 menit (dipakai untuk menghitung harga di server, bukan dari kiriman browser) */
let SVC = { t: 0, list: null }
const getServices = async (c) => {
    if (SVC.list && Date.now() - SVC.t < 300000) return { list: SVC.list }
    const { j, res } = await master(c, { action: 'services' }); if (res) return { res }
    if (!Array.isArray(j)) return { res: out(c, 502, 'upstream_bad_response', 'Daftar layanan tidak valid.') }
    SVC = { t: Date.now(), list: j.map((s) => ({ id: String(s.service), name: String(s.name || ''), category: String(s.category || 'Lainnya'), rate: Number(s.rate) || 0, min: Number(s.min) || 1, max: Number(s.max) || 0, refill: !!s.refill })) }
    return { list: SVC.list }
}

/* cocokkan satu deposit dengan panel; kalau lunas, saldo user dikreditkan (sekali) */
const settleDeposit = async (c, id) => {
    const st = store(c), d = await st.smmDepGet(id); if (!d) return null
    if (d.credited) return { status: 'success', amount: d.amount, bonus: 0, balance: await st.smmBal(d.user_id) }
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
    if (c.env.SMM_API_KEY) {   /* deposit yang sudah dibayar tapi halaman keburu ditutup tetap ikut dikreditkan di sini */
        try { for (const d of await st.smmDepPending(uid, Date.now())) await settleDeposit(c, d.id) } catch (e) { console.error('[smm] rekonsiliasi deposit', e.message || e) }
    }
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true, balance: await st.smmBal(uid), currency: 'IDR' })
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

tools.post('/smm/deposit', async (c) => {
    const amount = Number((await body(c)).amount)
    if (!Number.isInteger(amount) || amount < 1000 || amount > 50000000) return out(c, 400, 'bad_amount', 'Nominal deposit minimal Rp1.000 dan maksimal Rp50.000.000.')
    const st = store(c), uid = uidOf(c)
    if ((await st.smmDepPending(uid, Date.now())).length >= 3) return out(c, 429, 'too_many', 'Masih ada 3 deposit yang belum dibayar. Selesaikan atau tunggu kedaluwarsa dulu.')
    const { j, res } = await master(c, { action: 'deposit', amount: String(amount) }); if (res) return res
    if (!j.deposit) return out(c, 502, 'upstream_bad_response', 'Panel tidak mengembalikan ID deposit.')
    const nominal = Number(j.amount) || amount, total = Number(j.total_amount) || nominal
    await st.smmDepNew(String(j.deposit), uid, nominal, total, Date.now())   /* ID deposit ini sekarang tercatat milik user ini */
    return c.json({ ok: true, deposit: String(j.deposit), amount: nominal, total_amount: total, qr_url: https(j.qr_url), payment_url: https(j.payment_url), expired_at: j.expired_at || null, currency: j.currency || 'IDR' })
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
