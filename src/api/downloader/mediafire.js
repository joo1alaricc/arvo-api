// @arvo-endpoint {"category":"downloader","slug":"mediafire","name":"MediaFire Download","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/downloader/mediafire'

const MediafireQuerySchema = z.object({
    url: z.string().url().openapi({
        example: 'https://www.mediafire.com/file/dbrsuuuklgphxym/Auralys-4.3.1.apk/file?dkey=bshvcgm1ad1&r=1587',
        description: 'URL file MediaFire yang ingin diunduh.',
    }),
})

export const mediafireRoute = createRoute({
    method: 'get',
    path: '/api/downloader/mediafire',
    summary: "MediaFire Download",
    tags: ['downloader'],
    description: 'Downloader file MediaFire melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: MediafireQuerySchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.boolean(),
                        author: z.string(),
                        result: z.object({
                            filename: z.string(),
                            filesize: z.string(),
                            filesize_bytes: z.number(),
                            extension: z.string().nullable().optional(),
                            mimetype: z.string().nullable().optional(),
                            uploaded: z.string().nullable().optional(),
                            download_url: z.string().url(),
                        }),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan file MediaFire.',
        },
        400: {
            description: 'URL MediaFire tidak valid.',
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

export const mediafireHandler = async (c) => {
    const { url } = c.req.valid('query')
    const startTime = Date.now()

    // Validasi awal: harus URL mediafire.com
    if (!/^https?:\/\/(www\.)?mediafire\.com\//i.test(url)) {
        return c.json({
            status: false,
            author: AUTHOR,
            message: 'URL harus berupa link MediaFire.',
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
            console.error('[ARVO MEDIAFIRE] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO MEDIAFIRE] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        const r = data?.result
        if (!data?.status || !r?.download_url || !r?.filename) {
            console.error('[ARVO MEDIAFIRE] INVALID RESULT:', data)
            return fail(c, 'Gagal mendapatkan file MediaFire.', {
                upstream_message: data?.message,
            })
        }

        const result = {
            filename: r.filename,
            filesize: r.filesize ?? '-',
            filesize_bytes: Number(r.filesize_bytes) || 0,
            extension: r.extension ?? null,
            mimetype: r.mimetype ?? null,
            uploaded: r.uploaded ?? null,
            download_url: r.download_url,
        }

        if (!result.download_url.startsWith('https://')) {
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
        console.error('[ARVO MEDIAFIRE]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
