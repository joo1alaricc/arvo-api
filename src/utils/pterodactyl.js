import { btzStatus, OK, DEAD } from './btzpay.js'

/* ============================================================================
 * Panel Pterodactyl: klien API panel, paket & harga, pembuatan server otomatis, dan penyelesaian pembayaran.
 *
 * Kunci API, Client API key, dan domain panel DIATUR ADMIN di Dashboard Admin > Pterodactyl (disimpan di database, bukan di kode)
 * dan TIDAK PERNAH dikirim ke browser. Browser hanya bicara ke server Arvo; server Arvo yang bicara ke panel.
 *
 *   apikey  : Application API key (ptla_...), membuat user/server, suspend, hapus.
 *   capikey : Client API key (ptlc_...) milik akun ROOT ADMIN, menjalankan power, konsol, file manager, startup untuk SEMUA server.
 * ========================================================================== */

/* Angka memori/disk persis seperti yang kamu tentukan. 0 = unlimited di Pterodactyl. Harga per 30 hari. */
export const PLANS = [
    { id: 'p1', name: 'Paket 1', memory: 1024, disk: 1024, cpu: 30, price: 3300 },
    { id: 'p2', name: 'Paket 2', memory: 2024, disk: 2024, cpu: 50, price: 5000 },
    { id: 'p3', name: 'Paket 3', memory: 3024, disk: 3024, cpu: 75, price: 7000 },
    { id: 'p4', name: 'Paket 4', memory: 4024, disk: 4024, cpu: 100, price: 9000 },
    { id: 'p5', name: 'Paket 5', memory: 5024, disk: 5024, cpu: 125, price: 11000 },
    { id: 'p6', name: 'Paket 6', memory: 6024, disk: 6024, cpu: 150, price: 13000 },
    { id: 'p7', name: 'Paket 7', memory: 7024, disk: 7024, cpu: 175, price: 15000 },
    { id: 'p8', name: 'Paket 8 (Unlimited)', memory: 0, disk: 0, cpu: 0, price: 17000, unlimited: true },
]
export const MIN_DAYS = 7, MAX_DAYS = 365
export const planById = (id) => PLANS.find((p) => p.id === id) || null
/* Harga dihitung di SERVER (bukan dari kiriman browser): harga 30 hari x durasi / 30, dibulatkan ke atas per Rp100, minimal Rp1.000. */
export const quote = (plan, days) => Math.max(1000, Math.ceil((plan.price * days) / 30 / 100) * 100)
const DAY = 864e5

export const DEFAULTS = { enabled: false, domain: '', apikey: '', capikey: '', nest_id: 0, egg_id: 0, location_id: 0, grace_days: 3, databases: 0, backups: 0, env_json: '', docker_image: '', startup: '' }

export const loadPteroCfg = async (st) => ({ ...DEFAULTS, ...((await st.pteroCfg()) || {}) })
export const cfgReady = (c) => !!(c && c.domain && c.apikey && c.capikey && c.nest_id > 0 && c.egg_id > 0 && c.location_id > 0)

/* domain panel: hanya https, hanya origin (path/kredensial dibuang) */
export const normDomain = (v) => {
    const s = String(v || '').trim()
    if (!s) return ''
    try {
        const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s)
        if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.')) return null
        return u.origin
    } catch { return null }
}
const int = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }

/* Validasi pengaturan dari admin. Key kosong = tetap pakai yang tersimpan. */
export const cleanCfg = (b, cur) => {
    const o = { ...DEFAULTS, ...cur }
    if ('enabled' in b) o.enabled = !!b.enabled
    if ('domain' in b) { const d = normDomain(b.domain); if (d === null) return { error: 'Domain panel harus berupa https://panel.domainmu.com' }; o.domain = d }
    for (const [k, prefix, label] of [['apikey', 'ptla_', 'Application API key'], ['capikey', 'ptlc_', 'Client API key']]) {
        if (b['clear_' + k]) { o[k] = ''; continue }
        const v = String(b[k] || '').trim()
        if (!v) continue
        if (!v.startsWith(prefix) || v.length < 20 || /\s/.test(v)) return { error: `${label} tidak valid (harus diawali ${prefix}).` }
        o[k] = v
    }
    for (const k of ['nest_id', 'egg_id', 'location_id']) if (k in b) o[k] = int(b[k], 0, 1e9, o[k])
    if ('grace_days' in b) o.grace_days = int(b.grace_days, 0, 60, o.grace_days)
    if ('databases' in b) o.databases = int(b.databases, 0, 50, o.databases)
    if ('backups' in b) o.backups = int(b.backups, 0, 50, o.backups)
    if ('docker_image' in b) o.docker_image = String(b.docker_image || '').trim().slice(0, 200)
    if ('startup' in b) o.startup = String(b.startup || '').trim().slice(0, 2000)
    if ('env_json' in b) {
        const t = String(b.env_json || '').trim()
        if (t) { try { const j = JSON.parse(t); if (!j || typeof j !== 'object' || Array.isArray(j)) throw 0 } catch { return { error: 'Variabel environment harus JSON objek, mis. {"CMD_RUN":"npm start"}.' } } }
        o.env_json = t.slice(0, 4000)
    }
    return { cfg: o }
}
const hint = (k) => (k ? `${k.slice(0, 5)}…${k.slice(-4)}` : '')
/* Versi aman untuk dikirim ke dashboard admin: kunci TIDAK dikirim, hanya petunjuk 5 huruf awal + 4 akhir. */
export const publicCfg = (c) => ({ ...c, apikey: '', capikey: '', apikey_set: !!c.apikey, capikey_set: !!c.capikey, apikey_hint: hint(c.apikey), capikey_hint: hint(c.capikey), ready: cfgReady(c) })

