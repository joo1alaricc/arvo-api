import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { store, send, fail, hashPw, sameHash, startSession, endSession, requireUser } from '../utils/session.js'
export const auth = new Hono()
const body = (c) => c.req.json().catch(() => ({}))
const USER_RE = /^[A-Za-z0-9_]{3,20}$/
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/
const PW_MSG = fail(400, 'bad_password', 'Password minimal 8 karakter.')
const PW_LONG = fail(400, 'bad_password', 'Password maksimal 200 karakter.')
/* Batasi percobaan per IP supaya tebak-password / tebak-access-key tidak bisa dipakai brute force. IP owner dikecualikan. */
const limited = async (c, scope, max, windowMs, extra = '') => {
    if (c.get('isOwner')) return null
    const r = await store(c).throttle(`${scope}:${c.get('ip')}${extra}`, max, windowMs, Date.now())
    return r.ok === false ? send(c, r) : null
}

/* Cloudflare Turnstile (opsional): aktif otomatis bila TURNSTILE_SECRET diisi (wrangler secret put) DAN TURNSTILE_SITE_KEY ada di [vars].
 * Mencegah bot mengisi form login/daftar/admin. Kalau gagal menghubungi Cloudflare, request ditolak (fail-closed). IP owner dikecualikan. */
const human = async (c, token) => {
    if (!c.env.TURNSTILE_SECRET || !c.env.TURNSTILE_SITE_KEY || c.get('isOwner')) return null
    try {
        const fd = new FormData()
        fd.append('secret', c.env.TURNSTILE_SECRET); fd.append('response', String(token || '').slice(0, 2048)); fd.append('remoteip', c.get('ip') || '')
        const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: fd, signal: AbortSignal.timeout(5000) })
        if ((await r.json().catch(() => ({}))).success === true) return null
    } catch (e) { console.error('[Turnstile]', e?.message || e) }
    return send(c, fail(400, 'captcha_failed', 'Verifikasi keamanan gagal. Selesaikan verifikasi lalu coba lagi.'))
}

auth.get('/config', (c) => c.json({
    turnstile_site_key: c.env.TURNSTILE_SECRET && c.env.TURNSTILE_SITE_KEY ? c.env.TURNSTILE_SITE_KEY : null,
    google_client_id: c.env.GOOGLE_CLIENT_ID || null,
    google_callback: new URL('/api/auth/google/callback', c.req.url).href,
    hero_video: c.env.HERO_VIDEO || null,
    hero_poster: c.env.HERO_POSTER || null,
}))

/* Daftar = email + password. Username dibuat otomatis dari email (bisa diganti di Profil). */
auth.post('/register', async (c) => {
    const b = await body(c), email = String(b.email || b.username || '').trim().toLowerCase(), pw = String(b.password ?? '')
    const lim = (await limited(c, 'reg', 8, 3600e3)) || (await human(c, b.cf_token)); if (lim) return lim
    if (!EMAIL_RE.test(email) || email.length > 254) return send(c, fail(400, 'bad_email', 'Masukkan email yang valid.'))
    if (pw.length < 8) return send(c, PW_MSG)
    if (pw.length > 200) return send(c, PW_LONG)
    const { salt, hash } = await hashPw(pw)
    const r = await store(c).register({ email, hash, salt, now: Date.now(), ip: c.get('ip') })
    if (r.ok) await startSession(c, r.id)
    return send(c, r)
})

/* Login: kolom username boleh berisi username ATAU email (email terverifikasi Google / email akun).
 * Pengelola masuk lewat POST /admin-login (email + access key, tanpa password). */
