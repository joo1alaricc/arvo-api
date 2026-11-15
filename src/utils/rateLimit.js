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

export const rateLimiter = () => async (c, next) => {
    const ip = c.req.header('cf-connecting-ip')
        || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
        || 'unknown'

    const banList = parseList(c.env.RATE_LIMIT_BAN_LIST)
    const whitelist = parseList(c.env.RATE_LIMIT_WHITELIST || '127.0.0.1')

    if (banList.includes(ip)) {
        return errorPage(c, 403, 'Forbidden')
    }

    if (whitelist.includes(ip)) {
        c.header('X-RateLimit-Limit', 'UNLIMITED')
        c.header('X-RateLimit-Remaining', 'UNLIMITED')
        await next()
        return
    }

    const windowMs = Math.max(1000, Number(c.env.RATE_LIMIT_WINDOW_MS) || DEFAULT_WINDOW_MS)
    const max = Math.max(1, Number(c.env.RATE_LIMIT_MAX) || DEFAULT_MAX)
    const namespace = c.env.RATE_LIMITER

    if (!namespace) {
        console.error('[RateLimit] RATE_LIMITER Durable Object binding is missing')
        return c.json({ error: 'Service Unavailable', message: 'Rate limiter is not configured.', status: 503 }, 503)
    }

    const id = namespace.idFromName(ip)
    const stub = namespace.get(id)
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
