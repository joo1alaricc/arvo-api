// @arvo-endpoint {"category":"ai","slug":"flux","name":"Flux AI","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/ai/v1/flux'

const FluxQuerySchema = z.object({
    prompt: z.string().min(1).openapi({
        example: 'a black cat',
        description: 'Prompt teks untuk menghasilkan gambar dengan Flux AI.',
    }),
})

export const fluxRoute = createRoute({
    method: 'get',
    path: '/api/ai/flux',
    summary: "Flux AI",
    tags: ['ai'],
    description: 'Generate gambar dengan Flux AI melalui Arvo API (langsung mengembalikan gambar).',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: FluxQuerySchema,
    },
    responses: {
        200: {
            content: {
                'image/*': {
                    schema: z.any(),
                },
            },
            description: 'Berhasil menghasilkan gambar dari Flux AI.',
        },
        400: {
            description: 'Parameter prompt tidak valid.',
        },
        502: {
            description: 'Gagal mengambil gambar dari Flux AI.',
        },
    },
})

const fail = (c, message, extra = {}) => c.json({
    status: false,
    author: AUTHOR,
    message,
    ...extra,
}, 502)

export const fluxHandler = async (c) => {
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
                // Flux bisa lama generate gambar — kasih 90s
                signal: AbortSignal.timeout(90000),
            }
        )

        // Ambil content-type dari upstream
        const contentType = response.headers.get('content-type') || ''

        if (!response.ok) {
            const raw = await response.text()
            console.error('[ARVO FLUX] UPSTREAM ERROR:', {
                status: response.status,
                contentType,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        // Kalau upstream ngembaliin JSON (error/message), balikin sebagai error
        if (contentType.includes('application/json')) {
            const data = await response.json()
            console.error('[ARVO FLUX] JSON RESPONSE:', data)
            return fail(c, 'Flux AI tidak mengembalikan gambar.', {
                upstream_message: data?.message ?? data,
            })
        }

        // Kalau bukan image, anggap gagal
        if (!contentType.startsWith('image/')) {
            const raw = await response.text()
            console.error('[ARVO FLUX] NON-IMAGE RESPONSE:', {
                contentType,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan gambar.', {
                content_type: contentType,
            })
        }

        // Stream gambar langsung ke client
        const buffer = await response.arrayBuffer()

        if (!buffer || buffer.byteLength === 0) {
            return fail(c, 'Gambar dari scraper kosong.')
        }

        return c.body(buffer, 200, {
            'Content-Type': contentType,
            'Content-Length': String(buffer.byteLength),
            'Cache-Control': 'public, max-age=3600',
            'X-Response-Time': `${Date.now() - startTime}ms`,
            'X-Author': AUTHOR,
        })

    } catch (error) {
        console.error('[ARVO FLUX]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Flux AI timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
