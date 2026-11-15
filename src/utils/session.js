import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

const COOKIE = 'arvo_session'
const TTL = 30 * 24 * 3600 * 1000
const enc = new TextEncoder()
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha = async (s) => toHex(await crypto.subtle.digest('SHA-256', enc.encode(s)))

export const fail = (status, error, message) => ({ ok: false, status, error, message })
export const store = (c) => c.env.STORE.get(c.env.STORE.idFromName('main'))
export const send = (c, r) => c.json(r, r.ok === false ? r.status : 200)

/* PBKDF2-SHA256 (100k iterasi, batas maksimum Workers). */
export const hashPw = async (pw, saltHex) => {
    const salt = saltHex ? new Uint8Array(saltHex.match(/../g).map((x) => parseInt(x, 16))) : crypto.getRandomValues(new Uint8Array(16))
    const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256)
    return { salt: toHex(salt), hash: toHex(bits) }
}
export const sameHash = (a, b) => a.length === b.length && [...a].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0

export const startSession = async (c, userId) => {
    const token = toHex(crypto.getRandomValues(new Uint8Array(32)))
    await store(c).createSession(userId, await sha(token), Date.now(), TTL)
    setCookie(c, COOKIE, token, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: TTL / 1000, secure: new URL(c.req.url).protocol === 'https:' })
}
export const endSession = async (c) => {
    const t = getCookie(c, COOKIE)
    if (t) await store(c).endSession(await sha(t))
    deleteCookie(c, COOKIE, { path: '/' })
}
export const currentUser = async (c) => {
    const t = getCookie(c, COOKIE)
    if (!t) return null
    const r = await store(c).getSession(await sha(t), Date.now())
    return r.ok === false ? null : r
}
export const requireUser = async (c, next) => {
    const u = await currentUser(c)
    if (!u) return c.json({ error: 'unauthorized', message: 'Silakan login dulu.', status: 401 }, 401)
    c.set('user', u)
    await next()
}
