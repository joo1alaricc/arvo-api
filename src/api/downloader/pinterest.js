// @arvo-endpoint {"category":"downloader","slug":"pinterest","name":"Pinterest Downloader","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/downloader/pinterest'

const PinterestQuerySchema = z.object({
    url: z.string().url().openapi({
        example: 'https://pin.it/7tsO60BlQ',
        description: 'URL Pinterest (pin.it atau pinterest.com) — bisa video atau image.',
    }),
})

export const pinterestRoute = createRoute({
    method: 'get',
    path: '/api/downloader/pinterest',
    summary: "Pinterest Downloader",
    tags: ['downloader'],
    description: 'Downloader Pinterest (video & image) melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: PinterestQuerySchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.boolean(),
                        author: z.string(),
                        result: z.object({
                            type: z.enum(['video', 'image']),
                            title: z.string().nullable().optional(),
                            description: z.string().nullable().optional(),
                            taken_at: z.string().nullable().optional(),
                            thumbnail: z.string().url().nullable().optional(),
                            video: z.string().url().nullable().optional(),
                            image: z.string().url().nullable().optional(),
                            stats: z.object({
                                likes: z.number().nullable().optional(),
                                share: z.number().nullable().optional(),
                                comments: z.number().nullable().optional(),
                            }).optional(),
                            user: z.object({
                                fullname: z.string().nullable().optional(),
                                username: z.string().nullable().optional(),
                            }),
                        }),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan media Pinterest.',
        },
        400: {
            description: 'URL Pinterest tidak valid.',
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

export const pinterestHandler = async (c) => {
    const { url } = c.req.valid('query')
    const startTime = Date.now()

    // Validasi awal: pin.it atau pinterest.*
    if (!/^https?:\/\/(pin\.it|([a-z]{2,3}\.)?pinterest\.[a-z.]+)\//i.test(url)) {
        return c.json({
            status: false,
            author: AUTHOR,
            message: 'URL harus berupa link Pinterest (pin.it atau pinterest.com).',
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
            console.error('[ARVO PINTEREST] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO PINTEREST] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        const r = data?.result
        if (!data?.status || !r) {
            console.error('[ARVO PINTEREST] INVALID RESULT:', data)
            return fail(c, 'Gagal mendapatkan media Pinterest.', {
                upstream_message: data?.message,
            })
        }

        // Deteksi tipe: video kalau ada r.video, image kalau ada r.image / r.thumbnail
        const videoUrl = typeof r.video === 'string' && r.video.startsWith('https://') ? r.video : null
        const imageUrl =
            (typeof r.image === 'string' && r.image.startsWith('https://') && r.image) ||
            (typeof r.thumbnail === 'string' && r.thumbnail.startsWith('https://') && r.thumbnail) ||
            null

        let type = null
        if (videoUrl) type = 'video'
        else if (imageUrl) type = 'image'

        if (!type) {
            console.error('[ARVO PINTEREST] NO MEDIA:', r)
            return fail(c, 'Tidak ada media (video/image) valid dari scraper.')
        }

        const result = {
            type,
            title: r.title ?? null,
            description: r.description ?? null,
            taken_at: r.taken_at ?? null,
            thumbnail: r.thumbnail ?? null,
            video: videoUrl,
            image: type === 'image' ? imageUrl : null,
            stats: {
                likes: Number(r.stats?.likes) || 0,
                share: Number(r.stats?.share) || 0,
                comments: Number(r.stats?.comments) || 0,
            },
            user: {
                fullname: r.user?.fullname ?? null,
                username: r.user?.username ?? null,
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
        console.error('[ARVO PINTEREST]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
