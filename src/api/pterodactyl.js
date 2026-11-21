import { Hono } from 'hono'
import { store } from '../utils/session.js'
import { UPLOAD_MAX } from '../utils/shield.js'
import { loadCfg, btzCreate, btzCancel, btzQr, httpsOnly } from '../utils/btzpay.js'
import { PLANS, MIN_DAYS, MAX_DAYS, planById, quote, loadPteroCfg, cfgReady, settlePteroOrder, cli, safePath, enc as E } from '../utils/pterodactyl.js'

/* Tools > Panel Pterodactyl (/api/tools/ptero/*). Sudah di belakang requireUser (login wajib) dan gate layanan (admin bisa mematikan).
 * Browser TIDAK pernah memegang kunci panel, domain panel, atau alamat node: semua lewat server Arvo.
 * Setiap aksi pada server dicek: server itu milik user yang login, masih aktif, dan belum lewat masa aktif. */
export const ptero = new Hono()

const body = (c) => c.req.json().catch(() => ({}))
const out = (c, status, error, message) => c.json({ ok: false, error, message, status }, status)
const NAME_RE = /^[^/\0]{1,255}$/

const btzErr = (c, e) => out(c, e.status || 502, e.error || 'btzpay_error', c.get('isOwner') ? `BTZPay: ${e.message}` : 'Pembayaran sedang bermasalah, coba lagi sebentar atau hubungi admin.')
/* Galat dari panel: admin/owner melihat penyebab aslinya; user biasa dapat pesan yang aman dan ramah. */
const pErr = (c, r) => {
    const s = r.status
    if (c.get('isOwner')) return out(c, s >= 400 && s < 600 ? (s === 401 || s === 403 ? 502 : s) : 502, r.error || 'panel_error', r.message)
    if (s === 409) return out(c, 409, 'busy', 'Server sedang sibuk (instalasi/pemulihan). Coba lagi sebentar.')
    if (s === 404) return out(c, 404, 'not_found', 'Data tidak ditemukan di server.')
    if (s === 400 || s === 422) return out(c, 400, 'bad_request', String(r.message || '').replace(/^Panel \(\d+\): /, '') || 'Permintaan tidak valid.')
    return out(c, 502, 'panel_error', 'Panel sedang bermasalah, coba lagi sebentar atau hubungi admin.')
}

/* Pembungkus aksi per server: cek kepemilikan + masa aktif + konfigurasi, lalu jalankan. */
const act = (fn, { allowExpired = false } = {}) => async (c) => {
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id) || id < 1) return out(c, 404, 'not_found', 'Server tidak ditemukan.')
    const st = store(c), srv = await st.pteroServer(id)
    if (!srv || srv.user_id !== c.get('user').id || srv.status === 'deleted') return out(c, 404, 'not_found', 'Server tidak ditemukan.')
    if (!allowExpired && (srv.status !== 'active' || srv.expires_at < Date.now())) return out(c, 403, 'expired', 'Masa aktif server sudah habis. Perpanjang dulu untuk memakainya lagi.')
    const cfg = await loadPteroCfg(st)
    if (!cfgReady(cfg)) return out(c, 503, 'not_configured', 'Panel belum siap. Hubungi admin.')
    c.header('Cache-Control', 'no-store')
    return fn(c, srv, cfg)
}
const base = (srv) => `/servers/${srv.identifier}`
const names = (a) => Array.isArray(a) && a.length > 0 && a.length <= 100 && a.every((x) => typeof x === 'string' && NAME_RE.test(x)) ? a : null

/* ================= Paket & pembelian ================= */
ptero.get('/plans', async (c) => {
    const cfg = await loadPteroCfg(store(c))
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true, ready: cfgReady(cfg), min_days: MIN_DAYS, max_days: MAX_DAYS, plans: PLANS })
})

