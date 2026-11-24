import { banIp } from './shield.js'
import { fetchAsset } from './assets.js'

/* ============================================================================
 * WEB GUARD: anti-scrape untuk halaman web & endpoint internal situs.
 *
 * Prinsip: situs hanya melayani BROWSER sungguhan. API publik (/api/maker/qc, dst.) sengaja TIDAK disentuh
 * karena itulah produknya: boleh dipanggil dari curl/python/bot WA. Yang dijaga:
 *   1. Halaman HTML      : hanya untuk navigasi browser (bukan curl/python/scrapy/headless/AI-crawler).
 *   2. File JS/CSS/media : hanya dimuat dari halaman kita sendiri (tidak bisa diunduh langsung / hotlink).
 *   3. Endpoint internal : /api/catalog, /api/dashboard, /api/site-content, /api/services, /api/ui, /api/pv
 *                          hanya dari halaman sendiri (Sec-Fetch-Site: same-origin), bukan curl/skrip/situs lain.
 *   4. Honeypot          : link tersembunyi /export-data; siapa pun yang membukanya = bot, IP di-ban.
 *   5. Bot resmi         : Googlebot/Bing/Apple (diverifikasi lewat ASN) & bot preview link (WhatsApp, IG,
 *                          Telegram, X, dll.) tetap boleh supaya SEO dan preview tidak rusak.
 *
 * Kecepatan: file statis yang lolos dijawab LANGSUNG dari sini (melewati logging/rateLimiter/DO) dan diberi cache
 * browser panjang untuk URL ber-?v=hash, jadi kunjungan ulang tidak menyentuh server sama sekali.
 *
 * Batasan jujur: ini menaikkan biaya scraper secara drastis, tapi tidak ada yang bisa membuat halaman web publik
 * 100% mustahil di-scrape (browser sungguhan yang dikendalikan skrip tetap bisa lolos). Lapisan edge Cloudflare
 * (Bot Fight Mode / WAF) di SECURITY.md melengkapinya.
 * ========================================================================== */

export const TRAP = '/export-data'
export const INTERNAL_RE = /^\/api\/(catalog|dashboard|site-content|services|ui|pv)\/?$/
const MACHINE_RE = /^(\/callback|\/webhook|\/health)\/?$/
const PUBLIC_FILE = /^\/(favicon\.(ico|svg)|icon-(192|512)\.png|apple-touch-icon\.png|og-image\.png|logo(-white)?\.svg|robots\.txt|sitemap\.xml)$/
const ASSET_EXT = /\.(m?js|css|map|png|jpe?g|gif|webp|avif|svg|ico|mp4|webm|woff2?|ttf|otf|txt|json|xml)$/i
const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i
const DOC_DEST = new Set(['document', 'iframe', 'frame', 'nested-document'])

/* Bot mesin pencari: [pola UA, daftar ASN resmi atau null]. UA saja gampang dipalsukan, jadi Google/Bing/Apple dicek ASN-nya. */
const SEARCH = [
    [/googlebot|google-inspectiontool|adsbot-google|apis-google|mediapartners-google/i, [15169]],
    [/bingbot|bingpreview|msnbot/i, [8075]],
    [/applebot/i, [714]],
    [/yandex(bot|images)?/i, null],
    [/baiduspider/i, null],
    [/duckduckbot/i, null],
]
/* Bot pembuat preview link: hanya boleh ambil HTML + gambar (cukup untuk og:image). */
const PREVIEW = /(whatsapp|facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|twitterbot|telegrambot|discordbot|linkedinbot|slackbot|skypeuripreview|pinterestbot|redditbot)/i
/* Alat scraping / otomasi / crawler AI / scanner. */
const BAD_UA = new RegExp('(' + [
    'curl', 'wget', 'httpie', 'python', 'aiohttp', 'httpx', 'urllib', 'scrapy', 'requests', 'go-http-client', 'okhttp', 'java/', 'apache-http', 'jakarta',
    'libwww', 'lwp-', 'node-fetch', 'undici', 'axios', '\\bgot\\b', 'superagent', 'guzzle', 'php/', 'ruby', 'faraday', 'mechanize', 'postman', 'insomnia',
    'rest-client', 'headless', 'phantomjs', 'puppeteer', 'playwright', 'selenium', 'webdriver', 'cypress', 'jsdom', 'httrack', 'webcopier', 'webzip',
    'offline explorer', 'teleport', 'sitesucker', 'screaming frog', 'ahrefs', 'semrush', 'mj12', 'dotbot', 'petalbot', 'bytespider', 'gptbot', 'chatgpt-user',
    'oai-searchbot', 'ccbot', 'claudebot', 'claude-web', 'anthropic', 'perplexity', 'amazonbot', 'diffbot', 'dataforseo', 'omgili', 'scrapingbee', 'zyte', 'apify',
    'crawl', 'spider', 'scrape', 'bot/', 'zgrab', 'masscan', 'nmap', 'nikto', 'sqlmap', 'wpscan', 'nuclei', 'dirbuster', 'gobuster', 'feroxbuster',
].join('|') + ')', 'i')

