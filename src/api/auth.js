import { Hono } from 'hono'
import { store, send, fail, hashPw, sameHash, startSession, endSession, requireUser } from '../utils/session.js'

export const auth = new Hono()
const body = (c) => c.req.json().catch(() => ({}))
const USER_RE = /^[A-Za-z0-9_]{3,20}$/
const PW_MSG = fail(400, 'bad_password', 'Password minimal 8 karakter.')

auth.get('/config', (c) => c.json({ google_client_id: c.env.GOOGLE_CLIENT_ID || null }))

auth.post('/register', async (c) => {
    const b = await body(c), username = String(b.username || '').trim()
    if (!USER_RE.test(username)) return send(c, fail(400, 'bad_username', 'Username 3-20 karakter: huruf, angka, atau _'))
    if (String(b.password || '').length < 8) return send(c, PW_MSG)
    const { salt, hash } = await hashPw(b.password)
    const r = await store(c).register({ username, email: String(b.email || '').trim() || null, hash, salt, now: Date.now() })
    if (r.ok) await startSession(c, r.id)
    return send(c, r)
})

auth.post('/login', async (c) => {
    const b = await body(c)
    const info = await store(c).authInfo({ username: String(b.username || '').trim() })
    const bad = fail(401, 'invalid_login', 'Username atau password salah.')
    if (!info.ok || !info.hash) return send(c, bad)
    const { hash } = await hashPw(String(b.password || ''), info.salt)
    if (!sameHash(hash, info.hash)) return send(c, bad)
    await startSession(c, info.id)
    return c.json({ ok: true })
})

/* Login Google: verifikasi ID token (Google Identity Services). Aktif jika GOOGLE_CLIENT_ID diisi. */
auth.post('/google', async (c) => {
    if (!c.env.GOOGLE_CLIENT_ID) return send(c, fail(503, 'google_off', 'Login Google belum dikonfigurasi.'))
    const { credential } = await body(c)
    const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential || ''))
    const t = await res.json().catch(() => ({}))
    if (!res.ok || t.aud !== c.env.GOOGLE_CLIENT_ID || String(t.email_verified) !== 'true') return send(c, fail(401, 'google_invalid', 'Token Google tidak valid.'))
    const r = await store(c).googleLogin({ sub: t.sub, email: t.email, now: Date.now() })
    await startSession(c, r.id)
    return c.json({ ok: true })
})

auth.post('/logout', async (c) => { await endSession(c); return c.json({ ok: true }) })

auth.use('/me', requireUser)
auth.use('/me/*', requireUser)
const uid = (c) => c.get('user').id

auth.get('/me', (c) => c.json(c.get('user')))
auth.get('/me/usage', async (c) => send(c, await store(c).usage(uid(c), Date.now())))
auth.get('/me/orders', async (c) => send(c, await store(c).userOrders(uid(c))))
auth.put('/me/ips', async (c) => send(c, await store(c).setIps(uid(c), (await body(c)).ips, Date.now())))
auth.get('/me/ips', async (c) => send(c, await store(c).listIps(uid(c))))
auth.post('/me/ips', async (c) => send(c, await store(c).addIp(uid(c), (await body(c)).ip, Date.now())))
auth.delete('/me/ips/:ip', async (c) => send(c, await store(c).removeIp(uid(c), decodeURIComponent(c.req.param('ip')), Date.now())))
auth.put('/me/profile', async (c) => send(c, await store(c).setProfile(uid(c), await body(c))))
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
