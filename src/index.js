import { setUpstreamUA } from './utils/upstream.js'   /* harus paling atas: memasang User-Agent browser untuk semua fetch keluar */
import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

import { setupRoutes } from './api/index.js'
import { logApiRequest } from './utils/logApiRequest.js'
import { rateLimiter } from './utils/rateLimit.js'
import { billing, paymentWebhook, btzCallback } from './api/billing.js'
import { auth } from './api/auth.js'
import { admin } from './api/admin.js'
import { tools } from './api/tools.js'
import { prettyPrint } from './utils/pretty.js'
import { dynamicHandler, mergeSpec } from './api/dynamic.js'
import { BUILTIN_PATHS, builtinInfo } from './api/index.js'
import { store, currentUser } from './utils/session.js'
import { getOverrides } from './utils/overrides.js'

const createApp = () => {
    const app = new OpenAPIHono()

    /* COOP default Hono = same-origin; itu memutus komunikasi popup Google Sign-In. allow-popups tetap aman. */
    app.use('*', secureHeaders({ crossOriginOpenerPolicy: 'same-origin-allow-popups' }))
    app.use('*', cors())
    app.use('*', logApiRequest)
    app.use('*', rateLimiter())
    app.use('*', prettyPrint)

    app.route('/api/billing', billing)
    app.route('/api/auth', auth)
    app.route('/api/admin', admin)
    app.route('/api/tools', tools)
    /* Halaman /callback dan /webhook untuk kebutuhan API (payment gateway & pembaca notifikasi pembayaran).
     *  POST /callback?t=BTZPAY_CALLBACK_TOKEN   : callback BTZPay (sama dengan /api/billing/btzpay/callback)
     *  POST /webhook  + Bearer PAYMENT_WEBHOOK_SECRET {amount} : konfirmasi pembayaran (sama dengan /api/billing/webhook)
     *  GET/HEAD: balasan 200 berisi info singkat, supaya validasi URL dari penyedia pembayaran lolos. */
    const hook = (name, method, handler) => app.all(name, (c) => {
        const m = c.req.method
        if (m === 'POST') return handler(c)
        if (m === 'GET' || m === 'HEAD') { c.header('Cache-Control', 'no-store'); return c.json({ status: 200, endpoint: name, accepts: method, message: `Endpoint ${name} aktif.` }) }
        c.header('Allow', 'GET, HEAD, POST')
        return c.json({ error: 'Method Not Allowed', message: `Gunakan ${method} untuk ${name}.`, status: 405 }, 405)
    })
    hook('/callback', 'POST', btzCallback)
    hook('/webhook', 'POST', paymentWebhook)

    setupRoutes(app)

    /* Katalog untuk Playground: hanya info yang perlu untuk memanggil endpoint (path, method, input, akses). Tidak ada skema respons,
     * kode, atau URL upstream. Endpoint di atas tier si peminta (free/premium/vip) tidak ditampilkan sama sekali. Tidak mengurangi limit. */
    app.get('/api/catalog', async (c) => {
        const RANK = { free: 0, premium: 1, vip: 2, owner: 3 }, warn = []
        let rank = c.get('isOwner') ? 3 : 0
        const ak = c.req.header('x-access-key') || c.req.query('accesskey') || c.req.header('x-api-key')
        if (!rank && ak) { try { if ((await store(c).verifyAccess(ak)).ok !== false) rank = 3 } catch {} }
        if (!rank) {
            try {
                const u = await currentUser(c)
                if (u) rank = (await store(c).adminLevel(u.id)) ? 3 : RANK[u.role === 'member' ? 'free' : u.role] ?? 0
            } catch (e) { warn.push('sesi: ' + (e.message || e)) }
        }
        /* Tiap sumber dipisah: kalau database/override bermasalah, endpoint bawaan TETAP tampil (tidak pernah kosong gara-gara satu error). */
        let ov = {}
        try { ov = (await getOverrides(c)) || {} } catch (e) { warn.push('override: ' + (e.message || e)) }
        const list = builtinInfo().map((e) => {
            const o = ov[e.path]
            return o ? { ...e, name: o.name || e.name, description: o.description ?? e.description, access: o.access || e.access, status: o.status || e.status } : e
        })
        try { const r = await store(c).listEndpoints(); if (r && r.ok !== false) list.push(...(r.endpoints || [])) } catch (e) { warn.push('endpoint: ' + (e.message || e)) }
        const doc = { paths: {} }
        for (const e of list) {
            if ((RANK[e.access] ?? 9) > rank) continue
            try { mergeSpec(doc, [e], rank === 3) } catch (e2) { warn.push(`${e.path}: ${e2.message || e2}`) }
        }
        if (warn.length) console.error('[catalog]', warn.join(' | '))
        c.header('Cache-Control', 'no-store')
        return c.json(rank === 3 && warn.length ? { ...doc, warnings: warn } : doc)
    })

    /* Cek API key / Access key (publik, tidak mengurangi limit). Body: { type: 'apikey' | 'accesskey', key } */
    app.post('/api/checkkey', async (c) => {
        const b = await c.req.json().catch(() => ({}))
        const r = await store(c).checkKey(b.type === 'accesskey' ? 'accesskey' : 'apikey', b.key, c.get('ip'), Date.now())
        c.header('Cache-Control', 'no-store')
        return c.json(r.ok === false ? { status: r.status, error: r.error, message: r.message } : { status: r.status, result: r.result }, r.ok === false ? r.status : 200)
    })

    /* Penghitung kunjungan halaman (beacon dari browser, sekali per sesi tab). */
    app.post('/api/pv', async (c) => { await store(c).pageHit().catch(() => {}); return c.body(null, 204) })

    /* Statistik publik untuk halaman Dashboard. Hanya angka agregat; tidak mengurangi limit. */
    app.get('/api/dashboard', async (c) => {
        const now = Date.now()
        let ov = {}
        try { ov = (await getOverrides(c)) || {} } catch {}
        const list = builtinInfo().map((e) => { const o = ov[e.path]; return o ? { ...e, access: o.access || e.access, status: o.status || e.status } : e })
        try { const r = await store(c).listEndpoints(); if (r && r.ok !== false) list.push(...(r.endpoints || [])) } catch {}
        const s = await store(c).publicStats(now)
        /* uptime = waktu sejak versi Worker terakhir di-deploy; kalau metadata tidak ada, sejak Durable Object terakhir hidup */
        const deployed = Date.parse(c.env.CF_VERSION_METADATA?.timestamp || '')
        const since = Number.isFinite(deployed) ? deployed : s.boot_at
        c.header('Cache-Control', 'public, max-age=20')
        return c.json({
            requests: s.requests, users: s.users, page_views: s.page_views, blocked: s.blocked,
            endpoints: list.length,   /* semua endpoint dihitung: owner, offline, dan online */
            uptime_ms: Math.max(0, now - since), days: s.days,
        })
    })

    /* Konten Dashboard yang dikelola admin: Contributor, Syarat & Ketentuan, Thanks To. */
    app.get('/api/site-content', async (c) => {
        c.header('Cache-Control', 'no-store')
        return c.json({ ok: true, ...(await store(c).siteContent()) })
    })

    /* Endpoint buatan admin (harus paling akhir supaya tidak menimpa route bawaan). */
    app.all('/api/*', dynamicHandler(BUILTIN_PATHS))

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
                /* penyebab asli hanya terlihat oleh owner (IP di OWNER_IPS) */
                ...(c.get('isOwner') ? { detail: String(err?.stack || err?.message || err).slice(0, 600) } : {}),
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
        setUpstreamUA(env.UPSTREAM_UA)
        return app.fetch(request, env, ctx)
    },
}

export { RateLimitDO } from './utils/rateLimit.js'
export { StoreDO } from './utils/store.js'
