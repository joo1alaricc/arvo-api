// @arvo-endpoint {"category":"tools","slug":"upload","name":"Upload File","mode":"full"}
import { createRoute, z } from '@hono/zod-openapi'
import { upstreamFetch } from '../../utils/upstream.js'
import { store } from '../../utils/session.js'
import { saveFile, ttlOf, limitsOf, mimeExt } from '../uploader.js'

const AUTHOR = 'Arvo - Endpoint'
const DEFAULT_TTL = 30 * 86400   /* tanpa parameter expired: 30 hari (kirim expired=0 untuk permanen) */

const UploadBodySchema = z.object({
    url: z.string().optional().openapi({ example: 'https://example.com/foto.jpg', description: 'URL file yang diunggah ulang ke CDN Arvo. Kosongkan kalau mengirim file langsung (multipart field "file").' }),
    name: z.string().optional().openapi({ example: 'foto.jpg', description: 'Nama file (menentukan ekstensi). Opsional kalau URL sudah berekstensi.' }),
    expired: z.union([z.string(), z.number()]).optional().openapi({ example: '3600', description: 'Masa berlaku: detik atau 30m, 12h, 7d, 2w, 1y. 0 = permanen. Default 30d. (Nama lama "ttl" masih diterima.)' }),
})

export const uploadRoute = createRoute({
    method: 'post',
    path: '/api/upload',
    summary: 'Upload File',
    tags: ['tools'],
    description: 'Unggah file (gambar, video, audio, PDF, dokumen, zip, teks, maks 25 MB) ke CDN Arvo dan dapatkan link publiknya. Kirim sebagai multipart/form-data (field "file"), body mentah (?name=foto.jpg), atau JSON {"url": "..."} untuk mengunggah ulang dari URL. Khusus Premium ke atas.',
    'x-status': 'ONLINE',
    'x-premium': true,
    'x-access': 'premium',
    /* Tampilan Playground: pilih file (multipart) + expired. Hanya dokumentasi; validator tetap JSON saja agar file besar tidak diparse dua kali. */
    'x-form': [
        { name: 'file', type: 'file', required: true, description: 'File yang diunggah (maks 25 MB).' },
        { name: 'expired', required: false, example: '3600', description: 'Masa berlaku: detik atau 30m, 12h, 7d, 2w, 1y. 0 = permanen. Kosong = 30 hari.' },
    ],
    request: { body: { required: false, content: { 'application/json': { schema: UploadBodySchema } } } },
    responses: {
        200: {
            content: { 'application/json': { schema: z.object({
                status: z.boolean(), author: z.string(),
                result: z.object({ id: z.number(), key: z.string(), name: z.string(), size: z.number(), mime: z.string(), url: z.string().url(), expires_at: z.string().nullable() }),
                timestamp: z.string(), response_time: z.string(),
            }) } },
            description: 'File berhasil diunggah.',
        },
        400: { description: 'Input tidak valid.' }, 413: { description: 'File terlalu besar.' }, 415: { description: 'Tipe file tidak didukung.' }, 429: { description: 'Kuota penuh.' },
    },
})

