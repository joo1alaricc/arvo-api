/* ============================================================================
 * Cache katalog Playground (/api/catalog), per isolate Worker, per TINGKAT AKSES (free/premium/vip).
 *
 * Kenapa aman: katalog hanya berbeda menurut tingkat akses peminta, bukan menurut orangnya. Jadi satu dokumen per tingkat
 * bisa dipakai ulang oleh semua pengguna di tingkat itu. Tingkat OWNER/admin TIDAK pernah di-cache (selalu segar + ada peringatan).
 * Siapa si peminta (login / access key) tetap dicek tiap request; yang di-cache hanya dokumen hasil susunannya.
 *
 *   umur < FRESH            : langsung dijawab dari memori (0 query database).
 *   FRESH <= umur < STALE   : tetap dijawab SEKARANG dari memori, lalu diperbarui di belakang layar (stale-while-revalidate).
 *   umur >= STALE / kosong  : disusun ulang (1 permintaan saja yang menyusun, yang lain menunggu hasil yang sama).
 *   susunan ada sumber yang error : TIDAK di-cache (agar kondisi sebagian tidak "menempel"); dilayani apa adanya.
 * Perubahan dari panel admin memanggil bustCatalog() sehingga isolate yang sama langsung segar; isolate lain menyusul <= FRESH detik.
 * ========================================================================== */
const FRESH = 20e3, STALE = 10 * 60e3
const cache = new Map(), inflight = new Map()

export const bustCatalog = () => cache.clear()

const refresh = (rank, build) => {
    let p = inflight.get(rank)
    if (!p) {
        p = (async () => {
            const warn = []
            const doc = await build(warn)
            if (warn.length) console.error('[catalog]', warn.join(' | '))
            else cache.set(rank, { at: Date.now(), doc })
            return doc
        })().finally(() => inflight.delete(rank))
        inflight.set(rank, p)
    }
    return p
}

export const cachedCatalog = (c, rank, build) => {
    const hit = cache.get(rank), age = hit ? Date.now() - hit.at : Infinity
    if (age < FRESH) return hit.doc
    if (age < STALE) {
        const p = refresh(rank, build).catch((e) => console.error('[catalog] refresh gagal:', e?.message || e))
        try { c.executionCtx.waitUntil(p) } catch {}
        return hit.doc
    }
    return refresh(rank, build)
}