/* ---------------- panggilan HTTP ke panel ---------------- */
const req = async (cfg, key, path, { method = 'GET', json, body, headers, raw = false, timeout = 20000 } = {}) => {
    let r
    try {
        r = await fetch(cfg.domain + path, {
            method, signal: AbortSignal.timeout(timeout), body: json !== undefined ? JSON.stringify(json) : body,
            headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
        })
    } catch (e) { return { ok: false, status: 504, error: 'panel_unreachable', message: e.name === 'TimeoutError' ? 'Panel Pterodactyl tidak merespons (timeout).' : 'Tidak bisa menghubungi panel Pterodactyl.' } }
    if (raw && r.ok) return { ok: true, status: r.status, res: r }
    const text = await r.text().catch(() => '')
    let j = null
    try { j = text ? JSON.parse(text) : null } catch {}
    if (!r.ok) {
        const d = j && j.errors && j.errors[0]
        const msg = d ? `${d.detail || d.code || ''}`.trim() : text.slice(0, 200)
        return { ok: false, status: r.status, error: 'panel_error', message: `Panel (${r.status}): ${msg}`.slice(0, 300), errors: j && j.errors }
    }
    return { ok: true, status: r.status, data: j }
}
const app = (cfg, path, o) => req(cfg, cfg.apikey, '/api/application' + path, o)
export const cli = (cfg, path, o) => req(cfg, cfg.capikey, '/api/client' + path, o)
const E = encodeURIComponent

/* ---------------- Application API ---------------- */
export const testConnection = async (cfg) => {
    const out = { app_ok: false, client_ok: false, nests: [], locations: [], messages: [] }
    if (!cfg.domain) { out.messages.push('Domain panel belum diisi.'); return out }
    if (!cfg.apikey) out.messages.push('Application API key belum diisi.')
    else {
        const n = await app(cfg, '/nests?include=eggs&per_page=100')
        if (n.ok) {
            out.app_ok = true
            out.nests = (n.data.data || []).map((x) => ({ id: x.attributes.id, name: x.attributes.name, eggs: ((x.attributes.relationships && x.attributes.relationships.eggs && x.attributes.relationships.eggs.data) || []).map((e) => ({ id: e.attributes.id, name: e.attributes.name })) }))
            const l = await app(cfg, '/locations?per_page=100')
            if (l.ok) out.locations = (l.data.data || []).map((x) => ({ id: x.attributes.id, name: x.attributes.short }))
        } else out.messages.push('Application API key: ' + n.message)
    }
    if (!cfg.capikey) out.messages.push('Client API key belum diisi.')
    else {
        const c = await cli(cfg, '/account')
        if (c.ok) {
            /* Client key harus milik akun ROOT ADMIN supaya bisa mengendalikan server milik user lain */
            if (c.data && c.data.attributes && c.data.attributes.admin === true) out.client_ok = true
            else out.messages.push('Client API key ini bukan milik akun root admin (tidak bisa mengakses server semua user). Buat Client key dari akun admin utama.')
        } else out.messages.push('Client API key: ' + c.message)
    }
    return out
}

const rnd = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 54]).join('')

