import { bodyLimit } from 'hono/body-limit'

/* ============================================================================
 * SHIELD: lapisan pertahanan pertama, jalan SEBELUM route/DB apa pun.
 * Tujuan: serangan murah (flood, scanner, brute force, body raksasa, CSRF) ditolak
 * sedini mungkin tanpa menyentuh Durable Object (satu instance global = titik sempit).
 *
 * Batasan jujur: pembatas di sini hidup di memori tiap isolate Worker, jadi bukan pengganti
 * WAF/Rate-Limiting Cloudflare di edge (lihat SECURITY.md). DDoS volumetrik (L3/L4) sudah
 * diserap Cloudflare; Shield ini menahan serangan level aplikasi (L7).
 * ========================================================================== */

/* Content-Security-Policy. Halaman memakai skrip inline, jadi 'unsafe-inline' dipertahankan;
 * nilai tambahnya: tidak bisa di-frame situs lain, tidak ada <base>/<object>, form hanya ke situs sendiri,
 * dan skrip/koneksi eksternal hanya ke host yang memang dipakai. Salin yang sama ke public/_headers. */
export const CSP = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com', 'https://cdnjs.cloudflare.com', 'https://challenges.cloudflare.com'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    mediaSrc: ["'self'", 'https:'],
    connectSrc: ["'self'", 'https://accounts.google.com', 'https://challenges.cloudflare.com'],
    frameSrc: ['https://accounts.google.com', 'https://challenges.cloudflare.com'],
    frameAncestors: ["'self'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
}

const parseList = (v = '') => String(v).split(',').map((x) => x.trim()).filter(Boolean)
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])

/* Rute yang memakai cookie sesi / data akun: tanpa CORS terbuka dan wajib same-origin untuk method yang mengubah data. */
export const PRIVATE_RE = /^\/api\/(auth|admin|billing|tools)(\/|$)/
/* Dipanggil server lain (Google, payment gateway): bukan dari browser kita, jangan diblokir cek Origin / limit. */
const MACHINE_RE = /^(\/callback|\/webhook|\/api\/billing\/webhook|\/api\/billing\/btzpay\/callback|\/api\/auth\/google\/callback)\/?$/

/* Aturan limit per IP per menit (urutan penting: yang pertama cocok dipakai). */
const RULES = [
    [/^\/api\/auth\/(login|register|admin-login|google)/, 'auth', 20],
    [/^\/api\/(admin|billing|tools)(\/|$)/, 'priv', 150],
    [/^\/api\//, 'api', 300],
    [/./, 'web', 240],
]
const WINDOW = 60e3, STRIKE_WINDOW = 10 * 60e3, STRIKES_TO_BAN = 3, BAN_MS = 15 * 60e3

const buckets = new Map(), strikes = new Map(), bans = new Map()
const bump = (map, key, windowMs, now) => {
    let e = map.get(key)
    if (!e || e.reset <= now) e = { n: 0, reset: now + windowMs }
    e.n++
    map.set(key, e)
    return e
}
const sweep = (now) => {
    for (const m of [buckets, strikes]) if (m.size > 20000) for (const [k, v] of m) if (v.reset <= now) m.delete(k)
    if (bans.size > 5000) for (const [k, t] of bans) if (t <= now) bans.delete(k)
}

const deny = (c, status, error, message, retry) => {
    if (retry) c.header('Retry-After', String(retry))
    c.header('Cache-Control', 'no-store')
    return c.req.path.startsWith('/api/') ? c.json({ error, message, status }, status) : c.text(`${status} ${message}`, status)
}

export const shield = () => async (c, next) => {
    const now = Date.now(), path = c.req.path, method = c.req.method
    const cfIp = c.req.header('cf-connecting-ip') || ''
    const owner = !!cfIp && parseList(c.env.OWNER_IPS).includes(cfIp)

    /* 1. Bentuk request yang tidak wajar. */
    if (!METHODS.has(method)) return deny(c, 405, 'Method Not Allowed', 'Method tidak didukung.')
    if (c.req.url.length > 4096) return deny(c, 414, 'URI Too Long', 'URL terlalu panjang.')
    if (/[\u0000-\u001f]|%00/.test(path) || path.includes('..')) return deny(c, 400, 'Bad Request', 'Path tidak valid.')
    const len = Number(c.req.header('content-length') || 0)
    if (len > 1024 * 1024) return deny(c, 413, 'Payload Too Large', 'Body terlalu besar.')

    const machine = MACHINE_RE.test(path)
    if (!owner && !machine) {
        const ip = cfIp || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
        sweep(now)

        /* 2. IP yang sedang di-ban sementara: tolak murah, tanpa hitung apa pun. */
        const until = bans.get(ip)
        if (until && until > now) return deny(c, 429, 'Too Many Requests', 'Terlalu banyak permintaan. Kamu diblokir sementara.', Math.ceil((until - now) / 1000))

        /* 3. Limit per IP per menit. Lewat batas = 1 strike; 5 strike dalam 10 menit = ban 15 menit. */
        const [, scope, max] = RULES.find(([re]) => re.test(path))
        const b = bump(buckets, `${scope}:${ip}`, WINDOW, now)
        if (b.n > max) {
            /* ban langsung bila banjir (>4x limit dalam semenit), atau bila melewati limit di 3 jendela menit berbeda dalam 10 menit */
            let ban = b.n > max * 4
            if (b.n === max + 1) ban = bump(strikes, ip, STRIKE_WINDOW, now).n >= STRIKES_TO_BAN || ban
            if (ban && !(bans.get(ip) > now)) { bans.set(ip, now + BAN_MS); console.error('[Shield] ban', ip, scope) }
            return deny(c, 429, 'Too Many Requests', 'Terlalu banyak permintaan. Coba lagi sebentar.', Math.max(1, Math.ceil((b.reset - now) / 1000)))
        }
    }

    /* 4. Anti-CSRF (pertahanan berlapis di atas SameSite=Lax): method pengubah ke rute akun hanya dari origin sendiri. */
    if (!machine && PRIVATE_RE.test(path) && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        const origin = c.req.header('origin'), host = new URL(c.req.url).host
        let ok = true
        if (origin) { try { ok = new URL(origin).host === host } catch { ok = false } }
        else if (c.req.header('sec-fetch-site') === 'cross-site') ok = false
        if (!ok) return deny(c, 403, 'Forbidden', 'Permintaan lintas-situs ditolak.')
    }
    await next()
}

/* Batas ukuran body untuk semua API (cek ke Content-Length DAN ke stream tanpa Content-Length). */
export const limitBody = () => bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) => c.json({ error: 'Payload Too Large', message: 'Body terlalu besar (maks 1 MB).', status: 413 }, 413),
})
