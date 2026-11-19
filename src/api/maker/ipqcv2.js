// @arvo-endpoint {"category":"maker","slug":"ipqcv2","name":"iPhone Quoted V2","mode":"full"}
// src/routes/maker/iqc-v2.js
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/maker/v1/iqc'

const IqcV2QuerySchema = z.object({
    text: z.string().min(1).openapi({
        example: 'halo apa kabar',
        description: 'Teks yang ingin diubah menjadi gambar iPhone quoted (V2).',
    }),
    provider: z.string().optional().openapi({
        example: 'INDOSAT',
        description: 'Nama provider (opsional, mis. INDOSAT, TELKOMSEL, XL).',
    }),
    jam: z.string().optional().openapi({
        example: '12.30',
        description: 'Waktu yang ditampilkan (opsional, format HH.MM).',
    }),
    baterai: z.string().optional().openapi({
        example: '50',
        description: 'Persentase baterai (opsional, 0-100).',
    }),
})

export const iqcV2Route = createRoute({
    method: 'get',
    path: '/api/maker/ipqcv2',
    summary: "iPhone Quoted V2",
    tags: ['maker'],
    description: 'Generate gambar iPhone Quoted V2 melalui Arvo API (dengan opsi provider/jam/baterai).',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: IqcV2QuerySchema,
    },
    responses: {
        200: {
            content: {
                'image/*': { schema: z.any() },
            },
            description: 'Berhasil menghasilkan gambar iPhone Quoted V2.',
        },
        400: { description: 'Parameter text tidak valid.' },
        502: { description: 'Gagal mengambil gambar dari scraper.' },
    },
})

const fail = (c, message, extra = {}) => c.json({
    status: false,
    author: AUTHOR,
    message,
    ...extra,
}, 502)

export const iqcV2Handler = async (c) => {
    const { text, provider, jam, baterai } = c.req.valid('query')
    const startTime = Date.now()

    if (!text || !text.trim()) {
        return c.json({
            status: false,
            author: AUTHOR,
            message: 'Parameter "text" tidak boleh kosong.',
        }, 400)
    }

    try {
        // Bangun query params: hanya tambahkan yang diisi
        const params = new URLSearchParams({ text: text.trim() })
        if (provider && provider.trim()) params.set('provider', provider.trim())
        if (jam && jam.trim()) params.set('jam', jam.trim())
        if (baterai && baterai.trim()) params.set('baterai', baterai.trim())

        const response = await upstreamFetch(
            `${UPSTREAM}?${params.toString()}`,
            {
                method: 'GET',
                signal: AbortSignal.timeout(60000),
            }
        )

        const contentType = response.headers.get('content-type') || ''

        if (!response.ok) {
            const raw = await response.text()
            console.error('[ARVO IQC V2] UPSTREAM ERROR:', {
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
            console.error('[ARVO IQC V2] JSON RESPONSE:', data)
            return fail(c, 'iPhone Quoted V2 tidak mengembalikan gambar.', {
                upstream_message: data?.message ?? data,
            })
        }

        if (!contentType.startsWith('image/')) {
            const raw = await response.text()
            console.error('[ARVO IQC V2] NON-IMAGE RESPONSE:', {
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
        console.error('[ARVO IQC V2]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'iPhone Quoted V2 timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
