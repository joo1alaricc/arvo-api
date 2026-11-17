// @arvo-endpoint {"category":"downloader","slug":"aio","name":"All In Downloader","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/downloader/aio'

const AioQuerySchema = z.object({
    url: z.string().url().openapi({
        example: 'https://youtube.com/watch?v=ZYBWv4vCZKI',
        description: 'URL media (YouTube, TikTok, Instagram, dll) yang ingin diunduh.',
    }),
})

export const aioRoute = createRoute({
    method: 'get',
    path: '/api/downloader/aio',
    summary: "All In Downloader",
    tags: ['downloader'],
    description: 'Downloader all-in-one (YouTube, TikTok, Instagram, dll) melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: AioQuerySchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.boolean(),
                        author: z.string(),
                        result: z.object({
                            url: z.string(),
                            source: z.string(),
                            title: z.string(),
                            author: z.string().nullable().optional(),
                            thumbnail: z.string().url().nullable().optional(),
                            duration: z.number().nullable().optional(),
                            type: z.string().optional(),
                            medias: z.array(z.object({
                                itag: z.number().nullable().optional(),
                                url: z.string().url(),
                                mimeType: z.string().optional(),
                                quality: z.string().optional(),
                                label: z.string().optional(),
                                extension: z.string().optional(),
                                type: z.string().optional(),
                                is_audio: z.boolean().optional(),
                                width: z.number().nullable().optional(),
                                height: z.number().nullable().optional(),
                                bitrate: z.number().nullable().optional(),
                                contentLength: z.string().nullable().optional(),
                                qualityLabel: z.string().nullable().optional(),
                            }).passthrough()),
                        }),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan data media.',
        },
        400: {
            description: 'URL tidak valid.',
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

// Helper normalisasi media biar aman & konsisten
const normalizeMedia = (m) => ({
    itag: m.itag ?? null,
    url: m.url,
    mimeType: m.mimeType ?? null,
    quality: m.quality ?? m.qualityLabel ?? null,
    label: m.label ?? m.qualityLabel ?? null,
    extension: m.extension ?? null,
    type: m.type ?? null,
    is_audio: m.is_audio ?? false,
    width: m.width ?? null,
    height: m.height ?? null,
    bitrate: m.bitrate ?? null,
    contentLength: m.contentLength ?? null,
    qualityLabel: m.qualityLabel ?? null,
})

export const aioHandler = async (c) => {
    const { url } = c.req.valid('query')
    const startTime = Date.now()

    try {
        const response = await upstreamFetch(
            `${UPSTREAM}?url=${encodeURIComponent(url)}`,
            {
                method: 'GET',
                headers: { accept: 'application/json' },
                signal: AbortSignal.timeout(45000),
            }
        )

        const raw = await response.text()
        let data

        try {
            data = JSON.parse(raw)
        } catch {
            console.error('[ARVO AIO] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO AIO] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        const r = data?.result
        if (!data?.status || !r || !Array.isArray(r.medias) || r.medias.length === 0) {
            console.error('[ARVO AIO] INVALID RESULT:', data)
            return fail(c, 'Gagal mendapatkan data media.', {
                upstream_message: data?.message,
            })
        }

        const medias = r.medias
            .filter((m) => m && typeof m.url === 'string' && m.url.startsWith('https://'))
            .map(normalizeMedia)

        if (medias.length === 0) {
            return fail(c, 'Tidak ada media valid dari scraper.')
        }

        const result = {
            url: r.url,
            source: r.source ?? 'unknown',
            title: r.title ?? 'Untitled',
            author: r.author ?? null,
            thumbnail: r.thumbnail ?? null,
            duration: r.duration ?? null,
            type: r.type ?? 'multiple',
            medias,
        }

        return c.json({
            status: true,
            author: AUTHOR,
            result,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - startTime}ms`,
        }, 200)

    } catch (error) {
        console.error('[ARVO AIO]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
