// @arvo-endpoint {"category":"downloader","slug":"instagram","name":"Instagram Downloader","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/downloader/instagram'

const InstagramQuerySchema = z.object({
    url: z.string().url().openapi({
        example: 'https://www.instagram.com/reel/Df06gD5MiIu/',
        description: 'URL video atau reels Instagram yang ingin diunduh.',
    }),
})

export const instagramRoute = createRoute({
    method: 'get',
    path: '/api/downloader/instagram',
    summary: "Instagram Downloader",
    tags: ['downloader'],
    description: 'Download video Instagram melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: InstagramQuerySchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.boolean(),
                        author: z.string(),
                        result: z.any(),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan data media Instagram.',
        },
        400: {
            description: 'URL Instagram tidak valid.',
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

export const instagramHandler = async (c) => {
    const { url } = c.req.valid('query')

    try {
        const response = await upstreamFetch(
            `${UPSTREAM}?url=${encodeURIComponent(url)}`,
            {
                headers: { accept: 'application/json' },
                signal: AbortSignal.timeout(25000),
            }
        )

        const data = await response.json().catch(() => null)

        if (!response.ok || !data) {
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        if (!data.status || !data.result) {
            return fail(c, 'Gagal mendapatkan data media Instagram.')
        }

        /* Hasil upstream dikembalikan apa adanya; hanya author tingkat atas yang diganti. */
        const { author: _upstreamAuthor, ...rest } = data

        return c.json({
            status: rest.status,
            author: AUTHOR,
            ...rest,
        }, 200)

    } catch (error) {
        console.error('[ARVO INSTAGRAM]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