/* Buat transaksi QRIS BTZPay untuk server baru ('new') atau perpanjangan ('renew'). Harga dihitung di server. */
const createOrder = async (c, kind) => {
    const b = await body(c), st = store(c), u = c.get('user'), now = Date.now()
    const plan = planById(String(b.plan || ''))
    const days = Number(b.days)
    if (kind === 'new' && !plan) return out(c, 400, 'bad_plan', 'Paket tidak dikenal.')
    if (!Number.isInteger(days) || days < MIN_DAYS || days > MAX_DAYS) return out(c, 400, 'bad_days', `Durasi harus ${MIN_DAYS} sampai ${MAX_DAYS} hari.`)
    let srv = null, pl = plan
    if (kind === 'renew') {
        srv = await st.pteroServer(Number(b.server))
        if (!srv || srv.user_id !== u.id || srv.status === 'deleted') return out(c, 404, 'not_found', 'Server tidak ditemukan.')
        pl = planById(srv.plan)
        if (!pl) return out(c, 400, 'bad_plan', 'Paket server tidak dikenal.')
    }
    const pc = await loadPteroCfg(st)
    if (!cfgReady(pc)) return out(c, 503, 'not_configured', 'Panel belum tersedia. Hubungi admin.')
    const apikey = c.env.BTZPAY_APIKEY
    if (!apikey || !c.env.BTZPAY_CALLBACK_TOKEN) return out(c, 503, 'not_configured', c.get('isOwner') ? 'BTZPay belum lengkap: isi secret BTZPAY_APIKEY dan BTZPAY_CALLBACK_TOKEN.' : 'Pembayaran belum bisa dibuat. Hubungi admin.')
    const cfg = await loadCfg(c)
    const live = (await st.pteroPending(u.id, now)).filter((r) => !r.expired_at || r.expired_at > now)
    if (live.length >= cfg.max_pending) return out(c, 429, 'too_many', `Masih ada ${live.length} pembayaran yang belum selesai. Selesaikan atau tunggu kedaluwarsa dulu.`)
    const amount = quote(pl, days), origin = new URL(c.req.url).origin
    const r = await btzCreate(c.env, apikey, {
        amount, fee: cfg.fee, paymentMethod: cfg.payment_method, timeout: cfg.timeout_min * 60000,
        callback_url: `${origin}/callback?t=${encodeURIComponent(c.env.BTZPAY_CALLBACK_TOKEN)}`, return_url: `${origin}/pterodactyl`,
        notes: `Panel Pterodactyl ${pl.name} ${days} hari (${u.username})`.slice(0, 200),
        metadata: { orderId: `ptero-${u.id}-${now}`, productName: `Panel Pterodactyl ${pl.name}` },
    })
    if (!r.ok) { console.error('[ptero] btz create', r.message); return btzErr(c, r) }
    const t = r.data || {}
    if (!t.transactionId || !t.accessKey) return out(c, 502, 'upstream_bad_response', 'BTZPay tidak mengembalikan ID transaksi.')
    const total = Number(t.totalAmount) || amount, exp = Date.parse(t.expiredAt || '') || now + cfg.timeout_min * 60000
    const id = String(t.transactionId)
    await st.pteroOrderNew({ id, uid: u.id, kind, plan: pl.id, days, amount, total, access_key: String(t.accessKey), pay_url: httpsOnly(t.paymentUrl), expired_at: exp, fee: Number(t.fee) || 0, qr_data: t.qrisString || null, server_ref: srv ? srv.id : null, now })
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true, order: id, kind, plan: pl.id, days, amount, total_amount: total, qr_url: t.qrisString ? `/api/tools/ptero/order-qr?order=${encodeURIComponent(id)}` : /^data:image\//.test(t.qrisImage || '') ? t.qrisImage : null, payment_url: httpsOnly(t.paymentUrl), expired_at: new Date(exp).toISOString() })
}
ptero.post('/order', (c) => createOrder(c, 'new'))
ptero.post('/renew', (c) => createOrder(c, 'renew'))