/* Satu akun panel per akun Arvo (hanya sebagai pemilik server; user mengelola semuanya lewat web Arvo, tidak perlu login ke panel). */
export const ensurePanelUser = async (cfg, st, uid) => {
    const have = await st.pteroPanelUser(uid)
    if (have) return have.panel_user_id
    const owner = await st.pteroOwner(uid)
    if (!owner) throw new Error('Akun Arvo tidak ditemukan.')
    const username = `arvo${uid}`, email = `arvo-u${uid}@${new URL(cfg.domain).hostname}`
    let r = await app(cfg, '/users', { method: 'POST', json: { email, username, first_name: String(owner.username).replace(/[^\w .-]/g, '').slice(0, 40) || 'Arvo', last_name: 'User', password: rnd(24) } })
    let id = r.ok ? r.data.attributes.id : null
    if (!id && (r.status === 422 || r.status === 409)) {   /* sudah ada (mis. dibuat sebelumnya): ambil id-nya */
        const f = await app(cfg, `/users?filter[email]=${E(email)}`)
        id = f.ok && f.data.data && f.data.data[0] ? f.data.data[0].attributes.id : null
    }
    if (!id) throw new Error('Gagal membuat akun panel: ' + (r.message || 'tidak diketahui'))
    await st.pteroSetPanelUser(uid, id, username)
    return id
}

const getEgg = async (cfg) => {
    const r = await app(cfg, `/nests/${cfg.nest_id}/eggs/${cfg.egg_id}?include=variables`)
    if (!r.ok) throw new Error('Egg tidak bisa dibaca: ' + r.message)
    const a = r.data.attributes
    const image = cfg.docker_image || a.docker_image || Object.values(a.docker_images || {})[0]
    if (!image) throw new Error('Egg tidak punya docker image. Isi "Docker image" di pengaturan admin.')
    const env = {}
    for (const v of (a.relationships && a.relationships.variables && a.relationships.variables.data) || []) env[v.attributes.env_variable] = v.attributes.default_value ?? ''
    let extra = {}
    try { extra = cfg.env_json ? JSON.parse(cfg.env_json) : {} } catch {}
    return { image, startup: cfg.startup || a.startup, env: { ...env, ...extra } }
}

export const serverBody = (cfg, plan, panelUserId, name, external, egg) => ({
    name, user: panelUserId, external_id: external, egg: cfg.egg_id, docker_image: egg.image, startup: egg.startup, environment: egg.env,
    description: `Arvo ${plan.name}`,
    limits: { memory: plan.memory, swap: 0, disk: plan.disk, io: 500, cpu: plan.cpu },
    feature_limits: { databases: cfg.databases, allocations: 1, backups: cfg.backups },
    deploy: { locations: [cfg.location_id], dedicated_ip: false, port_range: [] },
    start_on_completion: false, skip_scripts: false, oom_disabled: true,
})

/* Buat server baru untuk order yang sudah dibayar. Aman diulang: external_id memastikan server yang sama tidak dibuat dua kali. */
export const provisionNew = async (cfg, st, o) => {
    const plan = planById(o.plan); if (!plan) throw new Error('Paket tidak dikenal: ' + o.plan)
    const external = `arvo-${o.id}`
    let attrs = null
    const ex = await app(cfg, `/servers/external/${E(external)}`)
    if (ex.ok) attrs = ex.data.attributes
    else if (ex.status !== 404) throw new Error(ex.message)
    if (!attrs) {
        const uid = await ensurePanelUser(cfg, st, o.user_id)
        const egg = await getEgg(cfg)
        const owner = await st.pteroOwner(o.user_id)
        const name = `${(owner && owner.username) || 'user'}-${plan.id}`.replace(/[^A-Za-z0-9 _.-]/g, '').slice(0, 60)
        const r = await app(cfg, '/servers', { method: 'POST', json: serverBody(cfg, plan, uid, name, external, egg), timeout: 45000 })
        if (!r.ok) throw new Error(r.message)
        attrs = r.data.attributes
    }
    const done = await st.pteroNewDone(o.id, { plan: plan.id, name: attrs.name, panel_user_id: attrs.user, server_id: attrs.id, uuid: attrs.uuid, identifier: attrs.identifier }, Date.now())
    if (!done || done.ok === false) throw new Error((done && done.message) || 'Gagal menyimpan server.')
    return done.server
}

export const suspendServer = (cfg, serverId) => app(cfg, `/servers/${serverId}/suspend`, { method: 'POST' })
export const unsuspendServer = (cfg, serverId) => app(cfg, `/servers/${serverId}/unsuspend`, { method: 'POST' })
export const deleteServer = (cfg, serverId) => app(cfg, `/servers/${serverId}`, { method: 'DELETE' })

