// @arvo-endpoint {"category":"maker","slug":"attp","name":"ATTP","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/maker/attp'

const AttpQuerySchema = z.object({
    text: z.string().min(1).openapi({
        example: 'halo apa kabar',
        description: 'Teks yang ingin diubah menjadi GIF animasi (ATTP).',
    }),
})

export const attpRoute = createRoute({
    method: 'get',
    path: '/api/maker/attp',
    summary: "ATTP",
    tags: ['maker'],
    description: 'Generate GIF animasi teks (ATTP) melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: AttpQuerySchema,
    },
    responses: {
        200: {
            content: {
                'image/gif': {
                    schema: z.any(),
                },
            },
            description: 'Berhasil menghasilkan GIF animasi teks.',
        },
        400: {
            description: 'Parameter text tidak valid.',
        },
        502: {
            description: 'Gagal mengambil GIF dari scraper.',
        },
    },
})

const fail = (c, message, extra = {}) => c.json({
    status: false,
    author: AUTHOR,
    message,
    ...extra,
}, 502)

export const attpHandler = async (c) => {
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
                // GIF generation bisa lama — kasih 60s
                signal: AbortSignal.timeout(60000),
            }
        )

        const contentType = response.headers.get('content-type') || ''

        if (!response.ok) {
            const raw = await response.text()
            console.error('[ARVO ATTP] UPSTREAM ERROR:', {
                status: response.status,
                contentType,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        // Kalau upstream balikin JSON (error/message), balikin sebagai error
        if (contentType.includes('application/json')) {
            const data = await response.json()
            console.error('[ARVO ATTP] JSON RESPONSE:', data)
            return fail(c, 'ATTP tidak mengembalikan GIF.', {
                upstream_message: data?.message ?? data,
            })
        }

        // Kalau bukan image (gif/png/webp), anggap gagal
        if (!contentType.startsWith('image/')) {
            const raw = await response.text()
            console.error('[ARVO ATTP] NON-IMAGE RESPONSE:', {
                contentType,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan gambar.', {
                content_type: contentType,
            })
        }

        // Stream GIF langsung ke client
        const buffer = await response.arrayBuffer()

        if (!buffer || buffer.byteLength === 0) {
            return fail(c, 'GIF dari scraper kosong.')
        }

        return c.body(buffer, 200, {
            'Content-Type': contentType, // biasanya image/gif
            'Content-Length': String(buffer.byteLength),
            'Cache-Control': 'public, max-age=3600',
            'X-Response-Time': `${Date.now() - startTime}ms`,
            'X-Author': AUTHOR,
        })

    } catch (error) {
        console.error('[ARVO ATTP]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'ATTP timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
