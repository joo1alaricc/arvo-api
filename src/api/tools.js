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
 * Tiap user memakai API key panel SMM miliknya sendiri (disimpan di server), jadi saldo, pesanan, dan deposit terpisah per user.
 * Semua panggilan ke panel lewat server ini; key tidak pernah dikirim balik ke browser (hanya versi tersamar). */
const SMM = 'https://smm.barz.web.id/api/v2'
const KEY_RE = /^[\w.\-]{6,128}$/
const mask = (k) => (k.length > 9 ? k.slice(0, 4) + '\u2022'.repeat(6) + k.slice(-3) : '\u2022'.repeat(k.length))
const https = (u) => { try { return new URL(u).protocol === 'https:' ? String(u) : null } catch { return null } }

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
/* ambil key user lalu panggil panel; mengembalikan {j} atau {res: Response error} */
const smm = async (c, params) => {
    const key = await store(c).smmKeyGet(c.get('user').id)
    if (!key) return { res: out(c, 400, 'no_key', 'Hubungkan API key SMM dulu.') }
    const r = await smmCall(key, params)
    return r.j === undefined ? { res: out(c, r.status, r.error, r.message) } : { j: r.j }
}

tools.get('/smm/key', async (c) => {
    const k = await store(c).smmKeyGet(c.get('user').id)
    return c.json({ ok: true, linked: !!k, masked: k ? mask(k) : null })
})
tools.put('/smm/key', async (c) => {
    const key = String((await body(c)).key || '').trim()
    if (!KEY_RE.test(key)) return out(c, 400, 'bad_key', 'Format API key tidak valid.')
    const r = await smmCall(key, { action: 'balance' })   /* key diuji dulu; hanya key yang valid yang disimpan */
    if (r.j === undefined) return out(c, r.status === 400 ? 400 : r.status, r.error, r.status === 400 ? 'API key ditolak panel SMM: ' + r.message : r.message)
    await store(c).smmKeySet(c.get('user').id, key)
    return c.json({ ok: true, linked: true, masked: mask(key), balance: Number(r.j.balance) || 0, currency: r.j.currency || 'IDR' })
})
tools.delete('/smm/key', async (c) => { await store(c).smmKeySet(c.get('user').id, null); return c.json({ ok: true, linked: false }) })

tools.get('/smm/balance', async (c) => {
    const { j, res } = await smm(c, { action: 'balance' }); if (res) return res
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true, balance: Number(j.balance) || 0, currency: j.currency || 'IDR' })
})

tools.get('/smm/services', async (c) => {
    const { j, res } = await smm(c, { action: 'services' }); if (res) return res
    if (!Array.isArray(j)) return out(c, 502, 'upstream_bad_response', 'Daftar layanan tidak valid.')
    /* diringkas supaya payload ke browser kecil */
    const list = j.map((s) => ({ id: String(s.service), name: String(s.name || ''), category: String(s.category || 'Lainnya'), rate: Number(s.rate) || 0, min: Number(s.min) || 1, max: Number(s.max) || 0, refill: !!s.refill }))
    c.header('Cache-Control', 'private, max-age=300')
    return c.json({ ok: true, services: list })
})

tools.post('/smm/order', async (c) => {
    const b = await body(c), service = String(b.service || '').trim(), link = String(b.link || '').trim(), q = Number(b.quantity)
    if (!/^\d{1,10}$/.test(service)) return out(c, 400, 'bad_service', 'Layanan tidak valid.')
    let u; try { u = new URL(link) } catch {}
    if (!u || !/^https?:$/.test(u.protocol) || link.length > 500) return out(c, 400, 'bad_link', 'Link target tidak valid (harus diawali http:// atau https://).')
    if (!Number.isInteger(q) || q < 1 || q > 2147483647) return out(c, 400, 'bad_qty', 'Jumlah tidak valid.')
    const { j, res } = await smm(c, { action: 'add', service, link, quantity: String(q) }); if (res) return res
    if (!j.order) return out(c, 502, 'upstream_bad_response', 'Panel tidak mengembalikan ID pesanan.')
    return c.json({ ok: true, order: String(j.order) })
})

tools.get('/smm/status', async (c) => {
    const order = String(c.req.query('order') || '').trim()
    if (!/^\d{1,20}$/.test(order)) return out(c, 400, 'bad_order', 'ID pesanan tidak valid.')
    const { j, res } = await smm(c, { action: 'status', order }); if (res) return res
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true, order, status: String(j.status || '-'), charge: j.charge ?? null, start_count: j.start_count ?? null, remains: j.remains ?? null, currency: j.currency || 'IDR' })
})

tools.post('/smm/deposit', async (c) => {
    const amount = Number((await body(c)).amount)
    if (!Number.isInteger(amount) || amount < 1 || amount > 50000000) return out(c, 400, 'bad_amount', 'Nominal deposit tidak valid.')
    const { j, res } = await smm(c, { action: 'deposit', amount: String(amount) }); if (res) return res
    if (!j.deposit) return out(c, 502, 'upstream_bad_response', 'Panel tidak mengembalikan ID deposit.')
    return c.json({ ok: true, deposit: String(j.deposit), amount: Number(j.amount) || amount, total_amount: Number(j.total_amount) || amount,
        qr_url: https(j.qr_url), payment_url: https(j.payment_url), expired_at: j.expired_at || null, currency: j.currency || 'IDR' })
})

tools.get('/smm/deposit-status', async (c) => {
    const deposit = String(c.req.query('deposit') || '').trim()
    if (!/^[\w\-]{3,80}$/.test(deposit)) return out(c, 400, 'bad_deposit', 'ID deposit tidak valid.')
    const { j, res } = await smm(c, { action: 'deposit_status', deposit }); if (res) return res
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true, deposit, amount: Number(j.amount) || 0, bonus: Number(j.bonus) || 0, status: String(j.status || 'pending').toLowerCase(), credited_at: j.credited_at || null })
})
