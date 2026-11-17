// @arvo-endpoint {"category":"downloader","slug":"twitter","name":"Twitter/X Downloader","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/downloader/twitter'

const TwitterQuerySchema = z.object({
    url: z.string().url().openapi({
        example: 'https://x.com/lordsheinz/status/2122586120496259313',
        description: 'URL tweet X/Twitter — bisa berisi image, video, atau keduanya.',
    }),
})

export const twitterRoute = createRoute({
    method: 'get',
    path: '/api/downloader/twitter',
    summary: "Twitter/X Downloader",
    tags: ['downloader'],
    description: 'Downloader media X/Twitter (image & video) melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: TwitterQuerySchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.boolean(),
                        author: z.string(),
                        result: z.object({
                            id: z.string(),
                            title: z.string().nullable().optional(),
                            taken_at: z.string().nullable().optional(),
                            duration: z.string().nullable().optional(),
                            type: z.enum(['image', 'video', 'mixed']),
                            data: z.array(z.object({
                                type: z.string(),
                                thumbnail: z.string().url().nullable().optional(),
                                url: z.string().url(),
                            })),
                            stats: z.object({
                                views: z.string().nullable().optional(),
                                likes: z.string().nullable().optional(),
                                comments: z.string().nullable().optional(),
                                shares: z.string().nullable().optional(),
                            }).optional(),
                            author: z.object({
                                id: z.string().nullable().optional(),
                                username: z.string().nullable().optional(),
                                fullname: z.string().nullable().optional(),
                                verified: z.boolean().optional(),
                            }),
                        }),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan media X/Twitter.',
        },
        400: {
            description: 'URL X/Twitter tidak valid.',
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

export const twitterHandler = async (c) => {
    const { url } = c.req.valid('query')
    const startTime = Date.now()

    // Validasi awal: x.com atau twitter.com, harus ada /status/
    if (!/^https?:\/\/(x|twitter)\.com\/[^/]+\/status\/\d+/i.test(url)) {
        return c.json({
            status: false,
            author: AUTHOR,
            message: 'URL harus berupa tweet X/Twitter (https://x.com/user/status/...).',
        }, 400)
    }

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
            console.error('[ARVO TWITTER] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO TWITTER] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        const r = data?.result
        if (!data?.status || !r || !Array.isArray(r.data) || r.data.length === 0) {
            console.error('[ARVO TWITTER] INVALID RESULT:', data)
            return fail(c, 'Gagal mendapatkan media X/Twitter.', {
                upstream_message: data?.message,
            })
        }

        // Filter media valid
        const medias = r.data
            .filter((m) => m && typeof m.url === 'string' && m.url.startsWith('https://'))
            .map((m) => ({
                type: m.type ?? 'image',
                thumbnail: m.thumbnail ?? null,
                url: m.url,
            }))

        if (medias.length === 0) {
            return fail(c, 'Tidak ada media valid dari scraper.')
        }

        // Deteksi tipe keseluruhan
        const hasVideo = medias.some((m) => m.type === 'video')
        const hasImage = medias.some((m) => m.type === 'image' || m.type === 'photo')
        const type = hasVideo && hasImage ? 'mixed' : hasVideo ? 'video' : 'image'

        const result = {
            id: String(r.id ?? ''),
            title: r.title ?? null,
            taken_at: r.taken_at ?? null,
            duration: r.duration ?? null,
            type,
            data: medias,
            stats: {
                views: r.stats?.views ?? null,
                likes: r.stats?.likes ?? null,
                comments: r.stats?.comments ?? null,
                shares: r.stats?.shares ?? null,
            },
            author: {
                id: r.author?.id != null ? String(r.author.id) : null,
                username: r.author?.username ?? null,
                fullname: r.author?.fullname ?? null,
                verified: r.author?.verified ?? false,
            },
        }

        return c.json({
            status: true,
            author: AUTHOR,
            result,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - startTime}ms`,
        }, 200)

    } catch (error) {
        console.error('[ARVO TWITTER]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
