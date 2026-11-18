import { Hono } from 'hono'
import { store, send, fail, currentUser } from '../utils/session.js'
import { refreshBlocked } from '../utils/rateLimit.js'
import { getOverrides, refreshOverrides } from '../utils/overrides.js'
import { BUILTIN_PATHS, builtinInfo } from './index.js'
import { ghStatus, ghTree, ghGet, ghPut, ghDelete, ghRuns, safePath, b64ToText, textToB64 } from '../utils/github.js'
import { analyze, build, readBack, patchIndex, exportNames, slugFrom, EXAMPLE, STRUCTURE_HELP } from '../utils/endpointGen.js'
import { makeQris, qrisInfo } from '../utils/payment.js'
import { loadCfg, cleanCfg, secretsStatus, btzCreate, btzStatus, btzCancel, btzSimulate, qrUrl, httpsOnly, base } from '../utils/btzpay.js'

/* Dashboard admin.
 *  - Panel hanya bisa dibuka setelah login (sesi) sebagai pengelola, atau memakai access key di header x-access-key. IP tidak memberi akses.
 *  - super admin : akun dengan email terverifikasi di ADMIN_EMAILS. Boleh semuanya.
 *  - admin       : user yang ditambahkan super admin (tab Tim). TIDAK boleh: tambah/hapus admin, endpoint, update kode (GitHub). */
export const admin = new Hono()
const body = (c) => c.req.json().catch(() => ({}))

admin.use('*', async (c, next) => {
    /* Access key (header x-access-key / query accesskey): tanpa sesi login, level mengikuti pemilik key */
    const ak = c.req.header('x-access-key') || c.req.query('accesskey')
    if (ak) {
        const v = await store(c).verifyAccess(ak).catch(() => null)
        if (v && v.ok !== false) { c.set('adminLevel', v.level); c.set('adminName', v.name); return next() }
        return c.json({ error: 'invalid_access_key', message: 'Access key tidak valid.', status: 401 }, 401)
    }
    const u = await currentUser(c).catch(() => null)
    const lv = u && await store(c).adminLevel(u.id)
    if (lv) { c.set('adminLevel', lv); c.set('adminName', u.username); return next() }
    return c.json({ error: 'Forbidden', message: `Bukan admin (IP ${c.get('ip')}).`, status: 403 }, 403)
})
const superOnly = async (c, next) => c.get('adminLevel') === 'super' ? next()
    : c.json({ error: 'Forbidden', message: 'Hanya super admin (owner) yang boleh melakukan ini.', status: 403 }, 403)
for (const p of ['/endpoints', '/endpoints/*', '/builtin', '/builtin/*', '/admins', '/admins/*', '/github', '/github/*', '/deploy', '/deploy/*', '/code-endpoints', '/code-endpoints/*', '/media/hero']) admin.use(p, superOnly)
const who = (c) => `[Arvo:${c.get('adminName')}]`
admin.get('/stats', async (c) => send(c, await store(c).adminStats(Date.now())))
admin.get('/users', async (c) => send(c, await store(c).adminUsers(c.req.query('q'), Date.now())))
admin.post('/users/:id/grant', async (c) => {
    const b = await body(c)
    return send(c, await store(c).adminGrant(+c.req.param('id'), b.plan, b.days, !!b.permanent, Date.now()))
})
admin.post('/users/:id/revoke', async (c) => send(c, await store(c).adminRevoke(+c.req.param('id'))))
admin.get('/orders', async (c) => send(c, await store(c).listOrders()))
admin.post('/orders/:id/confirm', async (c) => send(c, await store(c).confirmById(c.req.param('id'), Date.now())))
admin.post('/orders/:id/cancel', async (c) => send(c, await store(c).cancelOrder(c.req.param('id'))))
admin.get('/codes', async (c) => send(c, await store(c).adminCodes()))
admin.post('/codes', async (c) => send(c, await store(c).adminCreateCode(await body(c), Date.now())))
admin.delete('/codes/:code', async (c) => send(c, await store(c).adminDeleteCode(c.req.param('code'))))

