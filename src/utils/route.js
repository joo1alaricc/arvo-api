import { meter } from './rateLimit.js'
import { effective } from './overrides.js'

const offline = (c) => c.json({ error: 'Service Unavailable', message: 'This endpoint is currently OFFLINE.', status: 503 }, 503)

/* Endpoint bawaan: limit baru dihitung di sini, saat endpoint benar-benar dipanggil.
 * Akses & status dibaca dari kode lalu ditimpa override admin (dashboard). Endpoint berbayar dicek akses DULU
 * (sebelum status offline) supaya keberadaannya tidak terbaca oleh user tanpa paket. */
export const register = (app, route, handler) => {
    app.openapi(route, async (c) => {
        const { access, status } = await effective(c, route)
        if (access !== 'free') {
            const denied = await meter(c, { path: route.path, access })
            if (denied) return denied
            if (status === 'offline') return offline(c)
        } else {
            if (status === 'offline') return offline(c)
            const denied = await meter(c, { path: route.path, access })
            if (denied) return denied
        }
        return handler(c)
    })
}