const parseList = (v = '') => String(v).split(',').map((x) => x.trim()).filter(Boolean)
const isOwner = (c) => { const ip = c.req.header('cf-connecting-ip') || ''; return !!ip && parseList(c.env.OWNER_IPS).includes(ip) }
const hostOf = (u) => { try { return new URL(u).host } catch { return '' } }
const sfOf = (c) => ({ site: c.req.header('sec-fetch-site') || '', mode: c.req.header('sec-fetch-mode') || '', dest: c.req.header('sec-fetch-dest') || '' })

/* 'search' | 'preview' | 'browser' | 'bad' */
export const classify = (c) => {
    const ua = c.req.header('user-agent') || ''
    const f = sfOf(c)
    /* Header Sec-Fetch-* hanya dikirim browser; bot resmi tidak mengirimnya. */
    if (!(f.site || f.mode || f.dest)) {
        for (const [re, asns] of SEARCH) {
            if (!re.test(ua)) continue
            const asn = c.req.raw?.cf?.asn
            return !asns || asn == null || asns.includes(Number(asn)) ? 'search' : 'bad'   /* UA mengaku Googlebot tapi bukan dari jaringan Google = palsu */
        }
        if (PREVIEW.test(ua)) return 'preview'
    }
    if (ua.length < 30 || !/mozilla\/5\.0/i.test(ua) || BAD_UA.test(ua)) return 'bad'
    return 'browser'
}

const sameOrigin = (c, f) => {
    const host = new URL(c.req.url).host
    if (f.site) return f.site === 'same-origin'
    const o = c.req.header('origin')
    if (o) return hostOf(o) === host
    const r = c.req.header('referer')
    return !!r && hostOf(r) === host
}

const looksLikeNavigation = (c, f) => {
    if (f.mode || f.dest) return f.mode === 'navigate' && DOC_DEST.has(f.dest || 'document')
    return (c.req.header('accept') || '').includes('text/html') && !!c.req.header('accept-language')   /* browser lama tanpa Sec-Fetch */
}

/* ---- file statis: jalur cepat + cache ---- */
const serveAsset = async (c, next) => {
    const r = await c.env.ASSETS.fetch(c.req.raw)
    if (r.status === 404) return next()   /* file tidak ada: biarkan alur biasa menampilkan halaman 404 */
    if (![200, 206, 304].includes(r.status)) return r
    const h = new Headers(r.headers)
    /* URL ber-?v=hash (di-hash otomatis oleh scripts/bump-version.mjs) tidak pernah berubah isinya: cache 1 tahun.
     * 'private' = hanya cache browser, tidak pernah cache bersama, jadi aturan akses di atas tidak bisa dilewati lewat cache. */
    h.set('Cache-Control', c.req.query('v') ? 'private, max-age=31536000, immutable' : 'private, max-age=3600, stale-while-revalidate=86400')
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h })
}

/* ---- penolakan ---- */
const jsonDeny = (c, message) => c.json({ error: 'Forbidden', message, status: 403 }, 403)
const notFound = (c) => c.text('404 Not Found', 404)
const denyPage = async (c) => {
    try {
        const r = await fetchAsset(c.env, new URL('/errors/403.html', c.req.url))
        if (r.ok) return new Response(r.body, { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
    } catch {}
    return new Response('403 Forbidden', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
}

export const webGuard = () => async (c, next) => {
    const path = c.req.path, method = c.req.method
    if (isOwner(c) || MACHINE_RE.test(path)) return next()
    if (path.startsWith('/api/') && !INTERNAL_RE.test(path)) return next()   /* API publik: sengaja terbuka untuk semua client */

    /* Honeypot: link tersembunyi + Disallow di robots.txt. Yang membuka ini bukan manusia dan bukan bot yang patuh. */
    if (path === TRAP) {
        const ip = c.req.header('cf-connecting-ip') || ''
        if (ip) { banIp(ip, 6 * 3600e3); console.error('[WebGuard] honeypot', ip, c.req.header('user-agent') || '') }
        return notFound(c)
    }

    const kind = classify(c), f = sfOf(c)

    /* ===== Endpoint internal situs ===== */
    if (INTERNAL_RE.test(path)) {
        if (kind === 'bad' || kind === 'preview') return jsonDeny(c, 'Endpoint ini khusus untuk situs Arvo. Gunakan endpoint API publik.')
        if (kind === 'browser' && !sameOrigin(c, f)) return jsonDeny(c, 'Permintaan lintas-situs ditolak.')
        return next()
    }

    /* ===== Halaman & file statis ===== */
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) { c.header('Allow', 'GET, HEAD, OPTIONS'); return c.text('405 Method Not Allowed', 405) }

    if (ASSET_EXT.test(path)) {
        if (PUBLIC_FILE.test(path) || kind === 'search') return serveAsset(c, next)
        if (kind === 'preview') return IMG_EXT.test(path) ? serveAsset(c, next) : notFound(c)
        if (kind === 'bad') return notFound(c)
        /* browser: file hanya boleh diminta oleh halaman kita (bukan diketik di address bar / dibuka langsung) */
        if (f.site ? f.site !== 'same-origin' || DOC_DEST.has(f.dest) : hostOf(c.req.header('referer') || '') !== new URL(c.req.url).host) return notFound(c)
        return serveAsset(c, next)
    }

    if (kind === 'bad') return denyPage(c)
    if (kind === 'browser' && !looksLikeNavigation(c, f)) return denyPage(c)
    return next()
}