/* ---- detail IP user & blokir IP ---- */
admin.get('/users/:id/ips', async (c) => send(c, await store(c).adminUserIps(+c.req.param('id'))))
admin.get('/blocked', async (c) => send(c, await store(c).adminBlocked()))
admin.post('/blocked', async (c) => {
    const b = await body(c)
    if (String(c.env.OWNER_IPS || '').split(',').map((x) => x.trim()).includes(String(b.ip || '').trim())) return send(c, fail(400, 'owner_ip', 'IP owner tidak boleh diblokir.'))
    const r = await store(c).adminBlock(b.ip, b.reason, Date.now()); refreshBlocked(); return send(c, r)
})
admin.delete('/blocked/:ip', async (c) => { const r = await store(c).adminUnblock(decodeURIComponent(c.req.param('ip'))); refreshBlocked(); return send(c, r) })

/* ---- paket ---- */
admin.get('/plans', async (c) => send(c, await store(c).adminPlans()))
admin.post('/plans', async (c) => send(c, await store(c).adminSavePlan(await body(c), true)))
admin.put('/plans/:id', async (c) => send(c, await store(c).adminSavePlan({ ...(await body(c)), id: c.req.param('id') }, false)))
admin.delete('/plans/:id', async (c) => send(c, await store(c).adminDeletePlan(c.req.param('id'))))

/* ---- konten dashboard (Contributor, S&K, Thanks To) ---- */
admin.get('/site-content', async (c) => c.json({ ok: true, ...(await store(c).siteContent()) }))
admin.put('/site-content', async (c) => send(c, await store(c).adminSaveSiteContent(await body(c))))

/* ---- claim trial ---- */
admin.get('/trial', async (c) => send(c, await store(c).adminTrial()))
admin.put('/trial', async (c) => send(c, await store(c).adminSetTrial(await body(c))))
admin.delete('/trial/claims/:uid', async (c) => send(c, await store(c).adminResetClaim(+c.req.param('uid'))))

/* ---- endpoint dinamis ---- */
admin.get('/builtin', async (c) => {
    const ov = await getOverrides(c)
    return c.json({ ok: true, endpoints: builtinInfo().map((e) => { const o = ov[e.path]; return { ...e, base: { name: e.name, description: e.description, access: e.access, status: e.status }, overridden: !!o, ...(o ? { name: o.name, description: o.description, access: o.access, status: o.status } : {}) } }) })
})
admin.put('/builtin', async (c) => { const r = await store(c).adminSaveBuiltin(await body(c), BUILTIN_PATHS); refreshOverrides(); return send(c, r) })
admin.delete('/builtin/:path', async (c) => { const r = await store(c).adminResetBuiltin('/api/' + decodeURIComponent(c.req.param('path'))); refreshOverrides(); return send(c, r) })
admin.get('/violations', async (c) => send(c, await store(c).adminViolations()))
admin.get('/endpoints', async (c) => send(c, await store(c).listEndpoints()))
admin.post('/endpoints', async (c) => send(c, await store(c).adminSaveEndpoint(await body(c), null, BUILTIN_PATHS, Date.now())))
admin.put('/endpoints/:id', async (c) => send(c, await store(c).adminSaveEndpoint(await body(c), +c.req.param('id'), BUILTIN_PATHS, Date.now())))
admin.delete('/endpoints/:id', async (c) => send(c, await store(c).adminDeleteEndpoint(+c.req.param('id'))))

/* ---------- tim admin (super admin saja) ---------- */
admin.get('/admins', async (c) => send(c, await store(c).listAdmins()))
admin.post('/admins', async (c) => send(c, await store(c).addAdmin((await body(c)).username, 'owner', Date.now())))
admin.post('/admins/user/:id', async (c) => send(c, await store(c).makeAdmin(+c.req.param('id'), c.get('adminName'), Date.now())))
admin.delete('/admins/:id', async (c) => send(c, await store(c).removeAdmin(+c.req.param('id'))))

/* ---------- pembayaran / QRIS ---------- */
admin.get('/qris', async (c) => {
    const saved = await store(c).getQrisStatic()
    return c.json({ ok: true, source: c.env.QRIS_STATIC ? 'secret' : saved ? 'dashboard' : 'image_url', image_url: c.env.QRIS_IMAGE_URL || null, info: saved ? qrisInfo(saved) : null, payload_preview: saved ? saved.slice(0, 24) + '…' : null })
})
admin.put('/qris', async (c) => {
    const payload = String((await body(c)).payload || '').trim(), info = qrisInfo(payload)
    if (!info.valid) return send(c, fail(400, 'bad_qris', info.message))
    if (!info.is_static) return send(c, fail(400, 'not_static', 'Ini QRIS dinamis (sudah ada nominal). Pakai QRIS statis milikmu (yang tanpa nominal).'))
    await store(c).setQrisStatic(payload)
    return c.json({ ok: true, info })
})
admin.post('/qris/test', async (c) => {
    try { return c.json({ ok: true, qris: await makeQris(c.env, 1000 + Math.floor(Math.random() * 99), await store(c).getQrisStatic()) }) }
    catch (e) { return send(c, fail(500, 'qris_fail', e.message)) }
})