auth.post('/login', async (c) => {
    const b = await body(c), ident = String(b.username || b.email || '').trim().slice(0, 254), pw = String(b.password ?? '').slice(0, 200)
    const bad = fail(401, 'invalid_login', 'Email/username atau password salah.')
    if (!ident || !pw) return send(c, bad)
    const lim = (await limited(c, 'login', 20, 600e3)) || (await limited(c, 'loginid', 10, 600e3, ':' + ident.toLowerCase())) || (await human(c, b.cf_token)); if (lim) return lim
    const cands = ident.includes('@') ? await store(c).authByEmail(ident) : [await store(c).authInfo({ username: ident })]
    let hit = null
    for (const info of cands) {
        if (!info || info.ok === false || !info.hash) continue
        const { hash } = await hashPw(pw, info.salt)
        if (sameHash(hash, info.hash)) { hit = info; break }
    }
    if (!hit) return send(c, bad)
    await store(c).loginOk(hit.id, c.get('ip'), Date.now())
    await startSession(c, hit.id)
    return c.json({ ok: true })
})

/* Login sebagai Pengelola: email + Access Key, tanpa password. Sesinya sama seperti user biasa; panel admin hanya bisa dibuka dengan sesi ini. */
auth.post('/admin-login', async (c) => {
    const b = await body(c)
    const lim = (await limited(c, 'admin', 8, 600e3)) || (await human(c, b.cf_token)); if (lim) return lim
    const r = await store(c).adminKeyLogin(b.email, b.access_key, c.get('ip'), Date.now())
    if (r.ok === false) return send(c, r)
    await startSession(c, r.id)
    return c.json({ ok: true, level: r.level })
})

/* Login Google (Google Identity Services).
 *  - POST /google           : popup/One Tap, kirim {credential} sebagai JSON
 *  - POST /google/callback  : mode redirect (dipakai halaman login). Google mengirim form {credential, g_csrf_token}
 *    ke halaman kita, jadi tidak ada popup dan tidak terblokir COOP / pemblokir popup. */
const googleToken = async (c, credential) => {
    if (!c.env.GOOGLE_CLIENT_ID || !credential) return null
    const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential))
    const t = await res.json().catch(() => ({}))
    const okIss = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com'
    return res.ok && okIss && t.aud === c.env.GOOGLE_CLIENT_ID && String(t.email_verified) === 'true' && t.sub && t.email ? t : null
}

/* Ambil foto Google di server lalu simpan sebagai foto profil (supaya tidak hotlink & aman dipakai canvas). */
const googlePhoto = async (url) => {
    try {
        const u = new URL(url)
        if (u.protocol !== 'https:' || !u.hostname.endsWith('.googleusercontent.com')) return null
        const r = await fetch(url.replace(/=s\d+(-c)?$/, '') + '=s320-c', { signal: AbortSignal.timeout(5000) })
        const type = (r.headers.get('content-type') || '').split(';')[0]
        if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return null
        const buf = new Uint8Array(await r.arrayBuffer())
        if (!buf.length || buf.length > 140000) return null
        let s = ''
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
        return `data:${type};base64,${btoa(s)}`
    } catch { return null }
}

const googleSignIn = async (c, t) => {
    const now = Date.now(), r = await store(c).googleLogin({ sub: t.sub, email: t.email, now, ip: c.get('ip') })
    if (r.needAvatar && t.picture) {
        const photo = await googlePhoto(t.picture)
        if (photo) await store(c).setAvatarIfEmpty(r.id, photo, now)
    }
    await startSession(c, r.id)
}

auth.post('/google', async (c) => {
    if (!c.env.GOOGLE_CLIENT_ID) return send(c, fail(503, 'google_off', 'Login Google belum dikonfigurasi.'))
    const t = await googleToken(c, (await body(c)).credential)
    if (!t) return send(c, fail(401, 'google_invalid', 'Token Google tidak valid.'))
    await googleSignIn(c, t)
    return c.json({ ok: true })
})

auth.post('/google/callback', async (c) => {
    const f = await c.req.parseBody().catch(() => ({}))
    const csrf = getCookie(c, 'g_csrf_token')
    const t = csrf && csrf === f.g_csrf_token ? await googleToken(c, f.credential) : null
    if (!t) return c.redirect('/login.html?err=google', 303)
    await googleSignIn(c, t)
    return c.redirect('/login.html', 303) /* halaman login meneruskan ke tujuan awal (next) */
})

auth.post('/logout', async (c) => { await endSession(c); return c.json({ ok: true }) })

