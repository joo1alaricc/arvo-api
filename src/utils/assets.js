/* ============================================================================
 * Mengambil file statis dari binding ASSETS dengan benar.
 *
 * Workers Assets (html_handling = auto-trailing-slash, bawaan) MENGALIHKAN '/index.html' -> '/' dan '/x.html' -> '/x'.
 * Dua akibat yang harus dihindari:
 *   1. Menulis ulang '/' menjadi '/index.html' lalu mengembalikan redirect-nya ke browser = LOOP tanpa akhir
 *      (browser: ERR_TOO_MANY_REDIRECTS). Karena itu request diteruskan APA ADANYA, jangan ditulis ulang.
 *   2. Mengambil halaman error '/errors/404.html' secara internal dan mendapat redirect kosong = halaman error kosong.
 *      Untuk pengambilan INTERNAL, redirect same-origin diikuti di dalam Worker.
 * ========================================================================== */
export const fetchAsset = async (env, url, init) => {
    let u = new URL(url)
    for (let i = 0; i < 4; i++) {
        const r = await env.ASSETS.fetch(new Request(u, i === 0 ? init : undefined))
        if (r.status < 300 || r.status >= 400) return r
        const loc = r.headers.get('location')
        if (!loc) return r
        let n; try { n = new URL(loc, u) } catch { return r }
        if (n.origin !== u.origin || n.href === u.href) return r
        u = n
    }
    return new Response(null, { status: 404 })   /* terlalu banyak pengalihan */
}

/* Untuk halaman yang diminta browser: redirect kanonis (mis. /x.html -> /x) diteruskan ke browser;
 * redirect ke URL yang sama (loop) dan 404 dianggap tidak ditemukan (null). */
export const serveStatic = async (c) => {
    const url = new URL(c.req.url)
    const r = await c.env.ASSETS.fetch(c.req.raw)
    if (r.status === 404) return null
    if (r.status >= 300 && r.status < 400) {
        let loc = null; try { loc = new URL(r.headers.get('location') || '', url).href } catch {}
        if (!loc || loc === url.href) return null
    }
    return r
}

/* Halaman error bermerek dari /errors/<status>.html; kalau tidak ada, teks polos. */
export const errorPage = async (c, status, fallback) => {
    try {
        const r = await fetchAsset(c.env, new URL(`/errors/${status}.html`, c.req.url))
        if (r.status === 200) return new Response(r.body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
    } catch (e) { console.error('[assets] halaman error gagal dimuat', status, e) }
    return new Response(fallback, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
}
