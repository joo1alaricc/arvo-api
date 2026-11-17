// @arvo-endpoint {"category":"downloader","slug":"spotify","name":"Spotify Downloader","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/downloader/spotify'

const SpotifyQuerySchema = z.object({
    url: z.string().url().openapi({
        example: 'https://open.spotify.com/track/5FbMnq1Yf5zEunUt0S0KtR',
        description: 'URL track Spotify yang ingin diunduh.',
    }),
})

export const spotifyRoute = createRoute({
    method: 'get',
    path: '/api/downloader/spotify',
    summary: "Spotify Downloader",
    tags: ['downloader'],
    description: 'Downloader track Spotify melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: SpotifyQuerySchema,
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
                            artist: z.string(),
                            url: z.string().url(),
                        }),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan track Spotify.',
        },
        400: {
            description: 'URL Spotify tidak valid.',
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

export const spotifyHandler = async (c) => {
    const { url } = c.req.valid('query')
    const startTime = Date.now()

    // Validasi awal: harus open.spotify.com (atau spotify.link short link)
    if (!/^https?:\/\/(open\.spotify\.com|spotify\.link)\//i.test(url)) {
        return c.json({
            status: false,
            author: AUTHOR,
            message: 'URL harus berupa link Spotify (open.spotify.com).',
        }, 400)
    }

    try {
        const response = await upstreamFetch(
            `${UPSTREAM}?url=${encodeURIComponent(url)}`,
            {
                method: 'GET',
                headers: { accept: 'application/json' },
                // Spotify lebih lambat — kasih 60s
                signal: AbortSignal.timeout(60000),
            }
        )

        const raw = await response.text()
        let data

        try {
            data = JSON.parse(raw)
        } catch {
            console.error('[ARVO SPOTIFY] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO SPOTIFY] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        const r = data?.result
        if (!data?.status || !r?.url || !r?.title) {
            console.error('[ARVO SPOTIFY] INVALID RESULT:', data)
            return fail(c, 'Gagal mendapatkan track Spotify.', {
                upstream_message: data?.message,
            })
        }

        const result = {
            title: r.title,
            artist: r.artist ?? 'Unknown',
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
        console.error('[ARVO SPOTIFY]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
