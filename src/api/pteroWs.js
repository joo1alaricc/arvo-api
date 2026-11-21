import { userFromRequest } from '../utils/session.js'
import { loadPteroCfg, cfgReady, wsCreds } from '../utils/pterodactyl.js'

/* ============================================================================
 * Konsol live Pterodactyl: browser <-> server Arvo <-> Wings (node).
 *
 *   browser ──wss──> /api/tools/ptero/s/:id/ws  (Arvo: cek login + kepemilikan + masa aktif)
 *   Arvo ───wss──> node Wings  (token & alamat node diambil Arvo dari panel; browser TIDAK pernah melihatnya)
 *
 * Dijawab SEBELUM Hono (di export default fetch), supaya respons 101 WebSocket tidak disentuh middleware yang membungkus Response.
 * Dari browser hanya event aman yang diteruskan: kirim perintah, power, minta log/statistik. Event 'auth' dari browser diabaikan.
 * ========================================================================== */
export const PTERO_WS_RE = /^\/api\/tools\/ptero\/s\/(\d{1,9})\/ws$/
const POWER = new Set(['start', 'stop', 'restart', 'kill'])
const MAX_PER_USER = 3
const open = new Map()   /* userId -> jumlah sesi konsol terbuka di isolate ini */

/* Inti jembatan, tanpa API Workers supaya bisa diuji. client = WebSocket browser, up = WebSocket ke Wings. */
export const bridge = (client, up, { refresh, onClose } = {}) => {
    let closed = false
    const close = (code = 1000, reason = '') => {
        if (closed) return
        closed = true
        try { client.close(code, reason) } catch {}
        try { up.close() } catch {}
        if (onClose) onClose()
    }
    const sendUp = (o) => { try { up.send(JSON.stringify(o)) } catch {} }

    client.addEventListener('message', (e) => {
        if (typeof e.data !== 'string' || e.data.length > 4096) return
        let m; try { m = JSON.parse(e.data) } catch { return }
        const ev = m && m.event, a = m && m.args
        if (ev === 'send command' && Array.isArray(a) && typeof a[0] === 'string' && a[0].length > 0 && a[0].length <= 2000) sendUp({ event: ev, args: [a[0]] })
        else if (ev === 'set state' && Array.isArray(a) && POWER.has(a[0])) sendUp({ event: ev, args: [a[0]] })
        else if (ev === 'send logs' || ev === 'send stats') sendUp({ event: ev, args: [null] })
    })
    up.addEventListener('message', async (e) => {
        if (typeof e.data !== 'string') return
        let m = null; try { m = JSON.parse(e.data) } catch {}
        const ev = m && m.event
        if (ev === 'token expiring') {   /* token konsol berlaku 10 menit: perbarui diam-diam, browser tidak perlu tahu */
            try { sendUp({ event: 'auth', args: [await refresh()] }) } catch { close(4002, 'Sesi konsol berakhir') }
            return
        }
        if (ev === 'token expired') return close(4002, 'Sesi konsol berakhir')
        if (ev === 'auth success') sendUp({ event: 'send logs', args: [null] })   /* minta riwayat log begitu terautentikasi */
        try { client.send(e.data) } catch {}
    })
    for (const s of [client, up]) { s.addEventListener('close', () => close()); s.addEventListener('error', () => close(4003, 'Koneksi konsol terputus')) }
    return { close }
}

export const pteroWs = async (request, env) => {
    const url = new URL(request.url), id = Number(PTERO_WS_RE.exec(url.pathname)[1])
    const bad = (status, message) => new Response(JSON.stringify({ ok: false, status, message }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
    if (request.method !== 'GET') return bad(405, 'Method tidak didukung.')
    /* Cegah Cross-Site WebSocket Hijacking: browser selalu mengirim Origin, harus sama dengan situs ini. */
    const origin = request.headers.get('origin')
    if (origin) { let ok = false; try { ok = new URL(origin).host === url.host } catch {} if (!ok) return bad(403, 'Origin tidak diizinkan.') }
    const user = await userFromRequest(request, env, request.headers.get('cf-connecting-ip') || '')
    if (!user) return bad(401, 'Silakan login dulu.')
    const st = env.STORE.get(env.STORE.idFromName('main'))
    if (!(await st.servicesCfg()).ptero) return bad(503, 'Layanan sedang dinonaktifkan.')
    const srv = await st.pteroServer(id)
    if (!srv || srv.user_id !== user.id || srv.status === 'deleted') return bad(404, 'Server tidak ditemukan.')
    if (srv.status !== 'active' || srv.expires_at < Date.now()) return bad(403, 'Masa aktif server sudah habis. Perpanjang dulu.')
    const cfg = await loadPteroCfg(st)
    if (!cfgReady(cfg)) return bad(503, 'Panel belum siap. Hubungi admin.')
    if ((open.get(user.id) || 0) >= MAX_PER_USER) return bad(429, 'Terlalu banyak sesi konsol terbuka. Tutup tab lain dulu.')

    let creds
    try { creds = await wsCreds(cfg, srv.identifier) } catch (e) { return bad(e.status === 409 ? 409 : 502, e.status === 409 ? 'Server sedang sibuk (instalasi). Coba lagi sebentar.' : 'Panel tidak memberi akses konsol.') }
    let resp
    try { resp = await fetch(String(creds.socket).replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:'), { headers: { Upgrade: 'websocket', Origin: cfg.domain } }) }
    catch { return bad(502, 'Node tidak bisa dihubungi.') }
    const up = resp.webSocket
    if (!up) return bad(502, 'Node menolak koneksi konsol.')
    up.accept()

    const pair = new WebSocketPair(), [client, server] = Object.values(pair)
    server.accept()
    up.send(JSON.stringify({ event: 'auth', args: [creds.token] }))
    open.set(user.id, (open.get(user.id) || 0) + 1)
    bridge(server, up, {
        refresh: async () => (await wsCreds(cfg, srv.identifier)).token,
        onClose: () => { const n = (open.get(user.id) || 1) - 1; n > 0 ? open.set(user.id, n) : open.delete(user.id) },
    })
    return new Response(null, { status: 101, webSocket: client })
}