/* ---------- pembayaran / BTZPay (deposit saldo) ----------
 * Semua admin boleh melihat; mengubah pengaturan dan memakai Sandbox hanya super admin. Secret tidak pernah dikirim, hanya status terisi/belum. */
const payWrite = async (c, next) => c.req.method === 'GET' || c.get('adminLevel') === 'super' ? next()
    : c.json({ error: 'Forbidden', message: 'Hanya super admin yang boleh mengubah pengaturan pembayaran.', status: 403 }, 403)
admin.use('/pay', payWrite)
admin.use('/pay/*', payWrite)
admin.get('/pay', async (c) => {
    const st = store(c)
    return c.json({ ok: true, config: await loadCfg(c), secrets: secretsStatus(c.env), base_url: base(c.env), callback_url: new URL(c.req.url).origin + '/api/billing/btzpay/callback?t=<BTZPAY_CALLBACK_TOKEN>',
        last_callback: await st.btzCb(), ...(await st.adminDeposits()) })
})
admin.put('/pay', async (c) => {
    const b = await body(c), cur = await loadCfg(c), r = cleanCfg(b, cur)
    if (r.error) return send(c, fail(400, 'bad_config', r.error))
    if (r.cfg.enabled) {
        const miss = ['BTZPAY_APIKEY', 'BTZPAY_CALLBACK_TOKEN'].filter((k) => !c.env[k])
        if (miss.length) return send(c, fail(400, 'secret_missing', `Belum bisa diaktifkan, secret belum diisi: ${miss.join(', ')}.`))
    }
    await store(c).setBtzCfg(r.cfg)
    return c.json({ ok: true, config: r.cfg })
})
/* Sandbox: transaksi uji memakai BTZPAY_SANDBOX_APIKEY, tidak menyentuh saldo user mana pun. Callback uji tetap diterima dan tercatat di "Callback terakhir". */
const sbKey = (c) => c.env.BTZPAY_SANDBOX_APIKEY ? null : send(c, fail(503, 'not_configured', 'Secret BTZPAY_SANDBOX_APIKEY belum diisi (API key Payment Method khusus uji).'))
const sbErr = (c, r) => send(c, fail(r.status || 502, r.error || 'btzpay_error', 'BTZPay: ' + r.message))
admin.post('/pay/sandbox/create', async (c) => {
    const no = sbKey(c); if (no) return no
    const b = await body(c), cfg = await loadCfg(c), amount = Math.floor(Number(b.amount) || 1000)
    if (amount < 1 || amount > 100000) return send(c, fail(400, 'bad_amount', 'Nominal uji 1 sampai 100.000.'))
    const origin = new URL(c.req.url).origin
    const r = await btzCreate(c.env, c.env.BTZPAY_SANDBOX_APIKEY, {
        amount, fee: cfg.fee, paymentMethod: cfg.payment_method, timeout: Math.max(1, Math.min(cfg.timeout_min, 15)) * 60000,
        callback_url: c.env.BTZPAY_CALLBACK_TOKEN ? `${origin}/api/billing/btzpay/callback?t=${encodeURIComponent(c.env.BTZPAY_CALLBACK_TOKEN)}` : undefined,
        notes: 'Uji sandbox Arvo', metadata: { orderId: 'sandbox-' + Date.now(), productName: 'Sandbox Arvo' },
    })
    if (!r.ok) return sbErr(c, r)
    const t = r.data || {}
    return c.json({ ok: true, id: t.transactionId, key: t.accessKey, amount: t.amount ?? amount, fee: t.fee ?? 0, total: t.totalAmount ?? amount, status: t.status || 'pending', expired_at: t.expiredAt || null,
        qr_url: qrUrl(c.env, t), payment_url: httpsOnly(t.paymentUrl), callback_set: !!c.env.BTZPAY_CALLBACK_TOKEN, raw: r.raw })
})
admin.get('/pay/sandbox/status', async (c) => {
    const id = String(c.req.query('id') || ''), key = String(c.req.query('key') || '')
    if (!/^[\w\-]{3,80}$/.test(id) || !/^[\w\-]{8,80}$/.test(key)) return send(c, fail(400, 'bad_request', 'ID / key transaksi tidak valid.'))
    const r = await btzStatus(c.env, id, key)
    return r.ok ? c.json({ ok: true, status: r.data?.status || 'pending', data: r.data, last_callback: await store(c).btzCb() }) : sbErr(c, r)
})
admin.post('/pay/sandbox/simulate', async (c) => {
    const no = sbKey(c); if (no) return no
    const b = await body(c), id = String(b.id || ''), key = String(b.key || '')
    if (!/^[\w\-]{3,80}$/.test(id) || !/^[\w\-]{8,80}$/.test(key)) return send(c, fail(400, 'bad_request', 'ID / key transaksi tidak valid.'))
    const t = await btzStatus(c.env, id, key)
    if (!t.ok) return sbErr(c, t)
    if (!/^pending$/i.test(String(t.data?.status || ''))) return send(c, fail(409, 'not_pending', `Transaksi sudah berstatus ${t.data?.status}.`))
    const r = await btzSimulate(c.env, c.env.BTZPAY_SANDBOX_APIKEY, Number(t.data?.totalAmount))
    return r.ok ? c.json({ ok: true, result: r.raw }) : sbErr(c, r)
})
admin.post('/pay/sandbox/cancel', async (c) => {
    const no = sbKey(c); if (no) return no
    const id = String((await body(c)).id || '')
    if (!/^[\w\-]{3,80}$/.test(id)) return send(c, fail(400, 'bad_request', 'ID transaksi tidak valid.'))
    const r = await btzCancel(c.env, c.env.BTZPAY_SANDBOX_APIKEY, id, 'sandbox_cancel')
    return r.ok ? c.json({ ok: true }) : sbErr(c, r)
})