auth.use('/me', requireUser)
auth.use('/me/*', requireUser)
const uid = (c) => c.get('user').id

auth.get('/me', (c) => c.json(c.get('user')))
auth.get('/me/usage', async (c) => send(c, await store(c).usage(uid(c), Date.now())))
auth.get('/me/usage/day', async (c) => send(c, await store(c).usageDay(uid(c), c.req.query('day'))))
auth.get('/me/accesskey', async (c) => send(c, await store(c).accessKeyOf(uid(c))))
auth.post('/me/accesskey/reset', async (c) => send(c, await store(c).accessKeyOf(uid(c), true)))
auth.get('/me/orders', async (c) => send(c, await store(c).userOrders(uid(c))))
auth.put('/me/ips', async (c) => send(c, await store(c).setIps(uid(c), (await body(c)).ips, Date.now())))
auth.get('/me/ips', async (c) => send(c, await store(c).listIps(uid(c))))
auth.post('/me/ips', async (c) => send(c, await store(c).addIp(uid(c), (await body(c)).ip, Date.now())))
auth.delete('/me/ips/:ip', async (c) => send(c, await store(c).removeIp(uid(c), decodeURIComponent(c.req.param('ip')), Date.now())))
auth.get('/me/avatar', async (c) => {
    const r = await store(c).getAvatar(uid(c))
    if (!r.ok) return c.body(null, 404)
    const m = r.data.match(/^data:([^;]+);base64,(.+)$/)
    return new Response(Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0)), { headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=31536000, immutable' } })
})
auth.put('/me/avatar', async (c) => send(c, await store(c).setAvatar(uid(c), (await body(c)).data, Date.now())))
auth.delete('/me/avatar', async (c) => send(c, await store(c).clearAvatar(uid(c))))
auth.put('/me/profile', async (c) => send(c, await store(c).setProfile(uid(c), await body(c))))
auth.get('/me/trial', async (c) => send(c, await store(c).trialStatus(uid(c), Date.now())))
auth.post('/me/trial', async (c) => send(c, await store(c).claimTrial(uid(c), c.get('ip'), Date.now())))
auth.post('/me/redeem', async (c) => send(c, await store(c).redeem(uid(c), (await body(c)).code, Date.now())))
auth.post('/me/delete', async (c) => {
    const b = await body(c), info = await store(c).authInfo({ id: uid(c) })
    if (String(b.confirm || '').trim().toLowerCase() !== 'delete') return send(c, fail(400, 'not_confirmed', 'Ketik "delete" untuk konfirmasi.'))
    if (info.hash) { /* akun dengan password wajib konfirmasi password */
        const { hash } = await hashPw(String(b.password || ''), info.salt)
        if (!sameHash(hash, info.hash)) return send(c, fail(403, 'wrong_password', 'Password salah.'))
    }
    const r = await store(c).deleteAccount(uid(c))
    await endSession(c)
    return send(c, r)
})
auth.put('/me/border', async (c) => send(c, await store(c).setBorder(uid(c), (await body(c)).colors, Date.now())))
auth.put('/me/key', async (c) => send(c, await store(c).setKey(uid(c), (await body(c)).new_key, Date.now())))

auth.put('/me/username', async (c) => {
    const name = String((await body(c)).username || '').trim()
    return send(c, USER_RE.test(name) ? await store(c).setUsername(uid(c), name) : fail(400, 'bad_username', 'Username 3-20 karakter: huruf, angka, atau _'))
})

auth.put('/me/password', async (c) => {
    const b = await body(c)
    if (String(b.new_password || '').length < 8) return send(c, PW_MSG)
    const info = await store(c).authInfo({ id: uid(c) })
    if (info.hash) { /* akun Google-only belum punya password, jadi tidak perlu password lama */
        const { hash } = await hashPw(String(b.current_password || ''), info.salt)
        if (!sameHash(hash, info.hash)) return send(c, fail(403, 'wrong_password', 'Password lama salah.'))
    }
    const n = await hashPw(b.new_password)
    return send(c, await store(c).setPassword(uid(c), n.hash, n.salt))
})
