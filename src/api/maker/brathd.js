// @arvo-endpoint {"category":"maker","slug":"brathd","name":"Brat HD","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/maker/brathd'

const BratHdQuerySchema = z.object({
    text: z.string().min(1).openapi({
        example: 'halo apa kabar',
        description: 'Teks yang ingin diubah menjadi gambar gaya Brat HD.',
    }),
})

export const bratHdRoute = createRoute({
    method: 'get',
    path: '/api/maker/brathd',
    summary: "Brat HD",
    tags: ['maker'],
    description: 'Generate gambar teks gaya Brat HD melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: BratHdQuerySchema,
    },
    responses: {
        200: {
            content: {
                'image/*': {
                    schema: z.any(),
                },
            },
            description: 'Berhasil menghasilkan gambar gaya Brat HD.',
        },
        400: {
            description: 'Parameter text tidak valid.',
        },
        502: {
            description: 'Gagal mengambil gambar dari scraper.',
        },
    },
})

const fail = (c, message, extra = {}) => c.json({
    status: false,
    author: AUTHOR,
    message,
    ...extra,
}, 502)

export const bratHdHandler = async (c) => {
    const { text } = c.req.valid('query')
    const startTime = Date.now()

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
                signal: AbortSignal.timeout(60000),
            }
        )

        const contentType = response.headers.get('content-type') || ''

        if (!response.ok) {
            const raw = await response.text()
            console.error('[ARVO BRATHD] UPSTREAM ERROR:', {
                status: response.status,
                contentType,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Scraper API sedang bermasalah.', {
                upstream_status: response.status,
            })
        }

        if (contentType.includes('application/json')) {
            const data = await response.json()
            console.error('[ARVO BRATHD] JSON RESPONSE:', data)
            return fail(c, 'Brat HD tidak mengembalikan gambar.', {
                upstream_message: data?.message ?? data,
            })
        }

        if (!contentType.startsWith('image/')) {
            const raw = await response.text()
            console.error('[ARVO BRATHD] NON-IMAGE RESPONSE:', {
                contentType,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan gambar.', {
                content_type: contentType,
            })
        }

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
        console.error('[ARVO BRATHD]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Brat HD timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
