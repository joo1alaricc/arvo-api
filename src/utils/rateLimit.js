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

/* Dipanggil HANYA saat endpoint API benar-benar diakses. Mengembalikan Response bila ditolak, atau null bila lolos. */
export const meter = async (c, { path, access = 'free' }) => {
    const owner = !!c.get('isOwner'), ip = c.get('ip')
    if (owner) {
        c.header('X-RateLimit-Limit', 'UNLIMITED'); c.header('X-RateLimit-Remaining', 'UNLIMITED')
        return null
    }
    if (access === 'owner') return json(c, 403, 'Forbidden', 'Endpoint ini khusus owner.')

    const apiKey = c.req.header('x-api-key') || c.req.query('apikey')
    if (apiKey) {
        if (!c.env.STORE) return json(c, 503, 'Service Unavailable', 'Store belum dikonfigurasi.')
        const r = await storeOf(c).consume(apiKey, ip, path, Date.now(), access)
        if (r.ok === false) return json(c, r.status, r.error, r.message)
        if (r.premium) {
            c.set('account', { plan: r.plan, name: r.name, premium: true })
            c.header('X-Plan', r.name)
            c.header('X-RateLimit-Limit', r.limit === null ? 'UNLIMITED' : String(r.limit))
            c.header('X-RateLimit-Remaining', r.remaining === null ? 'UNLIMITED' : String(r.remaining))
            return null
        }
        c.set('account', { plan: 'member', name: 'Member', premium: false })
    }

    /* Endpoint berbayar tanpa key premium: tolak tanpa mengurangi limit IP gratis. */
    if (NEED_RANK[access] > 0) return json(c, 402, 'Premium Required', access === 'vip' ? 'Endpoint ini khusus paket VIP. Kirim apikey.' : 'Endpoint ini khusus paket Premium/VIP. Kirim apikey.')

    if (parseList(c.env.RATE_LIMIT_WHITELIST || '127.0.0.1').includes(ip)) return null

    const windowMs = Math.max(1000, Number(c.env.RATE_LIMIT_WINDOW_MS) || DEFAULT_WINDOW_MS)
    const max = Math.max(1, Number(c.env.RATE_LIMIT_MAX) || DEFAULT_MAX)
    const namespace = c.env.RATE_LIMITER
    if (!namespace) return json(c, 503, 'Service Unavailable', 'Rate limiter is not configured.')

    const res = await namespace.get(namespace.idFromName(ip)).fetch('https://rate-limit.internal/consume', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ windowMs, max, now: Date.now() }),
    })
    const state = await res.json()
    c.header('X-RateLimit-Limit', String(max))
    c.header('X-RateLimit-Remaining', String(state.remaining))
    if (!state.allowed) {
        c.header('Retry-After', String(state.retryAfter))
        return json(c, 429, 'Too Many Requests', `Limit IP gratis habis. Coba lagi dalam ${state.retryAfter} detik.`, { retry_after: state.retryAfter })
    }
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