/* ---------- GitHub: status, tree, satu file per request ---------- */
admin.get('/github', async (c) => send(c, await ghStatus(c.env)))
admin.get('/deploy/runs', async (c) => send(c, await ghRuns(c.env)))
admin.get('/deploy/tree', async (c) => send(c, await ghTree(c.env)))
admin.get('/deploy/file', async (c) => {
    const path = safePath(c.req.query('path')); if (!path) return send(c, fail(400, 'bad_path', 'Path tidak valid.'))
    return send(c, await ghGet(c.env, path))
})
admin.post('/deploy/file', async (c) => {
    const b = await body(c), path = safePath(b.path)
    if (!path) return send(c, fail(400, 'bad_path', 'Path tidak valid.'))
    if (typeof b.content !== 'string' || !/^[A-Za-z0-9+/]*=*$/.test(b.content)) return send(c, fail(400, 'bad_content', 'Isi file harus base64.'))
    if (b.content.length > 30 * 1024 * 1024) return send(c, fail(413, 'too_big', 'File terlalu besar (maks ~22 MB).'))
    return send(c, await ghPut(c.env, path, b.content, `${who(c)} ${b.message || 'update ' + path}`))
})
admin.post('/deploy/delete', async (c) => {
    const b = await body(c), path = safePath(b.path)
    if (!path) return send(c, fail(400, 'bad_path', 'Path tidak valid.'))
    return send(c, await ghDelete(c.env, path, `${who(c)} hapus ${path}`))
})