const ownOrder = async (c, id) => {
    if (!/^[\w\-]{3,80}$/.test(id)) return null
    const o = await store(c).pteroOrder(id)
    return o && o.user_id === c.get('user').id ? o : null
}
const settleOut = (c, id, r) => {
    if (r.err) return btzErr(c, r.err)
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true, order: id, status: r.status, server: r.server || null, ...(r.status === 'failed' ? { message: 'Pembayaran sudah kami terima. Panel sedang disiapkan ulang otomatis; jika lebih dari beberapa menit hubungi admin.' } : {}) })
}
/* Cek status (sekaligus menuntaskan: kalau sudah dibayar, server dibuat/diperpanjang otomatis). */
ptero.get('/order-status', async (c) => {
    const id = String(c.req.query('order') || '').trim(), o = await ownOrder(c, id)
    if (!o) return out(c, 404, 'not_found', 'Order tidak ditemukan di akunmu.')
    return settleOut(c, id, await settlePteroOrder(c.env, store(c), o))
})
ptero.post('/order-cancel', async (c) => {
    const id = String((await body(c)).order || '').trim(), st = store(c), o = await ownOrder(c, id)
    if (!o) return out(c, 404, 'not_found', 'Order tidak ditemukan di akunmu.')
    if (o.status === 'pending') {   /* kalau ternyata sudah dibayar, jangan dibatalkan: tuntaskan */
        const r = await settlePteroOrder(c.env, st, o)
        if (r.err) return btzErr(c, r.err)
        if (r.status !== 'pending') return settleOut(c, id, r)
        if (c.env.BTZPAY_APIKEY) { const k = await btzCancel(c.env, c.env.BTZPAY_APIKEY, id); if (!k.ok) console.error('[ptero] btz cancel', k.message) }
        await st.pteroOrderStatus(id, 'canceled')
        return c.json({ ok: true, canceled: true, status: 'canceled' })
    }
    return c.json({ ok: true, status: o.status, server: o.server_ref || null })
})
ptero.get('/order-qr', async (c) => {
    const o = await ownOrder(c, String(c.req.query('order') || '').trim())
    if (!o || !o.qr_data) return out(c, 404, 'not_found', 'QR tidak ditemukan.')
    const q = await btzQr(c.env, o.qr_data)
    if (!q) return out(c, 502, 'qr_failed', 'QR gagal dibuat.')
    return c.body(q.body, 200, { 'Content-Type': q.type, 'Cache-Control': 'private, max-age=600' })
})

/* Daftar server milik user + order yang masih berjalan (untuk melanjutkan pembayaran/menunggu pembuatan). */
ptero.get('/servers', async (c) => {
    const st = store(c), uid = c.get('user').id, now = Date.now()
    const [servers, orders] = await Promise.all([st.pteroServersOf(uid), st.pteroUserOrders(uid)])
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true, now, servers: servers.map((s) => ({ ...s, plan_name: (planById(s.plan) || {}).name || s.plan, expired: s.status !== 'active' || s.expires_at < now })),
        orders: orders.filter((o) => ['pending', 'provisioning', 'failed'].includes(o.status)) })
})

/* ================= Kelola server ================= */
ptero.get('/s/:id', act(async (c, srv, cfg) => {
    const brief = { id: srv.id, name: srv.name, plan: srv.plan, plan_name: (planById(srv.plan) || {}).name || srv.plan, status: srv.status, expires_at: srv.expires_at }
    /* server yang sudah habis/di-suspend: jangan menyentuh panel, cukup beri tahu UI supaya menampilkan tombol Perpanjang */
    if (srv.status !== 'active' || srv.expires_at < Date.now()) return c.json({ ok: true, expired: true, server: brief, state: null, resources: null })
    const [d, r] = await Promise.all([cli(cfg, base(srv)), cli(cfg, base(srv) + '/resources')])
    if (!d.ok) return pErr(c, d)
    const a = d.data.attributes || {}, res = r.ok ? r.data.attributes : null
    return c.json({ ok: true, expired: false, server: { ...brief, limits: a.limits || null, panel_status: a.status || null, is_suspended: !!a.is_suspended, maintenance: !!a.is_node_under_maintenance },
        state: res ? res.current_state : null, resources: res ? res.resources : null })
}, { allowExpired: true }))

ptero.post('/s/:id/power', act(async (c, srv, cfg) => {
    const sig = String((await body(c)).signal || '')
    if (!['start', 'stop', 'restart', 'kill'].includes(sig)) return out(c, 400, 'bad_signal', 'Aksi tidak dikenal.')
    const r = await cli(cfg, base(srv) + '/power', { method: 'POST', json: { signal: sig } })
    return r.ok ? c.json({ ok: true }) : pErr(c, r)
}))
ptero.post('/s/:id/command', act(async (c, srv, cfg) => {
    const cmd = String((await body(c)).command || '')
    if (!cmd.trim() || cmd.length > 2000) return out(c, 400, 'bad_command', 'Perintah kosong atau terlalu panjang.')
    const r = await cli(cfg, base(srv) + '/command', { method: 'POST', json: { command: cmd } })
    return r.ok ? c.json({ ok: true }) : pErr(c, r)
}))

