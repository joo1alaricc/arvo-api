import { Hono } from 'hono'
import { store } from '../utils/session.js'

/* Tools › Uploader (Cloudflare KV, tanpa R2/kartu).
 * - File disimpan di KV (binding UPLOADS) dengan expirationTtl, jadi kedaluwarsa dihapus otomatis oleh Cloudflare.
 * - Metadata (nama, ukuran, kedaluwarsa, pemilik) disimpan di StoreDO (tabel uploads) untuk daftar file per user.
 * - Dipasang di tools.js pada /api/tools/upload (sudah lewat requireUser + cek paket).
 * - File publik dilayani lewat serveFile() (dipanggil dari index.js): <CDN_BASE>/<kode>.<ext> atau /f/<kode>.<ext>. */
export const uploader = new Hono()

const str = (b, s, e) => String.fromCharCode(...b.slice(s, e))
const ftyp = (b) => str(b, 4, 8) === 'ftyp'
const zip = (b) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5)
const ole = (b) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0
const ebml = (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3
const ogg = (b) => str(b, 0, 4) === 'OggS'
const text = (b, buf) => {   /* teks polos: tanpa byte NUL dan UTF-8 valid */
    const s = new Uint8Array(buf, 0, Math.min(buf.byteLength, 8192))
    if (s.includes(0)) return false
    try { new TextDecoder('utf-8', { fatal: true }).decode(s, { stream: true }); return true } catch { return false }
}
/* ekstensi -> [mime, cek isi file, tampil langsung di browser?]. Selain daftar ini (html, svg, js, exe, apk, dst) DITOLAK. */
const TYPES = {
    jpg: ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff, 1], jpeg: ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff, 1],
    png: ['image/png', (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47, 1],
    gif: ['image/gif', (b) => str(b, 0, 4) === 'GIF8', 1],
    webp: ['image/webp', (b) => str(b, 0, 4) === 'RIFF' && str(b, 8, 12) === 'WEBP', 1],
    mp4: ['video/mp4', ftyp, 1], m4v: ['video/mp4', ftyp, 1], mov: ['video/quicktime', ftyp, 1], '3gp': ['video/3gpp', ftyp, 1],
    webm: ['video/webm', ebml, 1], mkv: ['video/x-matroska', ebml, 0],
    mp3: ['audio/mpeg', (b) => str(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0), 1],
    wav: ['audio/wav', (b) => str(b, 0, 4) === 'RIFF' && str(b, 8, 12) === 'WAVE', 1],
    ogg: ['audio/ogg', ogg, 1], opus: ['audio/ogg', ogg, 1], m4a: ['audio/mp4', ftyp, 1], flac: ['audio/flac', (b) => str(b, 0, 4) === 'fLaC', 1],
    pdf: ['application/pdf', (b) => str(b, 0, 5) === '%PDF-', 1],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', zip, 0],
    xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', zip, 0],
    pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', zip, 0],
    odt: ['application/vnd.oasis.opendocument.text', zip, 0], ods: ['application/vnd.oasis.opendocument.spreadsheet', zip, 0], odp: ['application/vnd.oasis.opendocument.presentation', zip, 0],
    zip: ['application/zip', zip, 0],
    doc: ['application/msword', ole, 0], xls: ['application/vnd.ms-excel', ole, 0], ppt: ['application/vnd.ms-powerpoint', ole, 0],
    rar: ['application/vnd.rar', (b) => str(b, 0, 4) === 'Rar!', 0], '7z': ['application/x-7z-compressed', (b) => b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf, 0],
    txt: ['text/plain', text, 1], csv: ['text/csv', text, 0], json: ['application/json', text, 0], md: ['text/markdown', text, 0],
}
const B62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const rid = (n = 6) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => B62[x % 62]).join('')
const err = (c, status, error, message) => c.json({ ok: false, error, message, status }, status)
const num = (v, d) => { const n = parseInt(v, 10); return n > 0 ? n : d }
const MIN_TTL = 60, MAX_TTL = 365 * 86400   /* KV: kedaluwarsa minimal 60 detik */
const parseTtl = (v) => { if (v == null || v === '' || v === '0') return 0; const n = parseInt(v, 10); return n >= MIN_TTL && n <= MAX_TTL ? n : -1 }
const base = (c) => (c.env.CDN_BASE ? c.env.CDN_BASE.replace(/\/+$/, '') : new URL(c.req.url).origin + '/f')
const urlOf = (c, key) => base(c) + '/' + key
const cleanName = (n) => String(n || 'file').replace(/[\u0000-\u001f<>"\\/]/g, '').slice(0, 100) || 'file'

/* POST /api/tools/upload?name=foto.jpg&ttl=86400  (ttl detik; kosong/0 = permanen). Body = isi file mentah. */
uploader.post('/', async (c) => {
    if (!c.env.UPLOADS) return err(c, 503, 'not_configured', 'Penyimpanan KV belum dikonfigurasi (binding UPLOADS).')
    const u = c.get('user'), s = store(c)
    const max = Math.min(25, num(c.env.UPLOAD_MAX_MB, 25)) * 1048576, maxFiles = num(c.env.UPLOAD_MAX_FILES, 200), maxTotal = num(c.env.UPLOAD_MAX_TOTAL_MB, 200) * 1048576
    const len = parseInt(c.req.header('content-length') || '0', 10)
    if (!len) return err(c, 411, 'length_required', 'File kosong atau ukuran tidak diketahui.')
    if (len > max) return err(c, 413, 'too_large', `File terlalu besar (maks ${max / 1048576} MB).`)
    const name = cleanName(c.req.query('name')), ext = (name.split('.').pop() || '').toLowerCase()
    const t = name.includes('.') ? TYPES[ext] : null
    if (!t) return err(c, 415, 'bad_type', 'Tipe file tidak didukung. Boleh: gambar, video, audio, PDF, Word/Excel/PowerPoint, zip/rar/7z, dan teks.')
    const ttl = parseTtl(c.req.query('ttl'))
    if (ttl < 0) return err(c, 400, 'bad_ttl', 'Masa berlaku harus antara 1 menit dan 365 hari, atau kosong untuk permanen.')
    const now = Date.now(), q = await s.uploadUsage(u.id, now)
    if (q.n >= maxFiles) return err(c, 429, 'quota', `Kuota penuh (maks ${maxFiles} file aktif). Hapus file lama dulu.`)
    if (q.bytes + len > maxTotal) return err(c, 429, 'quota', `Kuota penyimpanan penuh (maks ${maxTotal / 1048576} MB). Hapus file lama dulu.`)
    const buf = await c.req.arrayBuffer()
    if (!buf.byteLength || buf.byteLength > max) return err(c, 413, 'too_large', `File terlalu besar (maks ${max / 1048576} MB).`)
    if (!t[1](new Uint8Array(buf, 0, Math.min(buf.byteLength, 16)), buf)) return err(c, 415, 'bad_content', `Isi file tidak cocok dengan ekstensi .${ext}.`)
    let key = ''
    for (let i = 0; i < 5; i++) {
        key = `${rid()}.${ext}`
        if ((await c.env.UPLOADS.get(key, 'stream')) === null) break
        if (i === 4) return err(c, 500, 'id_collision', 'Gagal membuat ID unik, coba lagi.')
    }
    const expires = ttl ? now + ttl * 1000 : null
    await c.env.UPLOADS.put(key, buf, { ...(ttl ? { expirationTtl: ttl } : {}), metadata: { n: name, m: t[0], s: buf.byteLength, i: t[2], e: expires } })
    const id = await s.addUpload(u.id, key, name, buf.byteLength, t[0], now, expires)
    return c.json({ ok: true, id, key, name, size: buf.byteLength, mime: t[0], expires_at: expires, url: urlOf(c, key) })
})

uploader.get('/list', async (c) => {
    const rows = await store(c).listUploads(c.get('user').id, Date.now())
    return c.json({
        ok: true, files: rows.map((r) => ({ ...r, url: urlOf(c, r.key) })),
        max_mb: Math.min(25, num(c.env.UPLOAD_MAX_MB, 25)), max_files: num(c.env.UPLOAD_MAX_FILES, 200), max_total_mb: num(c.env.UPLOAD_MAX_TOTAL_MB, 200),
    })
})

const owned = async (c) => {
    const u = c.get('user'), s = store(c), row = await s.getUpload(parseInt(c.req.param('id'), 10) || 0)
    let admin = false; try { admin = !!(await s.adminLevel(u.id)) } catch {}
    return row && (row.user_id === u.id || admin) ? row : null
}
const purge = (c, key) => {   /* hapus salinan di cache edge (hanya colo ini; di colo lain hilang sesuai max-age) */
    try { for (const url of new Set([urlOf(c, key), new URL(c.req.url).origin + '/f/' + key])) c.executionCtx.waitUntil(caches.default.delete(url)) } catch {}
}

/* PATCH /api/tools/upload/:id  body {ttl: detik | 0 = permanen}: ubah masa berlaku (KV tidak bisa ubah TTL langsung, jadi file ditulis ulang). */
uploader.patch('/:id', async (c) => {
    const row = await owned(c); if (!row) return err(c, 404, 'not_found', 'File tidak ditemukan.')
    const b = await c.req.json().catch(() => ({})), ttl = parseTtl(b.ttl)
    if (ttl < 0) return err(c, 400, 'bad_ttl', 'Masa berlaku harus antara 1 menit dan 365 hari, atau 0 untuk permanen.')
    const cur = await c.env.UPLOADS.getWithMetadata(row.key, 'arrayBuffer')
    if (!cur.value) { await store(c).delUpload(row.id); return err(c, 404, 'expired', 'File sudah kedaluwarsa.') }
    const expires = ttl ? Date.now() + ttl * 1000 : null
    await c.env.UPLOADS.put(row.key, cur.value, { ...(ttl ? { expirationTtl: ttl } : {}), metadata: { ...(cur.metadata || {}), e: expires } })
    await store(c).setUploadExpiry(row.id, expires)
    purge(c, row.key)
    return c.json({ ok: true, expires_at: expires })
})

uploader.delete('/:id', async (c) => {
    const row = await owned(c); if (!row) return err(c, 404, 'not_found', 'File tidak ditemukan.')
    await c.env.UPLOADS.delete(row.key)
    await store(c).delUpload(row.id)
    purge(c, row.key)
    return c.json({ ok: true })
})

/* Publik: GET <CDN_BASE>/<key> atau /f/<key>. Dijawab sebelum middleware lain (index.js) supaya header CSP situs tidak merusak PDF. */
export const serveFile = async (c, key) => {
    const miss = () => new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
    if (!c.env.UPLOADS) return miss()
    const cache = caches.default, hit = await cache.match(c.req.raw)
    if (hit) return hit
    const r = await c.env.UPLOADS.getWithMetadata(key, 'stream')
    if (!r.value) return miss()
    const m = r.metadata || {}, left = m.e ? Math.floor((m.e - Date.now()) / 1000) : Infinity
    if (left <= 0) return miss()
    const h = new Headers({
        'content-type': m.m || 'application/octet-stream', 'content-length': String(m.s || ''),
        'cache-control': `public, max-age=${Math.min(86400, left)}`, 'x-content-type-options': 'nosniff', 'accept-ranges': 'bytes',
        'content-disposition': `${m.i ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(m.n || key)}`,
        'cross-origin-resource-policy': 'cross-origin', 'access-control-allow-origin': '*',
    })
    if (!m.s) h.delete('content-length')
    if (!m.i || m.m === 'text/plain') h.set('content-security-policy', "default-src 'none'; sandbox")
    const res = new Response(r.value, { status: 200, headers: h })
    if (m.s) { try { c.executionCtx.waitUntil(cache.put(c.req.url, res.clone())) } catch {} }
    return res
}
