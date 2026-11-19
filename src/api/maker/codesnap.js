// @arvo-endpoint {"category":"maker","slug":"codesnap","name":"CodeSnap","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'

const AUTHOR = 'Arvo - Endpoint'
const UPSTREAM = 'https://api.nexray.eu.cc/maker/codesnap'

const CodesnapQuerySchema = z.object({
    code: z.string().min(1).openapi({
        example: 'console.log("Halo")',
        description: 'Kode yang ingin diubah menjadi gambar (codesnap).',
    }),
})

export const codesnapRoute = createRoute({
    method: 'get',
    path: '/api/maker/codesnap',
    summary: "CodeSnap",
    tags: ['maker'],
    description: 'Generate gambar dari potongan kode (codesnap) melalui Arvo API.',
    'x-status': 'ONLINE',
    'x-premium': false,
    'x-access': 'free',
    request: {
        query: CodesnapQuerySchema,
    },
    responses: {
        200: {
            content: {
                'image/*': {
                    schema: z.any(),
                },
            },
            description: 'Berhasil menghasilkan gambar codesnap.',
        },
        400: {
            description: 'Parameter code tidak valid.',
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

export const codesnapHandler = async (c) => {
    const { code } = c.req.valid('query')
    const startTime = Date.now()

    // Validasi awal: code nggak boleh kosong / cuma spasi
    if (!code || !code.trim()) {
        return c.json({
            status: false,
            author: AUTHOR,
            message: 'Parameter "code" tidak boleh kosong.',
        }, 400)
    }

    try {
        const response = await upstreamFetch(
            `${UPSTREAM}?code=${encodeURIComponent(code)}`,
            {
                method: 'GET',
                signal: AbortSignal.timeout(60000),
            }
        )

        const contentType = response.headers.get('content-type') || ''

        if (!response.ok) {
            const raw = await response.text()
            console.error('[ARVO CODESNAP] UPSTREAM ERROR:', {
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
            console.error('[ARVO CODESNAP] JSON RESPONSE:', data)
            return fail(c, 'CodeSnap tidak mengembalikan gambar.', {
                upstream_message: data?.message ?? data,
            })
        }

        // Kalau bukan image, anggap gagal
        if (!contentType.startsWith('image/')) {
            const raw = await response.text()
            console.error('[ARVO CODESNAP] NON-IMAGE RESPONSE:', {
                contentType,
                body: raw.slice(0, 1500),
            })
            return fail(c, 'Respons scraper bukan gambar.', {
                content_type: contentType,
            })
        }

        // Stream image langsung ke client
        const buffer = await response.arrayBuffer()

        if (!buffer || buffer.byteLength === 0) {
            return fail(c, 'Gambar dari scraper kosong.')
        }

        return c.body(buffer, 200, {
            'Content-Type': contentType, // biasanya image/png
            'Content-Length': String(buffer.byteLength),
            'Cache-Control': 'public, max-age=3600',
            'X-Response-Time': `${Date.now() - startTime}ms`,
            'X-Author': AUTHOR,
        })

    } catch (error) {
        console.error('[ARVO CODESNAP]', error)

        return fail(
            c,
            error?.name === 'TimeoutError'
                ? 'CodeSnap timeout.'
                : 'Terjadi kesalahan saat memproses permintaan.'
        )
    }
}