/* Perpanjang server yang sudah ada. Urutan: aktifkan lagi di panel dulu, baru tambah hari (kalau langkah pertama gagal, tidak ada hari yang terpotong). */
export const provisionRenew = async (cfg, st, o) => {
    const s = await st.pteroServer(o.server_ref)
    if (!s || s.status === 'deleted') throw new Error('Server sudah dihapus; hubungi admin.')
    if (s.status === 'suspended') {
        const r = await unsuspendServer(cfg, s.server_id)
        if (!r.ok && r.status !== 404) throw new Error(r.message)
    }
    const done = await st.pteroRenewDone(o.id, Date.now())
    if (!done || done.ok === false) throw new Error((done && done.message) || 'Gagal memperpanjang.')
    return done.server
}

/* Cocokkan satu order dengan BTZPay. Status SELALU diambil ulang dari BTZPay (isi callback tidak dipercaya).
 * Setelah lunas: server dibuat/diperpanjang SEKALI saja (klaim atomik di database), aman dipanggil bersamaan dari callback + polling + cron. */
export const settlePteroOrder = async (env, st, o, deps = {}) => {
    const getStatus = deps.btzStatus || btzStatus
    if (['active', 'canceled', 'expired', 'review'].includes(o.status)) return { status: o.status, server: o.server_ref || null }
    if (o.status === 'pending') {
        if (!o.access_key) return { err: { status: 500, error: 'no_access_key', message: 'Order tidak punya access key BTZPay.' } }
        const r = await getStatus(env, o.id, o.access_key)
        if (!r.ok) return { err: r }
        const t = r.data || {}, s = String(t.status || 'pending')
        if (DEAD.test(s)) { const k = /cancel/i.test(s) ? 'canceled' : 'expired'; await st.pteroOrderStatus(o.id, k); return { status: k } }
        if (!OK.test(s)) return { status: 'pending' }
        if (Number(t.amount) !== o.amount && Number(t.totalAmount) !== o.total) {
            console.error('[ptero] nominal tidak cocok', o.id, t.amount, t.totalAmount, o.amount, o.total)
            await st.pteroOrderStatus(o.id, 'review'); return { status: 'review' }
        }
    }
    const claim = await st.pteroClaim(o.id, Date.now(), !!deps.force)
    if (!claim) { const cur = (await st.pteroOrder(o.id)) || o; return { status: cur.status === 'active' ? 'active' : cur.status === 'failed' ? 'failed' : 'provisioning', server: cur.server_ref || null } }
    try {
        const cfg = await loadPteroCfg(st)
        if (!cfgReady(cfg)) throw new Error('Panel Pterodactyl belum dikonfigurasi lengkap oleh admin.')
        const server = claim.kind === 'renew' ? await provisionRenew(cfg, st, claim) : await provisionNew(cfg, st, claim)
        return { status: 'active', server }
    } catch (e) {
        console.error('[ptero] provisioning gagal', o.id, e.message || e)
        await st.pteroOrderFail(o.id, e.message || String(e))
        return { status: 'failed', error: String(e.message || e) }
    }
}

/* Dijalankan cron: suspend server yang habis, hapus yang melewati masa tenggang, ulangi pembuatan yang gagal, rapikan order kedaluwarsa. */
export const sweep = async (env) => {
    const st = env.STORE.get(env.STORE.idFromName('main'))
    const cfg = await loadPteroCfg(st)
    if (!cfgReady(cfg)) return { skipped: true }
    const due = await st.pteroDue(Date.now(), cfg.grace_days)
    const res = { suspended: 0, deleted: 0, retried: 0 }
    for (const s of due.suspend) {
        const r = await suspendServer(cfg, s.server_id)
        if (r.ok || r.status === 404) { await st.pteroServerStatus(s.id, r.ok ? 'suspended' : 'deleted'); res.suspended++ } else console.error('[ptero] suspend', s.id, r.message)
    }
    for (const s of due.remove) {
        const r = await deleteServer(cfg, s.server_id)
        if (r.ok || r.status === 404) { await st.pteroServerStatus(s.id, 'deleted'); res.deleted++ } else console.error('[ptero] delete', s.id, r.message)
    }
    for (const o of due.retry) { const r = await settlePteroOrder(env, st, o); if (r.status === 'active') res.retried++ }
    return res
}

/* ---------------- Client API: dipakai halaman kelola server ---------------- */
export const wsCreds = async (cfg, identifier) => {
    const r = await cli(cfg, `/servers/${identifier}/websocket`)
    if (!r.ok) throw Object.assign(new Error(r.message), { status: r.status })
    const d = r.data && r.data.data
    if (!d || !d.token || !d.socket) throw new Error('Panel tidak memberi akses konsol.')
    return d
}
export const safePath = (v, d = '/') => { const s = String(v ?? d); return s.length > 1024 || s.includes('\0') ? null : s }
export { E as enc }
