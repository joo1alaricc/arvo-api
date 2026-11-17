// @arvo-endpoint {"category":"downloader","slug":"ytmp3","name":"YouTube MP3 Downloader","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/downloader/ytmp3'

const Ytmp3QuerySchema = z.object({
    url: z.string().url().openapi({
        example: 'https://youtu.be/P6sJq9cF9Ts',
        description: 'URL video YouTube yang ingin dikonversi menjadi MP3.',
    }),
})

export const ytmp3Route = createRoute({
    method: 'get',
    path: '/api/downloader/ytmp3',
    summary: "YouTube MP3 Downloader",
    tags: ['downloader'],
    description: 'Download audio YouTube dalam format MP3 melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: Ytmp3QuerySchema,
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
            description: 'Berhasil mendapatkan audio MP3 YouTube.',
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

export const ytmp3Handler = async (c) => {
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
            return fail(c, 'Gagal mendapatkan audio MP3 YouTube.')
        }

        /* Hasil upstream dikembalikan apa adanya; hanya author tingkat atas yang diganti. */
        const { author: _upstreamAuthor, ...rest } = data

        return c.json({
            status: rest.status,
            author: AUTHOR,
            ...rest,
        }, 200)

    } catch (error) {
        console.error('[ARVO YTMP3]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
