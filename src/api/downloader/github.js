// @arvo-endpoint {"category":"downloader","slug":"github","name":"Github Downloader","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/downloader/github'

const GithubQuerySchema = z.object({
    url: z.string().url().openapi({
        example: 'https://github.com/rukamori/ArchiveTune',
        description: 'URL repository GitHub yang ingin diunduh sebagai ZIP.',
    }),
})

export const githubRoute = createRoute({
    method: 'get',
    path: '/api/downloader/github',
    summary: "Github Downloader",
    tags: ['downloader'],
    description: 'Downloader repository GitHub (ZIP) melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: GithubQuerySchema,
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
                            repo: z.string(),
                            branch: z.string(),
                            url: z.string().url(),
                        }),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan file ZIP repository GitHub.',
        },
        400: {
            description: 'URL GitHub tidak valid.',
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

export const githubHandler = async (c) => {
    const { url } = c.req.valid('query')
    const startTime = Date.now()

    // Validasi awal: harus URL github.com/<owner>/<repo>
    if (!/^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/i.test(url.replace(/\/+$/, ''))) {
        return c.json({
            status: false,
            author: AUTHOR,
            message: 'URL harus berupa repository GitHub (https://github.com/owner/repo).',
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
            console.error('[ARVO GITHUB] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO GITHUB] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        const r = data?.result
        if (!data?.status || !r?.url || !r?.filename) {
            console.error('[ARVO GITHUB] INVALID RESULT:', data)
            return fail(c, 'Gagal mendapatkan repository GitHub.', {
                upstream_message: data?.message,
            })
        }

        const result = {
            filename: r.filename,
            repo: r.repo ?? 'unknown',
            branch: r.branch ?? 'main',
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
        console.error('[ARVO GITHUB]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
