const DEFAULT_WINDOW_MS = 15 * 60 * 1000
const DEFAULT_MAX = 100

const parseList = (value = '') => value.split(',').map((item) => item.trim()).filter(Boolean)

const errorPage = async (c, status, fallback, replacements = {}) => {
    const path = `/errors/${status}.html`
    try {
        const response = await c.env.ASSETS.fetch(new Request(new URL(path, c.req.url)))
        if (response.ok) {
            let html = await response.text()
            for (const [key, value] of Object.entries(replacements)) {
                html = html.replaceAll(`{{${key}}}`, String(value))
            }
            return c.html(html, status)
        }
    } catch (error) {
        console.error('[RateLimit] Failed to load error page:', error)
    }
    return c.text(fallback, status)
}

const json = (c, status, error, message, extra = {}) => c.json({ error, message, status, ...extra }, status)
/* Sama persis dengan 404 endpoint yang memang tidak ada, supaya endpoint berbayar tidak terdeteksi keberadaannya. */
const hidden = (c) => json(c, 404, 'Not Found', 'The requested API endpoint does not exist.', { path: c.req.path })

const storeOf = (c) => c.env.STORE.get(c.env.STORE.idFromName('main'))

/* Daftar IP terblokir di-cache singkat per isolate supaya tidak memanggil DO tiap request. */
let blockCache = { at: 0, set: new Set() }
const isBlocked = async (c, ip) => {
    if (!c.env.STORE) return false
    if (Date.now() - blockCache.at > 15000) {
        try { blockCache = { at: Date.now(), set: new Set((await storeOf(c).blockedList()).ips) } } catch (e) { console.error('[Block]', e) }
    }
    return blockCache.set.has(ip)
}
export const refreshBlocked = () => { blockCache.at = 0 }

/* Gerbang global: hanya identifikasi IP, owner, dan blokir. TIDAK mengurangi limit apa pun. */
export const rateLimiter = () => async (c, next) => {
    const ip = c.req.header('cf-connecting-ip')
        || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
        || 'unknown'
    c.set('ip', ip)

    const owner = parseList(c.env.OWNER_IPS).includes(c.req.header('cf-connecting-ip') || '')
    c.set('isOwner', owner)
    if (owner) c.set('account', { plan: 'owner', name: 'Owner', premium: true, vip: true })

    if (!owner) {
        if (parseList(c.env.RATE_LIMIT_BAN_LIST).includes(ip) || await isBlocked(c, ip)) {
            if (c.req.path.startsWith('/api/') || c.req.path === '/docs') return json(c, 403, 'Forbidden', 'IP kamu diblokir. Hubungi admin bila ini keliru.')
            return errorPage(c, 403, 'Forbidden')
        }
    }
    await next()
}

const NEED_RANK = { free: 0, premium: 1, vip: 2, owner: 3 }

/* Dipanggil HANYA saat endpoint API benar-benar diakses. Mengembalikan Response bila ditolak, atau null bila lolos.
 *
 * SEMUA endpoint wajib API key (header x-api-key atau ?apikey=). Satu parameter itu bisa berisi:
 *  - Access key admin (acc_... atau OWNER_ACCESS_KEY): tanpa batas, boleh memanggil endpoint apa pun termasuk khusus owner.
 *  - API key biasa: tunduk pada tier, whitelist IP, dan limit harian akun.
 * IP tidak pernah dipakai untuk memberi akses; khusus endpoint owner, IP owner pun tidak berlaku. */
