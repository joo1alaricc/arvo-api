export const register = (app, route, handler) => {
    app.openapi(route, (c) => {
        if (route['x-status'] === 'OFFLINE') {
            return c.json({
                error: 'Service Unavailable',
                message: 'This endpoint is currently OFFLINE.',
                status: 503
            }, 503)
        }
        if (route['x-premium'] && !c.get('account')) {
            return c.json({
                error: 'Premium Required',
                message: 'Endpoint ini khusus paket Premium/VIP. Kirim header x-api-key.',
                status: 402
            }, 402)
        }
        return handler(c)
    })
}
