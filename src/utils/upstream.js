/* Semua fetch() dari Worker ke API/situs lain dibuat "berseragam browser".
 * Tanpa ini Workers mengirim User-Agent bawaan ("Cloudflare-Workers") atau kosong, dan banyak API/scraper menolaknya (403/blocked).
 * Berlaku untuk SEMUA fetch di aplikasi: endpoint bawaan, endpoint proxy buatan admin, maupun kode endpoint yang kamu tulis sendiri.
 *
 *  - Header yang kamu isi sendiri (mis. "User-Agent" di kolom Headers upstream) SELALU menang, huruf besar/kecil tidak masalah.
 *  - UA bawaan bisa diganti lewat variabel UPSTREAM_UA (wrangler.toml [vars] atau dashboard).
 *  - Versi Chrome di UA bawaan perlu sesekali dinaikkan (Chrome stabil: 157 per Nov 2026). UA yang terlalu lama sering ditolak oleh situs berproteksi Cloudflare. */
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36'
const DEFAULT_LANG = 'en-US,en;q=0.9,id;q=0.8'

let ua = DEFAULT_UA
export const setUpstreamUA = (v) => { ua = (typeof v === 'string' && v.trim()) || DEFAULT_UA }

const isHttp = (input) => {
    try { const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url); return u.protocol === 'http:' || u.protocol === 'https:' } catch { return false }
}

export const withBrowserHeaders = (input, init) => {
    const isReq = typeof Request !== 'undefined' && input instanceof Request
    const headers = new Headers(init?.headers ?? (isReq ? input.headers : undefined))
    if (!headers.has('user-agent')) headers.set('user-agent', ua)
    if (!headers.has('accept-language')) headers.set('accept-language', DEFAULT_LANG)
    return { ...init, headers }
}

/* fetch dengan header browser yang DIPASANG LANGSUNG (tidak bergantung pada patch fetch global). Dipakai endpoint bawaan yang memanggil API lain. */
export const upstreamFetch = (input, init) => fetch(input, withBrowserHeaders(input, init))

let installed = false
export const installUpstreamFetch = () => {
    if (installed) return
    installed = true
    const native = globalThis.fetch.bind(globalThis)
    globalThis.fetch = (input, init) => (isHttp(input) ? native(input, withBrowserHeaders(input, init)) : native(input, init))
}
installUpstreamFetch()