/* ---- file manager ---- */
ptero.get('/s/:id/files', act(async (c, srv, cfg) => {
    const dir = safePath(c.req.query('dir')); if (dir === null) return out(c, 400, 'bad_path', 'Path tidak valid.')
    const r = await cli(cfg, `${base(srv)}/files/list?directory=${E(dir)}`)
    if (!r.ok) return pErr(c, r)
    return c.json({ ok: true, dir, files: (r.data.data || []).map((x) => { const a = x.attributes; return { name: a.name, is_file: !!a.is_file, size: a.size, modified_at: a.modified_at, mode: a.mode, mimetype: a.mimetype, symlink: !!a.is_symlink } }) })
}))
ptero.get('/s/:id/file', act(async (c, srv, cfg) => {
    const path = safePath(c.req.query('path')); if (!path || path === '/') return out(c, 400, 'bad_path', 'Path tidak valid.')
    const r = await cli(cfg, `${base(srv)}/files/contents?file=${E(path)}`, { raw: true })
    if (!r.ok) return pErr(c, r)
    const len = Number(r.res.headers.get('content-length') || 0)
    if (len > 1024 * 1024) return out(c, 413, 'too_large', 'File terlalu besar untuk diedit di web (maks 1 MB). Unduh saja.')
    const text = await r.res.text()
    if (text.length > 1024 * 1024) return out(c, 413, 'too_large', 'File terlalu besar untuk diedit di web (maks 1 MB). Unduh saja.')
    return c.json({ ok: true, path, content: text })
}))
ptero.put('/s/:id/file', act(async (c, srv, cfg) => {
    const path = safePath(c.req.query('path')); if (!path || path === '/') return out(c, 400, 'bad_path', 'Path tidak valid.')
    const text = await c.req.text()
    const r = await cli(cfg, `${base(srv)}/files/write?file=${E(path)}`, { method: 'POST', body: text, headers: { 'Content-Type': 'text/plain' } })
    return r.ok ? c.json({ ok: true }) : pErr(c, r)
}))
ptero.post('/s/:id/folder', act(async (c, srv, cfg) => {
    const b = await body(c), root = safePath(b.root), name = String(b.name || '')
    if (root === null || !NAME_RE.test(name)) return out(c, 400, 'bad_path', 'Nama folder tidak valid.')
    const r = await cli(cfg, base(srv) + '/files/create-folder', { method: 'POST', json: { root, name } })
    return r.ok ? c.json({ ok: true }) : pErr(c, r)
}))
ptero.post('/s/:id/rename', act(async (c, srv, cfg) => {
    const b = await body(c), root = safePath(b.root), from = String(b.from || ''), to = String(b.to || '')
    if (root === null || !NAME_RE.test(from) || !NAME_RE.test(to)) return out(c, 400, 'bad_path', 'Nama tidak valid.')
    const r = await cli(cfg, base(srv) + '/files/rename', { method: 'PUT', json: { root, files: [{ from, to }] } })
    return r.ok ? c.json({ ok: true }) : pErr(c, r)
}))
ptero.post('/s/:id/delete', act(async (c, srv, cfg) => {
    const b = await body(c), root = safePath(b.root), files = names(b.files)
    if (root === null || !files) return out(c, 400, 'bad_path', 'Pilih file/folder yang valid.')
    const r = await cli(cfg, base(srv) + '/files/delete', { method: 'POST', json: { root, files } })
    return r.ok ? c.json({ ok: true }) : pErr(c, r)
}))
ptero.post('/s/:id/compress', act(async (c, srv, cfg) => {
    const b = await body(c), root = safePath(b.root), files = names(b.files)
    if (root === null || !files) return out(c, 400, 'bad_path', 'Pilih file/folder yang valid.')
    const r = await cli(cfg, base(srv) + '/files/compress', { method: 'POST', json: { root, files }, timeout: 60000 })
    return r.ok ? c.json({ ok: true }) : pErr(c, r)
}))
ptero.post('/s/:id/decompress', act(async (c, srv, cfg) => {
    const b = await body(c), root = safePath(b.root), file = String(b.file || '')
    if (root === null || !NAME_RE.test(file)) return out(c, 400, 'bad_path', 'File arsip tidak valid.')
    const r = await cli(cfg, base(srv) + '/files/decompress', { method: 'POST', json: { root, file }, timeout: 60000 })
    return r.ok ? c.json({ ok: true }) : pErr(c, r)
}))
/* Unduh: panel memberi link bertanda tangan ke node (berlaku singkat); browser membukanya langsung. */
ptero.get('/s/:id/download', act(async (c, srv, cfg) => {
    const path = safePath(c.req.query('path')); if (!path || path === '/') return out(c, 400, 'bad_path', 'Path tidak valid.')
    const r = await cli(cfg, `${base(srv)}/files/download?file=${E(path)}`)
    const url = r.ok && r.data && r.data.attributes && httpsOnly(r.data.attributes.url)
    return url ? c.json({ ok: true, url }) : r.ok ? out(c, 502, 'panel_error', 'Link unduhan tidak tersedia.') : pErr(c, r)
}))
/* Unggah: browser mengirim multipart ke server Arvo, lalu diteruskan (streaming) ke node lewat link bertanda tangan.
 * Browser tidak perlu tahu alamat node, dan tidak butuh pengaturan CORS di Wings. Maks 25 MB per permintaan. */
