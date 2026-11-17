// @arvo-endpoint {"category":"downloader","slug":"ytmp4","name":"YouTube MP4 Downloader","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.izzxd.my.id/api/downloader/ytmp4'
const API_KEY = 'izzxd-6bb3smh'

const Ytmp4QuerySchema = z.object({
    url: z.string().url().openapi({
        example: 'https://youtu.be/P6sJq9cF9Ts',
        description: 'URL video YouTube yang ingin diunduh menjadi MP4.',
    }),
})

export const ytmp4Route = createRoute({
    method: 'get',
    path: '/api/downloader/ytmp4',
    summary: "YouTube MP4 Downloader",
    tags: ['downloader'],
    description: 'Download video YouTube dalam format MP4 melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: Ytmp4QuerySchema,
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
                            duration: z.number(),
                            filesize: z.number(),
                            url: z.string().url(),
                        }),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan video MP4 YouTube.',
        },
        400: {
            description: 'URL YouTube tidak valid.',
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

export const ytmp4Handler = async (c) => {
    const { url } = c.req.valid('query')
    const startTime = Date.now()

    try {
        const response = await upstreamFetch(
            `${UPSTREAM}?url=${encodeURIComponent(url)}&apikey=${encodeURIComponent(API_KEY)}`,
            {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                },
                signal: AbortSignal.timeout(40000),
            }
        )

        const raw = await response.text()

        let data

        try {
            data = JSON.parse(raw)
        } catch {
            console.error('[ARVO YTMP4] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })

            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO YTMP4] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })

            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        if (!data?.status || !data?.result?.download_url) {
            console.error('[ARVO YTMP4] INVALID RESULT:', data)

            return fail(c, 'Gagal mendapatkan video MP4 YouTube.')
        }

        const result = {
            title: data.result.title,
            duration: Number(data.result.duration_seconds) || 0,
            filesize: Number(data.result.size_bytes) || 0,
            url: data.result.download_url,
        }

        if (!result.title || !result.url.startsWith('https://')) {
            return fail(c, 'Data video dari scraper tidak valid.')
        }

        return c.json({
            status: true,
            author: AUTHOR,
            result,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - startTime}ms`,
        }, 200)

    } catch (error) {
        console.error('[ARVO YTMP4]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
