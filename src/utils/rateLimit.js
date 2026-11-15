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

export const rateLimiter = () => async (c, next) => {
    const ip = c.req.header('cf-connecting-ip')
        || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
        || 'unknown'
    c.set('ip', ip)

    if (parseList(c.env.RATE_LIMIT_BAN_LIST).includes(ip)) return errorPage(c, 403, 'Forbidden')

    /* Owner: dicek dari IP asli Cloudflare saja (bukan x-forwarded-for yang bisa dipalsukan). */
    const owner = parseList(c.env.OWNER_IPS).includes(c.req.header('cf-connecting-ip') || '')
    c.set('isOwner', owner)
    if (owner) c.set('account', { plan: 'owner', name: 'Owner', premium: true })

    if (owner || parseList(c.env.RATE_LIMIT_WHITELIST || '127.0.0.1').includes(ip)) {
        c.header('X-RateLimit-Limit', 'UNLIMITED')
        c.header('X-RateLimit-Remaining', 'UNLIMITED')
        return next()
    }

    /* Endpoint akun/billing/admin punya proteksi sendiri (sesi, owner IP, batas order). */
    if (/^\/api\/(billing|auth|admin)\//.test(c.req.path)) return next()

    const apiKey = c.req.header('x-api-key') || c.req.query('apikey')
    if (apiKey) {
        if (!c.env.STORE) return json(c, 503, 'Service Unavailable', 'Store belum dikonfigurasi.')
        const r = await c.env.STORE.get(c.env.STORE.idFromName('main')).consume(apiKey, ip, c.req.path, Date.now())
        if (r.ok === false) return json(c, r.status, r.error, r.message)
        if (r.premium) {
            c.set('account', { plan: r.plan, name: r.name, premium: true })
            c.header('X-Plan', r.name)
            c.header('X-RateLimit-Limit', r.limit === null ? 'UNLIMITED' : String(r.limit))
            c.header('X-RateLimit-Remaining', r.remaining === null ? 'UNLIMITED' : String(r.remaining))
            return next()
        }
        /* Key member (tanpa paket aktif): tetap kena limiter IP gratis, tanpa akses premium. */
        c.set('account', { plan: 'member', name: 'Member', premium: false })
    }

    const windowMs = Math.max(1000, Number(c.env.RATE_LIMIT_WINDOW_MS) || DEFAULT_WINDOW_MS)
    const max = Math.max(1, Number(c.env.RATE_LIMIT_MAX) || DEFAULT_MAX)
    const namespace = c.env.RATE_LIMITER

    if (!namespace) {
        console.error('[RateLimit] RATE_LIMITER Durable Object binding is missing')
        return json(c, 503, 'Service Unavailable', 'Rate limiter is not configured.')
    }

    const stub = namespace.get(namespace.idFromName(ip))
    const result = await stub.fetch('https://rate-limit.internal/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ windowMs, max, now: Date.now() }),
    })
    const state = await result.json()

    c.header('X-RateLimit-Limit', String(max))
    c.header('X-RateLimit-Remaining', String(state.remaining))

    if (!state.allowed) {
        c.header('Retry-After', String(state.retryAfter))
        return errorPage(c, 429, 'Too Many Requests', { RETRY_AFTER: state.retryAfter })
    }

    await next()
}

class RateLimitDO {
    constructor(ctx, env) {
        this.ctx = ctx
        this.env = env
    }

    async fetch(request) {
        if (new URL(request.url).pathname !== '/consume') {
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
