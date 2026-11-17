// @arvo-endpoint {"category":"downloader","slug":"applemusic","name":"Apple Music Downloader","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/downloader/applemusic'

const AppleMusicQuerySchema = z.object({
    url: z.string().url().openapi({
        example: 'https://music.apple.com/id/album/stop-the-wedding-single/6795697684',
        description: 'URL album/lagu Apple Music yang ingin diunduh.',
    }),
})

export const appleMusicRoute = createRoute({
    method: 'get',
    path: '/api/downloader/applemusic',
    summary: "Apple Music Downloader",
    tags: ['downloader'],
    description: 'Downloader album/lagu Apple Music melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: AppleMusicQuerySchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.boolean(),
                        author: z.string(),
                        result: z.object({
                            album_detail: z.object({
                                album: z.string(),
                                artist: z.string(),
                                thumbnail: z.string().url().nullable().optional(),
                                type: z.string(),
                                date: z.string().nullable().optional(),
                                count: z.number(),
                            }),
                            tracks: z.array(z.object({
                                name: z.string(),
                                artist: z.string(),
                                duration: z.string(),
                                thumbnail: z.string().url().nullable().optional(),
                                album: z.string(),
                                url: z.string().url(),
                            })),
                        }),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan data album/lagu Apple Music.',
        },
        400: {
            description: 'URL Apple Music tidak valid.',
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

const normalizeTrack = (t) => ({
    name: t.name ?? 'Unknown',
    artist: t.artist ?? 'Unknown',
    duration: t.duration ?? '-',
    thumbnail: t.thumbnail ?? null,
    album: t.album ?? 'Unknown',
    url: t.url,
})

export const appleMusicHandler = async (c) => {
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
            console.error('[ARVO APPLEMUSIC] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO APPLEMUSIC] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        const r = data?.result
        if (!data?.status || !r?.album_detail || !Array.isArray(r?.tracks)) {
            console.error('[ARVO APPLEMUSIC] INVALID RESULT:', data)
            return fail(c, 'Gagal mendapatkan data Apple Music.', {
                upstream_message: data?.message,
            })
        }

        const tracks = r.tracks
            .filter((t) => t && typeof t.url === 'string' && t.url.startsWith('https://'))
            .map(normalizeTrack)

        if (tracks.length === 0) {
            return fail(c, 'Tidak ada lagu valid dari scraper.')
        }

        const result = {
            album_detail: {
                album: r.album_detail.album ?? 'Unknown',
                artist: r.album_detail.artist ?? 'Unknown',
                thumbnail: r.album_detail.thumbnail ?? null,
                type: r.album_detail.type ?? 'album',
                date: r.album_detail.date ?? null,
                count: Number(r.album_detail.count) || tracks.length,
            },
            tracks,
        }

        return c.json({
            status: true,
            author: AUTHOR,
            result,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - startTime}ms`,
        }, 200)

    } catch (error) {
        console.error('[ARVO APPLEMUSIC]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