/* Ambil file dari URL (http/https, bukan IP/localhost) dengan batas ukuran. */
const fetchRemote = async (raw, max) => {
    let u; try { u = new URL(raw) } catch { return { status: 400, message: 'URL tidak valid.' } }
    const h = u.hostname.toLowerCase()
    if (!/^https?:$/.test(u.protocol) || h === 'localhost' || /^[\d.]+$/.test(h) || h.includes(':') || /\.(local|internal|lan)$/.test(h)) return { status: 400, message: 'URL tidak diizinkan.' }
    let r
    try { r = await upstreamFetch(u.href, { redirect: 'follow', signal: AbortSignal.timeout(25000) }) } catch { return { status: 502, message: 'Gagal mengunduh dari URL.' } }
    if (!r.ok) return { status: 502, message: `URL mengembalikan status ${r.status}.` }
    if (parseInt(r.headers.get('content-length') || '0', 10) > max) return { status: 413, message: `File terlalu besar (maks ${max / 1048576} MB).` }
    const chunks = []; let total = 0
    const rd = r.body.getReader()
    for (;;) {
        const { done, value } = await rd.read()
        if (done) break
        total += value.byteLength
        if (total > max) { try { await rd.cancel() } catch {} return { status: 413, message: `File terlalu besar (maks ${max / 1048576} MB).` } }
        chunks.push(value)
    }
    const buf = new Uint8Array(total); let o = 0
    for (const ch of chunks) { buf.set(ch, o); o += ch.byteLength }
    const cd = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(r.headers.get('content-disposition') || '')
    let name = cd ? decodeURIComponent(cd[1]) : decodeURIComponent(u.pathname.split('/').pop() || '')
    if (!/\.[A-Za-z0-9]{1,5}$/.test(name)) { const e = mimeExt(r.headers.get('content-type')); name = (name || 'file').replace(/\.+$/, '') + (e ? '.' + e : '') }
    return { buf: buf.buffer, name }
}

export const uploadHandler = async (c) => {
    const start = Date.now()
    const fail = (status, message) => c.json({ status: false, author: AUTHOR, message }, status)
    const { max } = limitsOf(c)
    const q = c.req.query(), ct = (c.req.header('content-type') || '').toLowerCase()
    let name = q.name, ttlRaw = q.expired ?? q.ttl, url = q.url, buf = null
    try {
        if (ct.includes('multipart/form-data')) {
            if (parseInt(c.req.header('content-length') || '0', 10) > max + 65536) return fail(413, `File terlalu besar (maks ${max / 1048576} MB).`)
            const f = await c.req.formData(), file = f.get('file')
            if (!file || typeof file === 'string') return fail(400, 'Field "file" wajib berisi file.')
            name = String(f.get('name') || file.name || name || ''); ttlRaw = f.get('expired') ?? f.get('ttl') ?? ttlRaw; url = null
            buf = await file.arrayBuffer()
        } else if (ct.includes('application/json')) {
            const b = await c.req.json().catch(() => ({}))
            url = b.url ?? url; name = b.name ?? name; ttlRaw = b.expired ?? b.ttl ?? ttlRaw
        } else if (!url) {
            if (parseInt(c.req.header('content-length') || '0', 10) > max) return fail(413, `File terlalu besar (maks ${max / 1048576} MB).`)
            buf = await c.req.arrayBuffer()
        }
    } catch { return fail(400, 'Body permintaan tidak bisa dibaca.') }

    const ttl = ttlRaw == null || ttlRaw === '' ? DEFAULT_TTL : ttlOf(ttlRaw)
    if (ttl < 0) return fail(400, 'expired harus antara 1 menit dan 365 hari (contoh: 30m, 12h, 7d, 1y), atau 0 untuk permanen.')
    if (!buf) {
        if (!url) return fail(400, 'Kirim file (multipart field "file", atau body mentah dengan ?name=) atau JSON {"url": "..."}.')
        const r = await fetchRemote(url, max)
        if (!r.buf) return fail(r.status, r.message)
        buf = r.buf; name = name || r.name
    }
    if (!name) return fail(400, 'Nama file wajib diisi (parameter name) supaya ekstensinya diketahui.')

    const key = (c.req.header('x-api-key') || c.req.query('apikey') || '').trim()
    const uid = key ? await store(c).uidByKey(key).catch(() => 0) : 0   /* access key admin tidak punya akun: dicatat sebagai pemilik 0 */
    const r = await saveFile(c, uid, name, buf, ttl)
    if (!r.ok) return fail(r.status, r.message)
    const d = r.data
    return c.json({
        status: true, author: AUTHOR,
        result: { id: d.id, key: d.key, name: d.name, size: d.size, mime: d.mime, url: d.url, expires_at: d.expires_at ? new Date(d.expires_at).toISOString() : null },
        timestamp: new Date().toISOString(), response_time: `${Date.now() - start}ms`,
    }, 200)
}
