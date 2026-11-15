import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

import { setupRoutes } from './api/index.js'
import { logApiRequest } from './utils/logApiRequest.js'
import { rateLimiter } from './utils/rateLimit.js'
import { billing } from './api/billing.js'
import { prettyPrint } from './utils/pretty.js'

const createApp = () => {
    const app = new OpenAPIHono()

    app.use('*', secureHeaders())
    app.use('*', cors())
    app.use('*', logApiRequest)
    app.use('*', rateLimiter())
    app.use('*', prettyPrint)

    app.route('/api/billing', billing)
    setupRoutes(app)

    app.doc('/docs', {
        openapi: '3.0.0',
        info: {
            version: '1.0.0',
            title: 'Arvo',
            description: 'About Simple and easy to use API. ⭐️ Star to support our work!',
        },
        servers: [{ url: '/' }],
    })

    app.get('/health', (c) => c.json({ status: 'ok', runtime: 'cloudflare-workers' }))

    app.notFound(async (c) => {
        if (c.req.path.startsWith('/api/') || c.req.path === '/docs') {
            return c.json({
                error: 'Not Found',
                message: 'The requested API endpoint does not exist.',
                path: c.req.path,
                status: 404,
            }, 404)
        }

        const assetPath = c.req.path === '/' ? '/index.html' : c.req.path
        const assetRequest = new Request(new URL(assetPath, c.req.url), c.req.raw)
        const asset = await c.env.ASSETS.fetch(assetRequest)
        if (asset.status !== 404) return asset

        const errorRequest = new Request(new URL('/errors/404.html', c.req.url))
        const errorPage = await c.env.ASSETS.fetch(errorRequest)
        return errorPage.status === 404 ? c.text('404 Not Found', 404) : new Response(errorPage.body, {
            status: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
    })

    app.onError(async (err, c) => {
        console.error('[Worker Error]', err)
        if (c.req.path.startsWith('/api/')) {
            return c.json({
                error: 'Internal Server Error',
                message: 'An unexpected error occurred.',
                status: 500,
            }, 500)
        }

        const page = await c.env.ASSETS.fetch(new Request(new URL('/errors/500.html', c.req.url)))
        return page.status === 404 ? c.text('Internal Server Error', 500) : new Response(page.body, {
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
    })

    return app
}

const app = createApp()

export default {
    fetch(request, env, ctx) {
        return app.fetch(request, env, ctx)
    },
}

export { RateLimitDO } from './utils/rateLimit.js'
export { StoreDO } from './utils/store.js'
