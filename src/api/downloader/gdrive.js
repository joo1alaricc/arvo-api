// @arvo-endpoint {"category":"downloader","slug":"gdrive","name":"Google Drive Downloader","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/downloader/googledrive'

const GdriveQuerySchema = z.object({
    url: z.string().url().openapi({
        example: 'https://drive.google.com/file/d/1RyckJwbz1UHAcaCp70yiGh0LlKvjZydy/view?usp=drivesdk',
        description: 'URL file Google Drive yang ingin diunduh.',
    }),
})

export const gdriveRoute = createRoute({
    method: 'get',
    path: '/api/downloader/gdrive',
    summary: "Google Drive Downloader",
    tags: ['downloader'],
    description: 'Downloader file Google Drive melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: GdriveQuerySchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.boolean(),
                        author: z.string(),
                        result: z.object({
                            name: z.string(),
                            url: z.string().url(),
                        }),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan file Google Drive.',
        },
        400: {
            description: 'URL Google Drive tidak valid.',
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

export const gdriveHandler = async (c) => {
    const { url } = c.req.valid('query')
    const startTime = Date.now()

    // Validasi awal: harus URL drive.google.com
    if (!/^https?:\/\/drive\.google\.com\//i.test(url)) {
        return c.json({
            status: false,
            author: AUTHOR,
            message: 'URL harus berupa link Google Drive.',
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
            console.error('[ARVO GDRIVE] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO GDRIVE] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        const r = data?.result
        if (!data?.status || !r?.url || !r?.name) {
            console.error('[ARVO GDRIVE] INVALID RESULT:', data)
            return fail(c, 'Gagal mendapatkan file Google Drive.', {
                upstream_message: data?.message,
            })
        }

        const result = {
            name: r.name,
            url: r.url,
        }

        if (!result.url.startsWith('https://')) {
            return fail(c, 'URL download dari scraper tidak valid.')
        }

        return c.json({
            status: true,
            author: AUTHOR,
            result,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - startTime}ms`,
        }, 200)

    } catch (error) {
        console.error('[ARVO GDRIVE]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
