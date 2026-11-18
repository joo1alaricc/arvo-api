// @arvo-endpoint {"category":"ai","slug":"epsilon","name":"Epsilon AI","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/ai/epsilon'

const EpsilonQuerySchema = z.object({
    text: z.string().min(1).openapi({
        example: 'jakarta',
        description: 'Kata kunci/topik pencarian paper (mis. "jakarta", "machine learning").',
    }),
})

export const epsilonRoute = createRoute({
    method: 'get',
    path: '/api/ai/epsilon',
    summary: "Epsilon AI",
    tags: ['ai'],
    description: 'Cari paper/jurnal akademik dengan Epsilon AI melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: EpsilonQuerySchema,
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
                            authors: z.string().nullable().optional(),
                            year: z.number().nullable().optional(),
                            url: z.string().url(),
                            abstract: z.string().nullable().optional(),
                        })),
                        total: z.number(),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan daftar paper dari Epsilon AI.',
        },
        400: {
            description: 'Parameter text tidak valid.',
        },
        502: {
            description: 'Gagal mengambil hasil dari Epsilon AI.',
        },
    },
})

const fail = (c, message, extra = {}) => c.json({
    status: false,
    author: AUTHOR,
    message,
    ...extra,
}, 502)

export const epsilonHandler = async (c) => {
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
                // Pencarian paper bisa lama — 60s
                signal: AbortSignal.timeout(60000),
            }
        )

        const raw = await response.text()
        let data

        try {
            data = JSON.parse(raw)
        } catch {
            console.error('[ARVO EPSILON] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO EPSILON] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        if (!data?.status || !Array.isArray(data?.result)) {
            console.error('[ARVO EPSILON] INVALID RESULT:', data)
            return fail(c, 'Gagal mendapatkan hasil dari Epsilon AI.', {
                upstream_message: data?.message,
            })
        }

        // Normalisasi + filter paper valid
        const papers = data.result
            .filter((p) => p && typeof p.url === 'string' && p.url.startsWith('https://'))
            .map((p) => ({
                title: p.title ?? 'Untitled',
                authors: p.authors ?? null,
                year: p.year != null ? Number(p.year) : null,
                url: p.url,
                abstract: p.abstract ?? null,
            }))

        if (papers.length === 0) {
            return fail(c, 'Tidak ada paper valid dari scraper.')
        }

        return c.json({
            status: true,
            author: AUTHOR,
            result: papers,
            total: papers.length,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - startTime}ms`,
        }, 200)

    } catch (error) {
        console.error('[ARVO EPSILON]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
