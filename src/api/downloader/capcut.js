// @arvo-endpoint {"category":"downloader","slug":"capcut","name":"CapCut Downloader","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/downloader/v1/capcut'

const CapcutQuerySchema = z.object({
    url: z.string().url().openapi({
        example: 'https://www.capcut.com/tv2/ZSpt34r7m/',
        description: 'URL template CapCut yang ingin diunduh.',
    }),
})

export const capcutRoute = createRoute({
    method: 'get',
    path: '/api/downloader/capcut',
    summary: "CapCut Downloader",
    tags: ['downloader'],
    description: 'Downloader template CapCut melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: CapcutQuerySchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.boolean(),
                        author: z.string(),
                        result: z.object({
                            title: z.string(),
                            id: z.string(),
                            thumbnail: z.string().url().nullable().optional(),
                            usage: z.string().nullable().optional(),
                            likes: z.string().nullable().optional(),
                            description: z.string().nullable().optional(),
                            duration: z.string().nullable().optional(),
                            url: z.string().url(),
                            author: z.object({
                                name: z.string().nullable().optional(),
                                avatar: z.string().url().nullable().optional(),
                            }),
                        }),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan data template CapCut.',
        },
        400: {
            description: 'URL CapCut tidak valid.',
        },
        502: {
            description: 'Gagal mengambil data dari scraper.',
        },
    },
})

const fail = (c, message, extra = {}) => c.json({
    status: false,
    author: AUTHOR,
    message,
    ...extra,
}, 502)

export const capcutHandler = async (c) => {
    const { url } = c.req.valid('query')
    const startTime = Date.now()

    try {
        const response = await upstreamFetch(
            `${UPSTREAM}?url=${encodeURIComponent(url)}`,
            {
                method: 'GET',
                headers: { accept: 'application/json' },
                signal: AbortSignal.timeout(40000),
            }
        )

        const raw = await response.text()
        let data

        try {
            data = JSON.parse(raw)
        } catch {
            console.error('[ARVO CAPCUT] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO CAPCUT] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        const r = data?.result
        if (!data?.status || !r?.url) {
            console.error('[ARVO CAPCUT] INVALID RESULT:', data)
            return fail(c, 'Gagal mendapatkan template CapCut.', {
                upstream_message: data?.message,
            })
        }

        const result = {
            title: r.title ?? 'Untitled',
            id: String(r.id ?? ''),
            thumbnail: r.thumbnail ?? null,
            usage: r.usage != null ? String(r.usage) : null,
            likes: r.likes != null ? String(r.likes) : null,
            description: r.description ?? null,
            duration: r.duration ?? null,
            url: r.url,
            author: {
                name: r.author?.name ?? null,
                avatar: r.author?.avatar ?? null,
            },
        }

        if (!result.url.startsWith('https://')) {
            return fail(c, 'URL video dari scraper tidak valid.')
        }

        return c.json({
            status: true,
            author: AUTHOR,
            result,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - startTime}ms`,
        }, 200)

    } catch (error) {
        console.error('[ARVO CAPCUT]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
