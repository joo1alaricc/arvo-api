// @arvo-endpoint {"category":"ai","slug":"monica","name":"Monica AI","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/ai/monica'

const MonicaQuerySchema = z.object({
    text: z.string().min(1).openapi({
        example: 'halo apa kabar',
        description: 'Pertanyaan/prompt yang ingin dikirim ke Monica AI.',
    }),
})

export const monicaRoute = createRoute({
    method: 'get',
    path: '/api/ai/monica',
    summary: "Monica AI",
    tags: ['ai'],
    description: 'Chat dengan Monica AI (dengan sumber referensi) melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: MonicaQuerySchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.boolean(),
                        author: z.string(),
                        result: z.object({
                            text: z.string(),
                            sources: z.array(z.object({
                                id: z.string().nullable().optional(),
                                name: z.string().nullable().optional(),
                                url: z.string().url(),
                                display_url: z.string().nullable().optional(),
                                snippet: z.string().nullable().optional(),
                                language: z.string().nullable().optional(),
                                thumbnail_url: z.string().url().nullable().optional(),
                                website_name: z.string().nullable().optional(),
                            })),
                        }),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan jawaban dari Monica AI.',
        },
        400: {
            description: 'Parameter text tidak valid.',
        },
        502: {
            description: 'Gagal mengambil respons dari Monica AI.',
        },
    },
})

const fail = (c, message, extra = {}) => c.json({
    status: false,
    author: AUTHOR,
    message,
    ...extra,
}, 502)

export const monicaHandler = async (c) => {
    const { text } = c.req.valid('query')
    const startTime = Date.now()

    // Validasi awal: text nggak boleh kosong / cuma spasi
    if (!text || !text.trim()) {
        return c.json({
            status: false,
            author: AUTHOR,
            message: 'Parameter "text" tidak boleh kosong.',
        }, 400)
    }

    try {
        const response = await upstreamFetch(
            `${UPSTREAM}?text=${encodeURIComponent(text)}`,
            {
                method: 'GET',
                headers: { accept: 'application/json' },
                // AI + web search bisa lama (contoh ~8s) — kasih 60s
                signal: AbortSignal.timeout(60000),
            }
        )

        const raw = await response.text()
        let data

        try {
            data = JSON.parse(raw)
        } catch {
            console.error('[ARVO MONICA] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO MONICA] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        const r = data?.result
        if (!data?.status || !r || typeof r.text !== 'string' || !r.text.trim()) {
            console.error('[ARVO MONICA] INVALID RESULT:', data)
            return fail(c, 'Gagal mendapatkan jawaban dari Monica AI.', {
                upstream_message: data?.message,
            })
        }

        // Normalisasi sources: filter yang URL valid
        const sources = Array.isArray(r.sources)
            ? r.sources
                .filter((s) => s && typeof s.url === 'string' && s.url.startsWith('https://'))
                .map((s) => ({
                    id: s.id ?? null,
                    name: s.name ?? null,
                    url: s.url,
                    display_url: s.display_url ?? null,
                    snippet: s.snippet ?? null,
                    language: s.language ?? null,
                    thumbnail_url: s.thumbnail_url ?? null,
                    website_name: s.website_name ?? null,
                }))
            : []

        return c.json({
            status: true,
            author: AUTHOR,
            result: {
                text: r.text,
                sources,
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - startTime}ms`,
        }, 200)

    } catch (error) {
        console.error('[ARVO MONICA]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
