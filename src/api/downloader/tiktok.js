
import { createRoute, z } from '@hono/zod-openapi'

const TikTokQuerySchema = z.object({
    url: z.string().url().openapi({
        example: 'https://vt.tiktok.com/ZSpb9Vn8u/',
        description: 'URL video TikTok yang ingin diunduh.',
    }),
})

export const tiktokRoute = createRoute({
    method: 'get',
    path: '/api/tiktok',
    tags: ['downloader'],
    description: 'Download video TikTok tanpa watermark melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: TikTokQuerySchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.boolean(),
                        creator: z.string(),
                        result: z.any(),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan data video TikTok.',
        },
        400: {
            description: 'URL TikTok tidak valid.',
        },
        502: {
            description: 'Gagal mengambil data dari scraper.',
        },
    },
})

export const tiktokHandler = async (c) => {
    const { url } = c.req.valid('query')

    try {
        const start = Date.now()

        const response = await fetch(
            `https://api-faa.my.id/faa/tiktok?url=${encodeURIComponent(url)}`
        )

        if (!response.ok) {
            return c.json({
                status: false,
                creator: 'Arvo',
                message: 'Scraper API sedang bermasalah.',
            }, 502)
        }

        const data = await response.json()

        if (!data.status || !data.result) {
            return c.json({
                status: false,
                creator: 'Arvo',
                message: 'Gagal mendapatkan data video TikTok.',
            }, 502)
        }

        return c.json({
            ...data,
            creator: 'Arvo',
            response_time: `${Date.now() - start}ms`,
        }, 200)

    } catch (error) {
        console.error('[ARVO TIKTOK]', error)

        return c.json({
            status: false,
            creator: 'Arvo',
            message: 'Terjadi kesalahan saat memproses permintaan.',
        }, 502)
    }
}

