import { createRoute, z } from '@hono/zod-openapi'

export const premiumPingRoute = createRoute({
    method: 'get',
    path: '/api/ping',
    tags: ['stats'],
    description: 'Contoh endpoint premium. Wajib kirim header x-api-key dari paket Premium/VIP.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    responses: {
        200: {
            content: { 'application/json': { schema: z.object({ status: z.string(), plan: z.string(), ip: z.string() }) } },
            description: 'Info paket yang sedang dipakai.',
        },
    },
})

export const premiumPingHandler = (c) => c.json({ status: 'ok', plan: c.get('account')?.name || 'unknown', ip: c.get('ip') || '' }, 200)
