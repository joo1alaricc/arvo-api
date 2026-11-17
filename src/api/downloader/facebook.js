// @arvo-endpoint {"category":"downloader","slug":"facebook","name":"Facebook Downloader","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/downloader/facebook'

const FacebookQuerySchema = z.object({
    url: z.string().url().openapi({
        example: 'https://www.facebook.com/share/v/1BTQV692W8/',
        description: 'URL video Facebook yang ingin diunduh.',
    }),
})

export const facebookRoute = createRoute({
    method: 'get',
    path: '/api/downloader/facebook',
    summary: "Facebook Downloader",
    tags: ['downloader'],
    description: 'Downloader video Facebook melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: FacebookQuerySchema,
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
                            data: z.array(z.object({
                                type: z.string(),
                                thumbnail: z.string().url().nullable().optional(),
                                url: z.string().url(),
                            })),
                            stats: z.object({
                                views: z.string().nullable().optional(),
                                likes: z.string().nullable().optional(),
                            }).optional(),
                            audio: z.object({
                                title: z.string().nullable().optional(),
                                artist: z.string().nullable().optional(),
                                url: z.string().url().nullable().optional(),
                            }).nullable().optional(),
                            author: z.object({
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
            description: 'Berhasil mendapatkan video Facebook.',
        },
        400: {
            description: 'URL Facebook tidak valid.',
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

export const facebookHandler = async (c) => {
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
            console.error('[ARVO FACEBOOK] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO FACEBOOK] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        const r = data?.result
        if (!data?.status || !r || !Array.isArray(r.data) || r.data.length === 0) {
            console.error('[ARVO FACEBOOK] INVALID RESULT:', data)
            return fail(c, 'Gagal mendapatkan video Facebook.', {
                upstream_message: data?.message,
            })
        }

        const medias = r.data
            .filter((m) => m && typeof m.url === 'string' && m.url.startsWith('https://'))
            .map((m) => ({
                type: m.type ?? 'video',
                thumbnail: m.thumbnail ?? null,
                url: m.url,
            }))

        if (medias.length === 0) {
            return fail(c, 'Tidak ada media valid dari scraper.')
        }

        const result = {
            id: String(r.id ?? ''),
            title: r.title ?? null,
            taken_at: r.taken_at ?? null,
            duration: r.duration ?? null,
            data: medias,
            stats: {
                views: r.stats?.views ?? null,
                likes: r.stats?.likes ?? null,
            },
            audio: r.audio
                ? {
                    title: r.audio.title ?? null,
                    artist: r.audio.artist ?? null,
                    url: r.audio.url ?? null,
                }
                : null,
            author: {
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
        console.error('[ARVO FACEBOOK]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