/* ---------- media (public/media/*) ---------- */
const MEDIA_DIR = 'public/media/'
const MEDIA_EXT = /\.(jpe?g|png|webp|gif|ico|mp4|webm|mp3|ogg|wav)$/i
const mediaName = (n) => { n = String(n || '').trim(); return /^[\w][\w .()-]{0,80}$/.test(n) && MEDIA_EXT.test(n) && !n.includes('..') ? n : null }
admin.get('/media', async (c) => {
    const t = await ghTree(c.env); if (t.ok === false) return send(c, t)
    return c.json({ ok: true, files: Object.entries(t.files).filter(([p]) => p.startsWith(MEDIA_DIR) && p.indexOf('/', MEDIA_DIR.length) < 0 && MEDIA_EXT.test(p))
        .map(([p, f]) => ({ name: p.slice(MEDIA_DIR.length), size: f.size, sha: f.sha })) })
})
admin.put('/media', async (c) => {
    const b = await body(c), name = mediaName(b.name)
    if (!name) return send(c, fail(400, 'bad_name', 'Nama file: huruf/angka/spasi/-/_ dan ekstensi jpg, png, webp, gif, ico, mp4, webm, mp3, ogg, wav.'))
    if (typeof b.data !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(b.data)) return send(c, fail(400, 'bad_content', 'Data harus base64.'))
    if (b.data.length > 16 * 1024 * 1024) return send(c, fail(413, 'too_big', 'Media maksimal ~12 MB.'))
    return send(c, await ghPut(c.env, MEDIA_DIR + name, b.data, `${who(c)} media ${name}`))
})
admin.delete('/media/:name', async (c) => {
    const name = mediaName(decodeURIComponent(c.req.param('name')))
    if (!name) return send(c, fail(400, 'bad_name', 'Nama file tidak valid.'))
    return send(c, await ghDelete(c.env, MEDIA_DIR + name, `${who(c)} hapus media ${name}`))
})
const setVar = (src, key, val) => { const re = new RegExp(`^${key}\\s*=\\s*".*"`, 'm'); return re.test(src) ? src.replace(re, `${key} = "${val}"`) : null }
admin.put('/media/hero', async (c) => {
    const b = await body(c), ok = (v) => v === '' || (/^\/media\/[\w .()-]+$/.test(v) && !v.includes('..'))
    const cur = await ghGet(c.env, 'wrangler.toml'); if (cur.ok === false) return send(c, cur)
    if (!cur.exists) return send(c, fail(404, 'no_toml', 'wrangler.toml tidak ada di repo.'))
    let src = b64ToText(cur.content)
    for (const [key, v] of [['HERO_VIDEO', b.video], ['HERO_POSTER', b.poster]]) {   /* hanya yang dikirim yang diubah */
        if (v === undefined) continue
        if (!ok(String(v))) return send(c, fail(400, 'bad_path', 'Path harus diawali /media/ atau kosong.'))
        src = setVar(src, key, String(v)); if (!src) return send(c, fail(400, 'no_var', `${key} tidak ditemukan di wrangler.toml.`))
    }
    return send(c, await ghPut(c.env, 'wrangler.toml', textToB64(src), `${who(c)} hero video/poster`))
})

