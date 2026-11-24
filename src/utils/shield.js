import { bodyLimit } from 'hono/body-limit'
import { store, currentUser } from './session.js'

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
export const UPLOAD_MAX = 25 * 1024 * 1024
export const UPLOAD_RE = /^\/api\/tools\/ptero\/s\/\d{1,9}\/upload$/
export const PRIVATE_RE = /^\/api\/(auth|admin|billing|tools)(\/|$)/
/* Dipanggil server lain (Google, payment gateway): bukan dari browser kita, jangan diblokir cek Origin / limit. */
const MACHINE_RE = /^(\/callback|\/webhook|\/api\/billing\/webhook|\/api\/billing\/btzpay\/callback|\/api\/auth\/google\/callback)\/?$/

/* Aturan limit per IP per menit (urutan penting: yang pertama cocok dipakai). Angkanya diatur admin (Dashboard Admin > Blokir IP > Auto-blokir). */
const RULES = [
    [/^\/api\/auth\/(login|register|admin-login|google)/, 'auth', 'limit_auth'],
    [/^\/api\/(admin|billing|tools)(\/|$)/, 'priv', 'limit_priv'],
    [/^\/api\//, 'api', 'limit_api'],
    [/(^\/[^.]*$)|(\.html$)/, 'page', 'limit_page'],
    [/./, 'asset', 'limit_asset'],
]
const WINDOW = 60e3, STRIKE_WINDOW = 10 * 60e3
const DEFAULT_CFG = { enabled: true, limit_auth: 20, limit_priv: 150, limit_api: 300, limit_page: 240, limit_asset: 1200, strikes: 3, flood_mult: 4, ban_minutes: 15 }

/* Pengaturan dari database, di-cache 30 detik per isolate (tidak memanggil DO tiap request). Dibaca ulang segera setelah admin menyimpan. */
let cfgCache = { at: 0, v: DEFAULT_CFG }
export const refreshSecurity = () => { cfgCache.at = 0; adminIpCache.at = 0; adminChecked.clear() }
const getCfg = async (c, now) => {
    if (c.env.STORE && now - cfgCache.at > 30000) {
        cfgCache.at = now
        try { cfgCache.v = { ...DEFAULT_CFG, ...(await store(c).secCfg()) } } catch (e) { console.error('[Shield] cfg', e) }
    }
    return cfgCache.v
}

/* Admin tidak pernah kena limit / auto-blokir: dikenali dari IP yang dipakai admin (7 hari terakhir) atau dari sesi login admin. */
const adminIpCache = { at: 0, set: new Set() }
const adminChecked = new Map()
const isAdminReq = async (c, ip, now) => {
    if (!c.env.STORE) return false
    if (now - adminIpCache.at > 30000) {
        adminIpCache.at = now
        try { adminIpCache.set = new Set((await store(c).adminIps()).ips.map((x) => String(x).toLowerCase())) } catch (e) { console.error('[Shield] adminIps', e) }
    }
    if (adminIpCache.set.has(ip.toLowerCase())) return true
    const hit = adminChecked.get(ip)
    if (hit && hit.until > now) return hit.ok
    let ok = false
    if (/arvo_session=/.test(c.req.header('cookie') || '')) {
        try { c.set('ip', ip); const u = await currentUser(c); ok = !!(u && await store(c).adminLevel(u.id)) } catch {}
    }
    if (adminChecked.size > 2000) adminChecked.clear()
    adminChecked.set(ip, { ok, until: now + (ok ? 300e3 : 10e3) })
    if (ok) adminIpCache.set.add(ip.toLowerCase())
    return ok
}

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
    if (len > (UPLOAD_RE.test(path) ? UPLOAD_MAX : 1024 * 1024)) return deny(c, 413, 'Payload Too Large', 'Body terlalu besar.')

    const machine = MACHINE_RE.test(path)
    const cfg = await getCfg(c, now)
    if (!owner && !machine && cfg.enabled) {
        const ip = cfIp || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
        sweep(now)

        /* 2. IP yang sedang di-ban: tolak murah, tanpa hitung apa pun. */
        const until = bans.get(ip)
        if (until && until > now) return deny(c, 429, 'Too Many Requests', 'Terlalu banyak permintaan. IP kamu diblokir otomatis.', Math.ceil((until - now) / 1000))

        /* 3. Limit per IP per menit. Lewat batas = 1 strike; sejumlah strike dalam 10 menit (atau banjir) = auto-blokir. */
        const [, scope, key] = RULES.find(([re]) => re.test(path)), max = cfg[key]
        const b = bump(buckets, `${scope}:${ip}`, WINDOW, now)
        if (b.n > max && !(await isAdminReq(c, ip, now))) {
            let ban = b.n > max * cfg.flood_mult
            if (b.n === max + 1) ban = bump(strikes, ip, STRIKE_WINDOW, now).n >= cfg.strikes || ban
            if (ban && !(bans.get(ip) > now)) {
                /* ban memori hanya 1 menit pertama (langsung efektif); selanjutnya daftar blokir di database yang berlaku, jadi buka-blokir dari Admin tidak tertahan */
                bans.set(ip, now + Math.min(60e3, (cfg.ban_minutes || 1) * 60e3))
                console.error('[Shield] auto-blokir', ip, scope)
                /* simpan ke daftar blokir (terlihat & bisa dibuka di Admin, berlaku di semua isolate) */
                const p = store(c).autoBlock(ip, `auto: melewati limit ${scope} (${max}/menit)`, cfg.ban_minutes * 60e3, now).catch(() => {})
                try { c.executionCtx.waitUntil(p) } catch {}
            }
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
const small = bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) => c.json({ error: 'Payload Too Large', message: 'Body terlalu besar (maks 1 MB).', status: 413 }, 413),
})
/* Satu-satunya pengecualian: unggah file ke server Pterodactyl milik user (maks 25 MB, diteruskan streaming, tidak disimpan di Arvo). */
const big = bodyLimit({
    maxSize: UPLOAD_MAX,
    onError: (c) => c.json({ error: 'Payload Too Large', message: `File terlalu besar (maks ${UPLOAD_MAX / 1048576} MB).`, status: 413 }, 413),
})
export const limitBody = () => (c, next) => (UPLOAD_RE.test(c.req.path) ? big(c, next) : small(c, next))
