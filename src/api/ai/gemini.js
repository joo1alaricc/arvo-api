// @arvo-endpoint {"category":"ai","slug":"gemini","name":"Gemini AI","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/ai/gemini'

const GeminiQuerySchema = z.object({
    text: z.string().min(1).openapi({
        example: 'halo apa kabar',
        description: 'Pertanyaan/prompt yang ingin dikirim ke Gemini AI.',
    }),
    session_id: z.string().optional().openapi({
        example: 'eyJjb29raWUiOiJfX1NlY3VyZS1FTklE...',
        description: 'Session ID dari respons sebelumnya (opsional). Isi untuk melanjutkan percakapan.',
    }),
})

export const geminiRoute = createRoute({
    method: 'get',
    path: '/api/ai/gemini',
    summary: "Gemini AI",
    tags: ['ai'],
    description: 'Chat dengan Gemini AI melalui Arvo API (mendukung session lanjutan).',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: GeminiQuerySchema,
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
                            session_id: z.string(),
                        }),
                        timestamp: z.string(),
                        response_time: z.string(),
                    }),
                },
            },
            description: 'Berhasil mendapatkan jawaban dari Gemini AI.',
        },
        400: {
            description: 'Parameter text tidak valid.',
        },
        502: {
            description: 'Gagal mengambil respons dari Gemini AI.',
        },
    },
})

const fail = (c, message, extra = {}) => c.json({
    status: false,
    author: AUTHOR,
    message,
    ...extra,
}, 502)

export const geminiHandler = async (c) => {
    const { text, session_id } = c.req.valid('query')
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
        // Bangun URL: session_id opsional
        let upstreamUrl = `${UPSTREAM}?text=${encodeURIComponent(text)}`
        if (session_id && session_id.trim()) {
            upstreamUrl += `&session_id=${encodeURIComponent(session_id.trim())}`
        }

        const response = await upstreamFetch(upstreamUrl, {
            method: 'GET',
            headers: { accept: 'application/json' },
            // AI bisa lama — kasih 60s
            signal: AbortSignal.timeout(60000),
        })

        const raw = await response.text()
        let data

        try {
            data = JSON.parse(raw)
        } catch {
            console.error('[ARVO GEMINI] INVALID JSON:', {
                status: response.status,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan JSON valid.', {
                upstream_status: response.status,
            })
        }

        if (!response.ok) {
            console.error('[ARVO GEMINI] UPSTREAM ERROR:', {
                status: response.status,
                body: data,
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        const r = data?.result
        if (
            !data?.status ||
            !r ||
            typeof r.text !== 'string' ||
            !r.text.trim() ||
            typeof r.session_id !== 'string'
        ) {
            console.error('[ARVO GEMINI] INVALID RESULT:', data)
            return fail(c, 'Gagal mendapatkan jawaban dari Gemini AI.', {
                upstream_message: data?.message,
            })
        }

        return c.json({
            status: true,
            author: AUTHOR,
            result: {
                text: r.text,
                session_id: r.session_id,
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - startTime}ms`,
        }, 200)

    } catch (error) {
        console.error('[ARVO GEMINI]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Scraper API timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
