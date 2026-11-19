// @arvo-endpoint {"category":"maker","slug":"qc","name":"Quick Chat","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/maker/qc'

const QuickchatQuerySchema = z.object({
    text: z.string().min(1).openapi({
        example: 'halo apa kabar',
        description: 'Isi pesan chat (wajib).',
    }),
    name: z.string().min(1).openapi({
        example: 'arvo',
        description: 'Nama pengirim chat (wajib).',
    }),
    avatar: z.string().url().openapi({
        example: 'https://i.pinimg.com/736x/81/57/49/815749f7111a7c5bb91cb64758ae5f42.jpg',
        description: 'URL avatar pengirim chat (wajib, harus https).',
    }),
    color: z.string().min(1).openapi({
        example: 'putih',
        description: 'Warna bubble chat (wajib, mis. putih, biru, hijau).',
    }),
})

export const quickchatRoute = createRoute({
    method: 'get',
    path: '/api/maker/qc',
    summary: "Quick Chat",
    tags: ['maker'],
    description: 'Generate gambar QuickChat melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: QuickchatQuerySchema,
    },
    responses: {
        200: {
            content: {
                'image/webp': { schema: z.any() },
                'image/*': { schema: z.any() },
            },
            description: 'Berhasil menghasilkan gambar QuickChat (WebP).',
        },
        400: {
            description: 'Parameter tidak valid / ada yang kosong.',
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

export const quickchatHandler = async (c) => {
    const { text, name, avatar, color } = c.req.valid('query')
    const startTime = Date.now()

    // Validasi semua field wajib (jaga-jaga kalau schema dilonggarin)
    if (!text?.trim() || !name?.trim() || !avatar?.trim() || !color?.trim()) {
        return c.json({
            status: false,
            author: AUTHOR,
            message: 'Parameter "text", "name", "avatar", dan "color" wajib diisi.',
        }, 400)
    }

    // Avatar wajib https
    if (!avatar.startsWith('https://')) {
        return c.json({
            status: false,
            author: AUTHOR,
            message: 'Parameter "avatar" harus berupa URL https.',
        }, 400)
    }

    try {
        const params = new URLSearchParams({
            text: text.trim(),
            name: name.trim(),
            avatar: avatar.trim(),
            color: color.trim(),
        })

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
            console.error('[ARVO QUICKCHAT] UPSTREAM ERROR:', {
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
            console.error('[ARVO QUICKCHAT] JSON RESPONSE:', data)
            return fail(c, 'QuickChat tidak mengembalikan gambar.', {
                upstream_message: data?.message ?? data,
            })
        }

        if (!contentType.startsWith('image/')) {
            const raw = await response.text()
            console.error('[ARVO QUICKCHAT] NON-IMAGE RESPONSE:', {
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
            'Content-Type': contentType || 'image/webp',
            'Content-Length': String(buffer.byteLength),
            'Cache-Control': 'public, max-age=3600',
            'X-Response-Time': `${Date.now() - startTime}ms`,
            'X-Author': AUTHOR,
        })

    } catch (error) {
        console.error('[ARVO QUICKCHAT]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'QuickChat timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
