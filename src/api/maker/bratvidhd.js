// @arvo-endpoint {"category":"maker","slug":"bratvidhd","name":"Brat Video HD","mode":"full"}
// src/routes/maker/bratvidhd.js
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/maker/bratvidhd'

const BratVidHdQuerySchema = z.object({
    text: z.string().min(1).openapi({
        example: 'halo apa kabar',
        description: 'Teks yang ingin diubah menjadi video/GIF gaya Brat HD.',
    }),
})

export const bratVidHdRoute = createRoute({
    method: 'get',
    path: '/api/maker/bratvidhd',
    summary: "Brat Video HD",
    tags: ['maker'],
    description: 'Generate video/GIF teks gaya Brat HD melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: BratVidHdQuerySchema,
    },
    responses: {
        200: {
            content: {
                'image/*': { schema: z.any() },
                'video/*': { schema: z.any() },
            },
            description: 'Berhasil menghasilkan video/GIF gaya Brat HD.',
        },
        400: { description: 'Parameter text tidak valid.' },
        502: { description: 'Gagal mengambil media dari scraper.' },
    },
})

const fail = (c, message, extra = {}) => c.json({
    status: false,
    author: AUTHOR,
    message,
    ...extra,
}, 502)

export const bratVidHdHandler = async (c) => {
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
                signal: AbortSignal.timeout(90000),
            }
        )

        const contentType = response.headers.get('content-type') || ''

        if (!response.ok) {
            const raw = await response.text()
            console.error('[ARVO BRATVIDHD] UPSTREAM ERROR:', {
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
            console.error('[ARVO BRATVIDHD] JSON RESPONSE:', data)
            return fail(c, 'Brat Video HD tidak mengembalikan media.', {
                upstream_message: data?.message ?? data,
            })
        }

        const isMedia =
            contentType.startsWith('image/') ||
            contentType.startsWith('video/') ||
            contentType === 'application/octet-stream'

        if (!isMedia) {
            const raw = await response.text()
            console.error('[ARVO BRATVIDHD] NON-MEDIA RESPONSE:', {
                contentType,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan media.', {
                content_type: contentType,
            })
        }

        const buffer = await response.arrayBuffer()

        if (!buffer || buffer.byteLength === 0) {
            return fail(c, 'Media dari scraper kosong.')
        }

        return c.body(buffer, 200, {
            'Content-Type': contentType,
            'Content-Length': String(buffer.byteLength),
            'Cache-Control': 'public, max-age=3600',
            'X-Response-Time': `${Date.now() - startTime}ms`,
            'X-Author': AUTHOR,
        })

    } catch (error) {
        console.error('[ARVO BRATVIDHD]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'Brat Video HD timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
