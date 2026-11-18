// @arvo-endpoint {"category":"ai","slug":"sologo","name":"Sologo AI","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/ai/sologo'

const SologoQuerySchema = z.object({
    prompt: z.string().min(1).openapi({
        example: 'a black cat',
        description: 'Prompt teks untuk menghasilkan logo dengan Sologo AI.',
    }),
})

export const sologoRoute = createRoute({
    method: 'get',
    path: '/api/ai/sologo',
    summary: "Sologo AI",
    tags: ['ai'],
    description: 'Generate logo dengan Sologo AI melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: SologoQuerySchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.boolean(),
                        author: z.string(),
                        result: z.array(z.object({
                            title: z.string(),
                            desc: z.string().nullable().optional(),
                            thumbnail: z.string().url(),
                            logo_type: z.string().nullable().optional(),
                        })),
                        total: z.number(),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil menghasilkan logo dari Sologo AI.',
        },
        400: {
            description: 'Parameter prompt tidak valid.',
        },
        502: {
            description: 'Gagal mengambil logo dari Sologo AI.',
        },
    },
})

const fail = (c, message, extra = {}) => c.json({
    status: false,
    author: AUTHOR,
    message,
    ...extra,
}, 502)

export const sologoHandler = async (c) => {
    const { prompt } = c.req.valid('query')
    const startTime = Date.now()

    // Validasi awal: prompt nggak boleh kosong / cuma spasi
    if (!prompt || !prompt.trim()) {
        return c.json({
            status: false,
            author: AUTHOR,
            message: 'Parameter "prompt" tidak boleh kosong.',
        }, 400)
    }

    try {
        const response = await upstreamFetch(
            `${UPSTREAM}?prompt=${encodeURIComponent(prompt)}`,
            {
                method: 'GET',
                headers: { accept: 'application/json' },
                // Generate logo bisa lama (contoh ~20s) — kasih 90s
                signal: AbortSignal.timeout(90000),
            }
        )

        const raw = await response.text()
        let data

        try {
            data = JSON.parse(raw)
        } catch {
            console.error('[ARVO SOLOGO] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO SOLOGO] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        if (!data?.status || !Array.isArray(data?.result)) {
            console.error('[ARVO SOLOGO] INVALID RESULT:', data)
            return fail(c, 'Gagal mendapatkan logo dari Sologo AI.', {
                upstream_message: data?.message,
            })
        }

        // Normalisasi + filter logo yang thumbnail-nya valid
        const logos = data.result
            .filter((l) => l && typeof l.thumbnail === 'string' && l.thumbnail.startsWith('https://'))
            .map((l) => ({
                title: l.title ?? 'Untitled',
                desc: l.desc ?? null,
                thumbnail: l.thumbnail,
                logo_type: l.logo_type ?? null,
            }))

        if (logos.length === 0) {
            return fail(c, 'Tidak ada logo valid dari scraper.')
        }

        return c.json({
            status: true,
            author: AUTHOR,
            result: logos,
            total: logos.length,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - startTime}ms`,
        }, 200)

    } catch (error) {
        console.error('[ARVO SOLOGO]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Sologo AI timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
