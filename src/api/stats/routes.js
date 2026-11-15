import { createRoute, z } from '@hono/zod-openapi'

export const statsRoute = createRoute({
    method: 'get',
    path: '/api/stats',
    tags: ['stats'],
    description: 'Get runtime information exposed by the Cloudflare Workers platform.',
    'x-status': 'ONLINE',
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.string(),
                        system: z.object({
                            platform: z.string(),
                            release: z.string(),
                            type: z.string(),
                            arch: z.string(),
                            hostname: z.string(),
                            uptime: z.string(),
                        }),
                        cpu: z.object({
                            model: z.string(),
                            speed: z.string(),
                            cores: z.number(),
                            load_avg: z.array(z.number()),
                        }),
                        memory: z.object({
                            total: z.string(),
                            free: z.string(),
                            used: z.string(),
                            active_process_rss: z.string(),
                            heap_total: z.string(),
                            heap_used: z.string(),
                        }),
                        network: z.record(z.string(), z.array(z.object({
                            address: z.string(),
                            netmask: z.string(),
                            family: z.string(),
                            mac: z.string(),
                            internal: z.boolean(),
                        }))),
                        process: z.object({
                            pid: z.number(),
                            node_version: z.string(),
                            uptime: z.string(),
                            title: z.string(),
                        }),
                        time: z.string(),
                        date: z.string(),
                    }),
                },
            },
            description: 'Retrieve Cloudflare Workers runtime information. Host-level CPU, memory, and network-interface metrics are not exposed by Workers.',
        },
    },
})

export const statsHandler = (c) => {
    const now = new Date()
    const unavailable = 'Not exposed by Cloudflare Workers'
    const data = {
        status: 'online',
        system: {
            platform: 'cloudflare',
            release: 'Workers Runtime',
            type: 'Cloudflare Workers',
            arch: 'managed',
            hostname: new URL(c.req.url).hostname,
            uptime: 'Not exposed by Cloudflare Workers',
        },
        cpu: {
            model: 'Cloudflare Workers Runtime',
            speed: 'Not exposed',
            cores: 1,
            load_avg: [0, 0, 0],
        },
        memory: {
            total: unavailable,
            free: unavailable,
            used: unavailable,
            active_process_rss: unavailable,
            heap_total: unavailable,
            heap_used: unavailable,
        },
        network: {},
        process: {
            pid: 0,
            node_version: 'Not applicable',
            uptime: 'Per-request isolate',
            title: 'Cloudflare Workers',
        },
        time: now.toLocaleTimeString('id-ID', { hour12: false, timeZone: 'Asia/Jakarta' }),
        date: now.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' }),
    }

    return c.json(data, 200)
}