/* ---------- endpoint kode nyata (file JS di repo) ---------- */
const CODE_RE = /^src\/api\/([a-z0-9_-]+)\/([a-z0-9_-]+)\.js$/
admin.get('/code-endpoints/help', (c) => c.json({ ok: true, example: EXAMPLE, structure: STRUCTURE_HELP }))
admin.get('/code-endpoints', async (c) => {
    const t = await ghTree(c.env); if (t.ok === false) return send(c, t)
    return c.json({ ok: true, files: Object.keys(t.files).map((p) => p.match(CODE_RE)).filter((m) => m && m[2] !== 'routes').map((m) => ({ category: m[1], slug: m[2], path: m[0] })) })
})
admin.get('/code-endpoints/file', async (c) => {
    const n = exportNames(String(c.req.query('category') || ''), String(c.req.query('slug') || ''))
    if (!CODE_RE.test(n.path)) return send(c, fail(400, 'bad_path', 'Path tidak valid.'))
    const f = await ghGet(c.env, n.path); if (f.ok === false) return send(c, f)
    if (!f.exists) return send(c, fail(404, 'not_found', 'File endpoint tidak ada.'))
    return c.json({ ok: true, ...readBack(b64ToText(f.content)) })
})
const prepare = async (c) => {
    const b = await body(c), { category: cat, slug } = slugFrom(b.path || b.slug, b.category || '')
    if (!cat || !slug) return { fail: { ok: true, valid: false, issues: ['Path & kategori wajib diisi (mis. path /api/downloader/tiktok, kategori downloader).'], notes: [] } }
    Object.assign(b, { category: cat, slug })
    const r = build(b, analyze(b.code, { category: cat, slug, name: String(b.name || '').trim(), access: b.access || 'free', status: b.status === 'offline' ? 'offline' : 'online' }))
    if (!r.ok) return { fail: { ok: true, valid: false, issues: r.issues, notes: r.notes } }
    const dup = await store(c).findEndpoint(r.endpoint.category, r.endpoint.slug)
    if (dup.ok !== false) return { fail: { ok: true, valid: false, issues: [`Path /api/${cat}/${slug} sudah dipakai endpoint buatan dashboard (tab Endpoint). Hapus/ganti path dulu.`], notes: r.notes } }
    return { r, b }
}
admin.post('/code-endpoints/preview', async (c) => {
    const p = await prepare(c); if (p.fail) return c.json(p.fail)
    return c.json({ ok: true, valid: true, mode: p.r.mode, body: p.r.body, notes: p.r.notes, path: p.r.endpoint && `/api/${p.r.endpoint.category}/${p.r.endpoint.slug}`, files: [...p.r.files.map((f) => ({ path: f.path, content: f.content })), { path: 'src/api/index.js', content: `// + import { ${p.r.names.route}, ${p.r.names.handler} } from './${p.r.names.file}'\n// + [${p.r.names.route}, ${p.r.names.handler}],  (ditambahkan ke daftar BUILTIN)` }] })
})
admin.post('/code-endpoints', async (c) => {
    const p = await prepare(c); if (p.fail) return c.json(p.fail, 400)
    const { r } = p, file = r.files[0], steps = []
    if (!safePath(file.path)) return send(c, fail(400, 'bad_path', 'Path tidak valid.'))
    const tree = await ghTree(c.env); if (tree.ok === false) return send(c, tree)
    if (!tree.files[file.path] && BUILTIN_PATHS.includes(`/api/${r.endpoint.category}/${r.endpoint.slug}`)) return send(c, fail(409, 'reserved', 'Path itu dipakai endpoint bawaan lain.'))
    /* 1) file endpoint dulu, 2) src/api/index.js terakhir (yang menghubungkan ke sistem) */
    const w = await ghPut(c.env, file.path, textToB64(file.content), `${who(c)} endpoint ${r.endpoint.category}/${r.endpoint.slug}`)
    if (w.ok === false) return send(c, w)
    steps.push({ path: file.path, ...w })
    const idx = await ghGet(c.env, 'src/api/index.js'); if (idx.ok === false || !idx.exists) return send(c, idx.ok === false ? idx : fail(404, 'no_index', 'src/api/index.js tidak ada di repo.'))
    const pt = patchIndex(b64ToText(idx.content), { file: r.names.file, route: r.names.route, handler: r.names.handler, ...(() => { const c2 = exportNames(r.endpoint.category, r.endpoint.slug); return { routeAs: c2.route, handlerAs: c2.handler } })() })
    if (!pt.ok) return send(c, fail(422, 'index_unknown', `File endpoint sudah dibuat, tapi pendaftaran otomatis gagal: ${pt.message}`))
    if (pt.changed) { const w2 = await ghPut(c.env, 'src/api/index.js', textToB64(pt.src), `${who(c)} daftarkan ${r.endpoint.category}/${r.endpoint.slug}`); if (w2.ok === false) return send(c, w2); steps.push({ path: 'src/api/index.js', ...w2 }) }
    return c.json({ ok: true, path: `/api/${r.endpoint.category}/${r.endpoint.slug}`, steps, notes: r.notes })
})
admin.delete('/code-endpoints/:category/:slug', async (c) => {
    const n = exportNames(c.req.param('category'), c.req.param('slug'))
    if (!CODE_RE.test(n.path)) return send(c, fail(400, 'bad_path', 'Path tidak valid.'))
    const f = await ghGet(c.env, n.path); if (f.ok === false) return send(c, f)
    if (!f.exists) return send(c, fail(404, 'not_found', 'File endpoint tidak ada.'))
    const rb = readBack(b64ToText(f.content))
    /* index.js dulu (lepas referensi), baru hapus file, supaya build tidak pernah mengimpor file yang hilang */
    const idx = await ghGet(c.env, 'src/api/index.js')
    if (idx.ok && idx.exists) {
        const pt = patchIndex(b64ToText(idx.content), { file: n.file, route: rb.route || n.route, handler: rb.handler || n.handler, routeAs: n.route, handlerAs: n.handler }, true)
        if (pt.changed) { const w = await ghPut(c.env, 'src/api/index.js', textToB64(pt.src), `${who(c)} lepas ${n.file}`); if (w.ok === false) return send(c, w) }
    }
    return send(c, await ghDelete(c.env, n.path, `${who(c)} hapus endpoint ${n.file}`))
})