ptero.post('/s/:id/upload', act(async (c, srv, cfg) => {
    const len = Number(c.req.header('content-length') || 0), ct = c.req.header('content-type') || ''
    if (!len) return out(c, 411, 'length_required', 'Ukuran file tidak diketahui.')
    if (len > UPLOAD_MAX) return out(c, 413, 'too_large', `File terlalu besar (maks ${UPLOAD_MAX / 1048576} MB per unggahan).`)
    if (!/^multipart\/form-data/i.test(ct)) return out(c, 400, 'bad_type', 'Format unggahan tidak valid.')
    const dir = safePath(c.req.query('dir')); if (dir === null) return out(c, 400, 'bad_path', 'Path tidak valid.')
    const u = await cli(cfg, base(srv) + '/files/upload')
    const url = u.ok && u.data && u.data.attributes && u.data.attributes.url
    if (!url || !/^https?:\/\//.test(url)) return u.ok ? out(c, 502, 'panel_error', 'Link unggah tidak tersedia.') : pErr(c, u)
    let r
    try { r = await fetch(`${url}${url.includes('?') ? '&' : '?'}directory=${E(dir)}`, { method: 'POST', headers: { 'Content-Type': ct }, body: c.req.raw.body, duplex: 'half', signal: AbortSignal.timeout(120000) }) }
    catch (e) { return out(c, 504, 'node_unreachable', 'Node tidak merespons saat mengunggah.') }
    return r.ok ? c.json({ ok: true }) : out(c, 502, 'upload_failed', `Unggah ditolak node (HTTP ${r.status}).`)
}))

/* ---- startup, nama, instal ulang ---- */
ptero.get('/s/:id/startup', act(async (c, srv, cfg) => {
    const r = await cli(cfg, base(srv) + '/startup')
    if (!r.ok) return pErr(c, r)
    return c.json({ ok: true, command: (r.data.meta && r.data.meta.startup_command) || '', variables: (r.data.data || []).map((x) => { const a = x.attributes; return { key: a.env_variable, name: a.name, description: a.description, value: a.server_value ?? a.default_value ?? '', editable: !!a.is_editable } }) })
}))
ptero.put('/s/:id/startup', act(async (c, srv, cfg) => {
    const b = await body(c), key = String(b.key || ''), value = String(b.value ?? '')
    if (!/^[A-Z0-9_]{1,80}$/.test(key) || value.length > 2000) return out(c, 400, 'bad_variable', 'Variabel tidak valid.')
    const r = await cli(cfg, base(srv) + '/startup/variable', { method: 'PUT', json: { key, value } })
    return r.ok ? c.json({ ok: true }) : pErr(c, r)
}))
ptero.post('/s/:id/rename-server', act(async (c, srv, cfg) => {
    const name = String((await body(c)).name || '').trim().replace(/[^A-Za-z0-9 _.-]/g, '').slice(0, 60)
    if (!name) return out(c, 400, 'bad_name', 'Nama tidak valid (huruf, angka, spasi, - _ .).')
    const r = await cli(cfg, base(srv) + '/settings/rename', { method: 'POST', json: { name } })
    if (!r.ok) return pErr(c, r)
    await store(c).pteroServerRename(srv.id, name)
    return c.json({ ok: true, name })
}))
ptero.post('/s/:id/reinstall', act(async (c, srv, cfg) => {
    const r = await cli(cfg, base(srv) + '/settings/reinstall', { method: 'POST' })
    return r.ok ? c.json({ ok: true }) : pErr(c, r)
}))
