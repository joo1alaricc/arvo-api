/* Menyuntik blok SEO + preview link (Open Graph / Twitter Card) ke <head> semua halaman public/*.html.
 * Aman dijalankan berulang: blok lama di antara <!-- seo:start --> dan <!-- seo:end --> diganti.
 * Edit SITE / PAGES di bawah lalu jalankan: node scripts/seo-head.mjs  (juga otomatis lewat `npm run deploy`). */
import { readFileSync, writeFileSync } from 'node:fs'
const SITE = 'https://arvo-api.my.id'
const NAME = 'Arvo API'
const IMG = `${SITE}/og-image.png`
const IMG_ALT = 'Arvo API: API gateway simpel dengan kuota yang jelas'

const PAGES = {
    'index.html': { path: '/', title: 'Arvo API - API Gateway Indonesia untuk Downloader, AI & Tools', desc: 'Arvo API: REST API simpel dan cepat untuk downloader (TikTok, Instagram, YouTube, Spotify), AI, dan maker. Coba gratis, upgrade ke Premium atau VIP kapan saja, bayar via QRIS.', index: true, ld: true },
    'playground.html': { path: '/playground', title: 'Playground - Coba Endpoint Arvo API Langsung dari Browser', desc: 'Coba semua endpoint Arvo API langsung dari browser: isi parameter, lihat contoh kode cURL, JavaScript, Python, PHP, dan response-nya secara real-time.', index: true },
    'dashboard.html': { path: '/dashboard', title: 'Dashboard - Statistik Arvo API Secara Langsung', desc: 'Statistik Arvo API secara langsung: jumlah request, pengguna, endpoint, dan uptime server.', index: true },
    'login.html': { path: '/login', title: 'Masuk · Arvo API', desc: 'Masuk atau daftar akun Arvo API untuk mendapatkan API key.', index: false },
    'profile.html': { path: '/profile', title: 'Profil · Arvo API', desc: 'Kelola API key, whitelist IP, dan riwayat pemakaian akun Arvo API.', index: false },
    'admin.html': { path: '/admin', title: 'Admin · Arvo API', desc: 'Panel pengelola Arvo API.', index: false },
    'smm.html': { path: '/smm', title: 'Layanan SMM · Arvo API', desc: 'Layanan SMM di Arvo API.', index: false },
    'pterodactyl.html': { path: '/pterodactyl', title: 'Panel Pterodactyl · Arvo API', desc: 'Sewa panel Pterodactyl otomatis di Arvo API.', index: false },
    'otp.html': { path: '/otp', title: 'Layanan OTP · Arvo API', desc: 'Layanan nomor OTP di Arvo API.', index: false },
    'am.html': { path: '/am', title: 'Aktivasi AM · Arvo API', desc: 'Aktivasi AM di Arvo API.', index: false },
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

const block = (p) => {
    const url = SITE + p.path
    const lines = [
        '<!-- seo:start -->',
        `<meta name="description" content="${esc(p.desc)}">`,
        `<meta name="robots" content="${p.index ? 'index, follow, max-image-preview:large, max-snippet:-1' : 'noindex, nofollow'}">`,
        `<link rel="canonical" href="${url}">`,
        '<meta name="theme-color" content="#0d1016">',
        `<meta name="application-name" content="${NAME}"><meta name="apple-mobile-web-app-title" content="Arvo">`,
        '<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        /* Open Graph: WhatsApp, Facebook, Instagram, Threads, Telegram, Discord, LinkedIn, Slack, iMessage */
        `<meta property="og:type" content="website"><meta property="og:site_name" content="${NAME}"><meta property="og:locale" content="id_ID">`,
        `<meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.desc)}"><meta property="og:url" content="${url}">`,
        `<meta property="og:image" content="${IMG}"><meta property="og:image:secure_url" content="${IMG}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(IMG_ALT)}">`,
        /* Twitter / X */
        `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(p.title)}"><meta name="twitter:description" content="${esc(p.desc)}"><meta name="twitter:image" content="${IMG}"><meta name="twitter:image:alt" content="${esc(IMG_ALT)}">`,
    ]
    if (p.ld) {
        const ld = [
            { '@context': 'https://schema.org', '@type': 'WebSite', name: NAME, url: SITE + '/', inLanguage: 'id', description: p.desc },
            { '@context': 'https://schema.org', '@type': 'Organization', name: NAME, url: SITE + '/', logo: SITE + '/icon-512.png' },
        ]
        lines.push(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`)
    }
    lines.push('<!-- seo:end -->')
    return lines.join('\n')
}

for (const [file, p] of Object.entries(PAGES)) {
    const f = new URL(`../public/${file}`, import.meta.url)
    let html = readFileSync(f, 'utf8')
    html = html.replace(/\n?<!-- seo:start -->[\s\S]*?<!-- seo:end -->\n?/g, '\n')
    html = html.replace(/<meta name="description"[^>]*>\s*/g, '')                   /* buang description lama (digantikan blok ini) */
    html = html.replace(/<link rel="icon" href="\/favicon\.svg"[^>]*>/, m => m)      /* favicon.svg tetap dipakai browser modern */
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(p.title)}</title>\n${block(p)}`)
    writeFileSync(f, html)
    console.log('seo', file, p.index ? 'index' : 'noindex')
}

/* sitemap.xml hanya memuat halaman yang boleh diindeks */
const day = new Date().toISOString().slice(0, 10)
const urls = Object.values(PAGES).filter((p) => p.index)
writeFileSync(new URL('../public/sitemap.xml', import.meta.url), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${day}</lastmod><changefreq>${p.path === '/' ? 'weekly' : 'daily'}</changefreq><priority>${p.path === '/' ? '1.0' : '0.8'}</priority></url>`).join('\n')}\n</urlset>\n`)
console.log('sitemap.xml', urls.length, 'url')