export const meter = async (c, { path, access = 'free' }) => {
    const owner = !!c.get('isOwner'), ip = c.get('ip')
    const apiKey = (c.req.header('x-api-key') || c.req.query('apikey') || c.req.header('x-access-key') || c.req.query('accesskey') || '').trim()
    const flagTier = () => (c.env.STORE ? storeOf(c).flag(null, ip, path, 'tier', Date.now()).catch(() => {}) : null)

    /* tanpa key: endpoint berbayar/owner pura-pura tidak ada (404, dicatat); endpoint gratis minta key (401) */
    if (!apiKey) {
        if (NEED_RANK[access] > 0) { await flagTier(); return hidden(c) }
        return json(c, 401, 'Unauthorized', 'API key wajib. Kirim lewat header x-api-key atau query ?apikey=.', { code: 'apikey_required' })
    }
    if (!c.env.STORE) return json(c, 503, 'Service Unavailable', 'Store belum dikonfigurasi.')

    /* apakah key ini sebuah access key admin? */
    const v = await storeOf(c).verifyAccess(apiKey).catch(() => null)
    if (v && v.ok !== false) {
        c.header('X-RateLimit-Limit', 'UNLIMITED'); c.header('X-RateLimit-Remaining', 'UNLIMITED')
        c.set('account', { plan: 'owner', name: 'Admin', premium: true, vip: true })
        return null
    }

    /* endpoint khusus owner: hanya access key. API key biasa (dan IP owner) tidak cukup. */
    if (access === 'owner') {
        await storeOf(c).flag(null, ip, path, 'tier', Date.now()).catch(() => {})
        return hidden(c)
    }

    /* IP owner + API key biasa: tanpa batas, pemakaian tetap dicatat di akun pemilik key */
    if (owner) {
        c.header('X-RateLimit-Limit', 'UNLIMITED'); c.header('X-RateLimit-Remaining', 'UNLIMITED')
        await storeOf(c).consume(apiKey, ip, path, Date.now(), access, true).catch((e) => console.error('[Usage]', e))
        return null
    }

    const r = await storeOf(c).consume(apiKey, ip, path, Date.now(), access)
    if (r.hide) return hidden(c)
    if (r.ok === false) return json(c, r.status, r.error, r.message)
    c.header('X-RateLimit-Limit', r.limit === null ? 'UNLIMITED' : String(r.limit))
    c.header('X-RateLimit-Remaining', r.remaining === null ? 'UNLIMITED' : String(r.remaining))
    if (r.premium) {
        c.set('account', { plan: r.plan, name: r.name, premium: true })
        c.header('X-Plan', r.name)
    } else c.set('account', { plan: 'member', name: 'Member', premium: false })
    /* key valid: kuota dihitung per akun (harian), bukan per IP */
    return null
}

/* Cek sisa kuota IP gratis TANPA mengurangi (untuk tampilan beranda). */
export const peekQuota = async (c) => {
    if (c.get('isOwner')) return { limit: null, remaining: null, unlimited: true }
    const max = Math.max(1, Number(c.env.RATE_LIMIT_MAX) || DEFAULT_MAX), ns = c.env.RATE_LIMITER
    if (!ns) return { limit: max, remaining: max }
    const res = await ns.get(ns.idFromName(c.get('ip'))).fetch('https://rate-limit.internal/peek', { method: 'POST', body: JSON.stringify({ max, now: Date.now() }) })
    const st = await res.json()
    return { limit: max, remaining: st.remaining }
}

class RateLimitDO {
    constructor(ctx, env) {
        this.ctx = ctx
        this.env = env
    }

    async fetch(request) {
        const pathname = new URL(request.url).pathname
        if (pathname === '/peek') {
            const { max, now } = await request.json()
            const st = await this.ctx.storage.get('rate-limit')
            return Response.json({ remaining: !st || now >= st.resetTime ? max : Math.max(0, max - st.count) })
        }
        if (pathname !== '/consume') {
            return new Response('Not Found', { status: 404 })
        }

        const { windowMs, max, now } = await request.json()
        const result = await this.ctx.storage.transaction(async (txn) => {
            let state = await txn.get('rate-limit')
            if (!state || now >= state.resetTime) {
                state = { count: 0, resetTime: now + windowMs }
            }

            state.count += 1
            await txn.put('rate-limit', state)

            const allowed = state.count <= max
            return {
                allowed,
                remaining: Math.max(0, max - state.count),
                retryAfter: Math.max(1, Math.ceil((state.resetTime - now) / 1000)),
            }
        })

        return Response.json(result)
    }
}

export { RateLimitDO }
