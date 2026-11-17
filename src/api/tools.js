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
