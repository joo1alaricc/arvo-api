import { meter } from './rateLimit.js'

/* Endpoint bawaan: limit baru dihitung di sini, saat endpoint benar-benar dipanggil. */
export const register = (app, route, handler) => {
    app.openapi(route, async (c) => {
        if (route['x-status'] === 'OFFLINE') {
            return c.json({ error: 'Service Unavailable', message: 'This endpoint is currently OFFLINE.', status: 503 }, 503)
        }
        const access = route['x-access'] || (route['x-premium'] ? 'premium' : 'free')
        const denied = await meter(c, { path: route.path, access })
        if (denied) return denied
        return handler(c)
    })
}
