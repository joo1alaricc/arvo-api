// @arvo-endpoint {"category":"ai","slug":"claude","name":"Claude AI","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/ai/claude'

const ClaudeQuerySchema = z.object({
    text: z.string().min(1).openapi({
        example: 'halo apa kabar',
        description: 'Pertanyaan/prompt yang ingin dikirim ke Claude AI.',
    }),
})

export const claudeRoute = createRoute({
    method: 'get',
    path: '/api/ai/claude',
    summary: "Claude AI",
    tags: ['ai'],
    description: 'Chat dengan Claude AI melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: ClaudeQuerySchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.boolean(),
                        author: z.string(),
                        result: z.string(),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan jawaban dari Claude AI.',
        },
        400: {
            description: 'Parameter text tidak valid.',
        },
        502: {
            description: 'Gagal mengambil respons dari Claude AI.',
        },
    },
})

const fail = (c, message, extra = {}) => c.json({
    status: false,
    author: AUTHOR,
    message,
    ...extra,
}, 502)

export const claudeHandler = async (c) => {
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
                // AI bisa lama — kasih 60s
                signal: AbortSignal.timeout(60000),
            }
        )

        const raw = await response.text()
        let data

        try {
            data = JSON.parse(raw)
        } catch {
            console.error('[ARVO CLAUDE] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO CLAUDE] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        if (!data?.status || typeof data?.result !== 'string' || !data.result.trim()) {
            console.error('[ARVO CLAUDE] INVALID RESULT:', data)
            return fail(c, 'Gagal mendapatkan jawaban dari Claude AI.', {
                upstream_message: data?.message,
            })
        }

        return c.json({
            status: true,
            author: AUTHOR,
            result: data.result,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - startTime}ms`,
        }, 200)

    } catch (error) {
        console.error('[ARVO CLAUDE]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
