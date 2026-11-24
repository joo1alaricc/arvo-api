const MENU = {
  ringkasan: ['Ringkasan', 'grid'], pengguna: ['Pengguna', 'user'], endpoint: ['Endpoint', 'link'], paket: ['Paket', 'shield'],
  trial: ['Claim trial', 'gift'], blokir: ['Blokir IP', 'lock'], keamanan: ['Keamanan', 'shield'], order: ['Order', 'bag'], kode: ['Kode redeem', 'key'],
}
const SUPER_ONLY = ['endpoint', 'deploy', 'tim']   /* admin tambahan TIDAK boleh: endpoint, update kode (GitHub), tambah admin */
let LEVEL = 'admin'
const allowed = (k) => k in MENU && (LEVEL === 'super' || !SUPER_ONLY.includes(k))
const view = () => (allowed(location.hash.slice(1)) ? location.hash.slice(1) : 'ringkasan')
const out = () => $('#v')
const load = async (fn) => { try { await fn() } catch (e) { out().innerHTML = `<p class="err">${esc(e.message)}</p>` } }
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
const val = (id) => $('#' + id).value.trim()
const loading = () => (out().innerHTML = '<div class="sk" style="height:18px;width:40%;margin-bottom:12px"></div><div class="sk" style="height:120px"></div>')

/* dialog generik */
function modal(html, cls = '') {
  const d = document.createElement('dialog'); d.className = cls
  d.innerHTML = html; document.body.append(d); d.addEventListener('close', () => setTimeout(() => d.remove(), 650))
  d.addEventListener('click', (e) => { if (e.target === d) d.close() })
  d.showModal(); return d
}
const accessBadge = (a) => `<span class="badge ${a === 'vip' || a === 'owner' ? 'vip' : a === 'premium' ? 'premium' : ''}">${{ free: 'Gratis', premium: 'Premium', vip: 'VIP', owner: 'Owner' }[a] || a}</span>`
const roleBadge = (r) => `<span class="badge ${r}">${r}</span>`

/* tombol admin di daftar pengguna (hanya super admin): jadikan admin = langsung dibuatkan access key */
const adminBtn = (u) => LEVEL !== 'super' ? '' : u.admin === 'super' ? '<span class="badge vip">Super admin</span>'
  : u.admin ? `<button class="btn ghost red" data-xa="${u.id}" data-name="${esc(u.username)}">Cabut admin</button>` : `<button class="btn" data-ma="${u.id}" data-name="${esc(u.username)}">Jadikan admin</button>`

const V = {
  async ringkasan() {
    const [s, ak] = await Promise.all([api('/admin/stats'), api('/auth/me/accesskey').catch(() => ({ access_key: null }))])
    out().innerHTML = `<h1>Ringkasan</h1><div class="panel" id="me"><h3>Status pengelola</h3>
      <div class="kv"><span>Status</span><b><span class="badge ${LEVEL === 'super' ? 'vip' : 'premium'}">${LEVEL === 'super' ? 'Super admin' : 'Admin'}</span></b></div>
      <div class="kv"><span>Akun</span><b>${esc(ME.username)}</b></div>
      <div class="kv"><span>Email</span><b>${esc(ME.email || '–')}</b></div>
      <div class="kv"><span>Access Key</span><b><code id="akv"></code></b></div>
      <div class="row" style="margin-top:10px;gap:8px"><button class="btn sm" id="aksh" type="button">${ico('eye')} Tampilkan</button><button class="btn ghost sm" id="akcp" type="button">${ico('copy')} Salin</button><button class="btn ghost sm" id="akgn" type="button">${ico('plus')} Generate</button></div><p class="msg" id="akm"></p></div>
      <div class="akv panel">
      <div><b>${s.users}</b><span>Total user</span></div><div><b>${s.premium}</b><span>Premium aktif</span></div><div><b>${s.vip}</b><span>VIP aktif</span></div>
      <div><b>${s.requests_today.toLocaleString('id-ID')}</b><span>Request hari ini (key)</span></div>
      <div><b>${rp(s.revenue)}</b><span>Pendapatan (${s.paid_orders} order)</span></div><div><b>${s.pending_orders}</b><span>Order pending</span></div></div>
      <div class="panel"><h3>Endpoint teratas hari ini</h3><div class="tw"><table>${s.top_paths.map((p) => `<tr><td class="mono">${esc(p.path)}</td><td>${p.n}</td></tr>`).join('') || '<tr><td class="sub">Belum ada data</td></tr>'}</table></div></div>`

    let key = ak.access_key || '', shown = false
    const paint = () => { $('#akv').textContent = key ? (shown ? key : key.slice(0, 6) + '•'.repeat(10)) : 'Belum dibuat'; $('#aksh').lastChild.textContent = shown ? ' Sembunyikan' : ' Tampilkan'; $('#akgn').lastChild.textContent = key ? ' Generate ulang' : ' Generate' }
    paint()
    $('#aksh').onclick = () => { shown = !shown; paint() }
    $('#akcp').onclick = () => { if (key) navigator.clipboard.writeText(key).then(() => toast('Access key disalin')) }
    $('#akgn').onclick = async (e) => {
      if (key && !confirm('Generate ulang? Access key lama langsung tidak berlaku.')) return
      e.currentTarget.disabled = true
      try { const r = await put('/auth/me/accesskey/reset', {}, 'POST'); key = r.access_key; shown = true; paint(); say($('#akm'), 'Access key baru dibuat.') } catch (er) { say($('#akm'), er.message, 1) }
      e.currentTarget.disabled = false
    }
  },

  /* ---------- pengguna (dengan IP) ---------- */
  async pengguna(q = '') {
    const [{ users }, { plans }] = await Promise.all([api('/admin/users?q=' + encodeURIComponent(q)), api('/admin/plans')])
    out().innerHTML = `<h1>Pengguna</h1><div class="row" style="margin-bottom:10px"><input id="q" placeholder="Cari username, email, atau IP" value="${esc(q)}" style="flex:1"><button class="btn" id="qs">Cari</button></div>
      <div class="panel tw" style="padding:6px 10px"><table><tr><th>User</th><th>IP</th><th>Paket</th><th>Request</th><th>Aktif</th><th>Aksi</th></tr>${users.map((u) => `<tr>
        <td><b>${esc(u.username)}</b><br><span class="sub" style="margin:0;font-size:11.5px">${esc(u.email || '')}</span></td>
        <td><span class="ipc ${u.last_ip_blocked ? 'bl' : ''}">${esc(u.last_ip || '–')}</span>${u.reg_ip && u.reg_ip !== u.last_ip ? `<br><span class="sub ipc" style="margin:0" title="IP saat daftar">daftar: ${esc(u.reg_ip)}</span>` : ''}</td>
        <td>${roleBadge(u.role)} ${esc(u.plan_name || '')}<br><span class="sub" style="margin:0;font-size:11.5px">${u.plan_name ? fmtDate(u.expires_at) : ''}</span></td>
        <td>${u.used_today}${u.daily_limit ? '/' + u.daily_limit : ''} <span class="sub" style="margin:0">· ${u.total_requests}</span></td>
        <td class="sub" style="font-size:11.5px;white-space:nowrap">${u.last_seen ? fmtDT(u.last_seen) : '–'}</td>
        <td><div class="acts"><select data-p="${u.id}">${plans.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>
          <input data-d="${u.id}" type="number" value="30" min="0" style="width:62px" title="hari (0 = permanen)"><button class="btn" data-g="${u.id}">Beri</button>
          <button class="btn ghost" data-r="${u.id}">Cabut</button><button class="btn ghost" data-ip="${u.id}" data-name="${esc(u.username)}">IP</button>${adminBtn(u)}</div></td></tr>`).join('') || '<tr><td colspan="6" class="sub">Tidak ada user.</td></tr>'}</table></div>`
    $('#qs').onclick = () => load(() => V.pengguna($('#q').value))
    $('#q').onkeydown = (e) => { if (e.key === 'Enter') $('#qs').click() }
    out().querySelectorAll('[data-g]').forEach((b) => (b.onclick = async () => {
      const id = b.dataset.g, d = +$(`[data-d="${id}"]`).value
      try { await put(`/admin/users/${id}/grant`, { plan: $(`[data-p="${id}"]`).value, days: d, permanent: d === 0 }, 'POST'); toast('Paket diberikan'); V.pengguna(q) } catch (e) { toast(e.message) }
    }))
    out().querySelectorAll('[data-r]').forEach((b) => (b.onclick = async () => { if (confirm('Cabut paket user ini?')) { await put(`/admin/users/${b.dataset.r}/revoke`, {}, 'POST'); V.pengguna(q) } }))
    out().querySelectorAll('[data-ma]').forEach((b) => (b.onclick = async () => {
      if (!confirm(`Jadikan ${b.dataset.name} admin? Access key langsung dibuat.`)) return
      try { const r = await put('/admin/admins/user/' + b.dataset.ma, {}, 'POST'); modal(`<h3>${esc(r.username)} sekarang admin</h3><p class="sub">Access key (bagikan ke yang bersangkutan, hanya admin itu yang boleh memakainya):</p><div class="ubox"><code>${esc(r.access_key)}</code></div><div class="row" style="margin-top:12px"><button class="btn" onclick="this.closest('dialog').close()">Tutup</button></div>`); V.pengguna(q) } catch (e) { toast(e.message) }
    }))
    out().querySelectorAll('[data-xa]').forEach((b) => (b.onclick = async () => { if (confirm(`Cabut admin ${b.dataset.name}? Access key-nya ikut dihapus.`)) { try { await api('/admin/admins/' + b.dataset.xa, { method: 'DELETE' }); toast('Admin dicabut'); V.pengguna(q) } catch (e) { toast(e.message) } } }))
    out().querySelectorAll('[data-ip]').forEach((b) => (b.onclick = () => userIps(b.dataset.ip, b.dataset.name, () => V.pengguna(q))))
  },

  /* ---------- endpoint ---------- */
  async endpoint() {
    const [{ endpoints }, { endpoints: builtin }] = await Promise.all([api('/admin/endpoints'), api('/admin/builtin')])
    EPS = Object.fromEntries(endpoints.map((e) => [e.id, e]))
    BI = Object.fromEntries(builtin.map((e) => [e.path, e]))
    out().innerHTML = `<div class="bar"><h1>Endpoint</h1><button class="btn" id="add">${ico('plus')} Tambah endpoint</button></div>
      <div class="panel tw" style="padding:6px 10px"><h3 style="margin:8px 0 2px">Endpoint bawaan <span class="badge">${builtin.length}</span></h3>
        <p class="sub" style="font-size:12px;margin:0 0 6px">Ada di kode (<span class="mono">src/api</span>). Nama, deskripsi, akses, dan status bisa diubah dari sini (tanpa deploy); logikanya tetap di kode.</p>
        <table><tr><th>Fitur</th><th>Path</th><th>Akses</th><th>Status</th><th>Aksi</th></tr>${[...builtin].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' })).map((e) => `<tr>
          <td><b>${esc(e.name)}</b>${e.overridden ? ' <span class="badge warn">diubah</span>' : ''}<br><span class="sub" style="margin:0;font-size:11.5px">${esc(e.description)}</span></td>
          <td><span class="mt ${e.method.toLowerCase()}" style="font-size:10px">${e.method}</span> <span class="mono" style="font-size:12px">${esc(e.path)}</span></td>
          <td>${accessBadge(e.access)}</td><td><span class="badge ${e.status}">${e.status === 'online' ? 'Online' : 'Offline'}</span></td>
          <td><div class="acts"><button class="btn go" data-bt="${esc(e.path)}">Tes</button><button class="btn ghost" data-be="${esc(e.path)}">Edit</button>${e.overridden ? `<button class="btn ghost" data-br="${esc(e.path)}">Reset</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="5" class="sub">Tidak ada endpoint bawaan.</td></tr>'}</table></div>
      <p class="sub">Endpoint konfigurasi (proxy/JSON) buatan dashboard versi lama. Endpoint baru dibuat lewat tombol Tambah endpoint (kode JavaScript).</p>
      <div class="panel tw" style="padding:6px 10px"><table><tr><th>Fitur</th><th>Path</th><th>Akses</th><th>Mode</th><th>Online</th><th>Aksi</th></tr>${[...endpoints].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' })).map((e) => `<tr>
        <td><b>${esc(e.name)}</b><br><span class="sub" style="margin:0;font-size:11.5px">${e.inputs.map((i) => esc(i.name)).join(', ') || 'tanpa input'}</span></td>
        <td><span class="mt ${e.method.toLowerCase()}" style="font-size:10px">${e.method}</span> <span class="mono" style="font-size:12px">${esc(e.path)}</span></td>
        <td>${accessBadge(e.access)}</td><td>${e.mode}</td>
        <td><label class="sw"><input type="checkbox" data-on="${e.id}" ${e.status === 'online' ? 'checked' : ''}><i></i></label></td>
        <td><div class="acts"><button class="btn go" data-t="${e.id}">Tes</button><button class="btn ghost" data-e="${e.id}">Edit</button><button class="btn ghost red" data-x="${e.id}">Hapus</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="sub">Belum ada endpoint buatan admin.</td></tr>'}</table></div>`
    $('#add').onclick = () => codeForm()
    out().querySelectorAll('[data-bt]').forEach((b) => (b.onclick = () => epTest(BI[b.dataset.bt])))
    out().querySelectorAll('[data-be]').forEach((b) => (b.onclick = () => builtinForm(BI[b.dataset.be])))
    out().querySelectorAll('[data-br]').forEach((b) => (b.onclick = async () => { if (confirm('Kembalikan ke nilai asli di kode?')) { try { await api('/admin/builtin/' + encodeURIComponent(b.dataset.br.replace(/^\/api\//, '')), { method: 'DELETE' }); toast('Dikembalikan'); V.endpoint() } catch (e) { toast(e.message) } } }))
    out().querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => epForm(EPS[b.dataset.e])))
    out().querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => epTest(EPS[b.dataset.t])))
    out().querySelectorAll('[data-on]').forEach((b) => (b.onchange = async () => {
      try { await put('/admin/endpoints/' + b.dataset.on, { ...EPS[b.dataset.on], status: b.checked ? 'online' : 'offline' }, 'PUT'); toast(b.checked ? 'Endpoint online' : 'Endpoint offline'); V.endpoint() } catch (e) { toast(e.message); b.checked = !b.checked }
    }))
    out().querySelectorAll('[data-x]').forEach((b) => (b.onclick = async () => { if (confirm('Hapus endpoint ' + EPS[b.dataset.x].path + '?')) { await api('/admin/endpoints/' + b.dataset.x, { method: 'DELETE' }); toast('Endpoint dihapus'); V.endpoint() } }))
  },

  /* ---------- keamanan: percobaan akses tanpa hak ---------- */
  async keamanan() {
    const { items } = await api('/admin/violations')
    const KIND = { tier: 'Akses endpoint tanpa paket', ip: 'IP tidak di whitelist', key: 'API key salah' }
    out().innerHTML = `<h1>Keamanan</h1><p class="sub">Percobaan yang ditolak server: memanggil endpoint Premium/VIP tanpa paket (dibalas 404), request dari IP di luar whitelist, dan API key salah. Tetap tercatat meski tampilan di browser dimanipulasi. Menyimpan 500 catatan terakhir.</p>
      <div class="panel tw"><table><tr><th>Waktu</th><th>Jenis</th><th>User</th><th>IP</th><th>Endpoint</th><th>Total dari IP ini</th><th></th></tr>${items.map((v) => `<tr>
        <td style="white-space:nowrap">${fmtDT(v.at)}</td><td><span class="badge ${v.kind === 'tier' ? 'bad' : 'warn'}">${esc(KIND[v.kind] || v.kind)}</span></td><td>${esc(v.username || (v.user_id ? '#' + v.user_id : '–'))}</td>
        <td class="ipc">${esc(v.ip || '–')}</td><td class="mono" style="font-size:12px">${esc(v.path)}</td><td>${v.hits}</td>
        <td>${v.ip ? `<button class="btn ghost" data-bl="${esc(v.ip)}">Blokir IP</button>` : ''}</td></tr>`).join('') || '<tr><td class="sub" colspan="7">Belum ada percobaan mencurigakan.</td></tr>'}</table></div>`
    out().querySelectorAll('[data-bl]').forEach((b) => (b.onclick = async () => { if (confirm('Blokir IP ' + b.dataset.bl + '?')) { try { await put('/admin/blocked', { ip: b.dataset.bl, reason: 'Percobaan akses tidak sah' }, 'POST'); toast('IP diblokir'); b.disabled = true } catch (e) { toast(e.message) } } }))
  },

  /* ---------- paket ---------- */
  async paket() {
    const { plans } = await api('/admin/plans')
    PL = Object.fromEntries(plans.map((p) => [p.id, p]))
    out().innerHTML = `<div class="bar"><h1>Paket</h1><button class="btn" id="add">${ico('plus')} Tambah paket</button></div>
      <div class="panel tw" style="padding:6px 10px"><table><tr><th>Paket</th><th>Tier</th><th>Limit/hari</th><th>Maks IP</th><th>Key custom</th><th>Harga</th><th>User</th><th>Tampil</th><th>Aksi</th></tr>${plans.map((p) => `<tr>
        <td><b>${esc(p.name)}</b><br><span class="mono sub" style="margin:0;font-size:11px">${esc(p.id)}</span></td><td>${roleBadge(p.tier)}</td><td>${p.daily ?? '∞'}</td><td>${p.maxIps}</td><td>${p.customKey ? 'Ya' : '–'}</td>
        <td style="white-space:nowrap">${p.basePrice ? `${rp(p.basePrice)} / ${p.baseDays} hr` : ''}${p.basePrice && p.permanentPrice ? '<br>' : ''}${p.permanentPrice ? `${rp(p.permanentPrice)} permanen` : ''}</td>
        <td>${p.users}</td><td><span class="badge ${p.visible ? 'online' : 'offline'}">${p.visible ? 'ya' : 'sembunyi'}</span></td>
        <td><div class="acts"><button class="btn ghost" data-e="${esc(p.id)}">Edit</button><button class="btn ghost red" data-x="${esc(p.id)}">Hapus</button></div></td></tr>`).join('')}</table></div>`
    $('#add').onclick = () => planForm()
    out().querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => planForm(PL[b.dataset.e])))
    out().querySelectorAll('[data-x]').forEach((b) => (b.onclick = async () => {
      if (!confirm('Hapus paket ' + PL[b.dataset.x].name + '? Kode redeem paket ini ikut terhapus.')) return
      try { await api('/admin/plans/' + b.dataset.x, { method: 'DELETE' }); toast('Paket dihapus'); V.paket() } catch (e) { toast(e.message) }
    }))
  },

  /* ---------- claim trial ---------- */
  async trial() {
    const [t, { plans }] = await Promise.all([api('/admin/trial'), api('/admin/plans')])
    out().innerHTML = `<h1>Claim trial</h1><div class="panel"><h3>Pengaturan</h3>
      <div class="frm"><label class="chk"><span class="sw"><input type="checkbox" id="te" ${t.enabled ? 'checked' : ''}><i></i></span> Claim trial aktif</label>
        <div><label>Paket trial</label><select id="tp">${plans.map((p) => `<option value="${esc(p.id)}" ${p.id === t.plan ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div><label>Durasi (hari)</label><input id="td" type="number" min="1" max="365" value="${t.days}"></div></div>
      <div class="row" style="margin-top:12px"><button class="btn" id="ts">Simpan</button></div><p class="msg" id="tm">Tiap akun hanya bisa claim sekali dan satu IP hanya sekali. User yang masih punya paket aktif tidak bisa claim.</p></div>
      <div class="panel tw"><h3>Riwayat claim</h3><table><tr><th>User</th><th>IP</th><th>Paket</th><th>Tanggal</th><th></th></tr>${t.claims.map((c) => `<tr><td>${esc(c.username || '#' + c.user_id)}</td><td class="ipc">${esc(c.ip)}</td><td>${esc(c.plan)} · ${c.days} hr</td><td>${fmtDT(c.at)}</td>
        <td><button class="btn ghost" data-rc="${c.user_id}">Reset</button></td></tr>`).join('') || '<tr><td class="sub" colspan="5">Belum ada yang claim.</td></tr>'}</table></div>`
    $('#ts').onclick = async () => {
      try { await put('/admin/trial', { enabled: $('#te').checked, plan: $('#tp').value, days: +$('#td').value }); say($('#tm'), 'Pengaturan trial disimpan.'); toast('Tersimpan') } catch (e) { say($('#tm'), e.message, 1) }
    }
    out().querySelectorAll('[data-rc]').forEach((b) => (b.onclick = async () => { if (confirm('Reset claim user ini supaya bisa claim lagi?')) { await api('/admin/trial/claims/' + b.dataset.rc, { method: 'DELETE' }); V.trial() } }))
  },

  /* ---------- blokir IP ---------- */
  async blokir() {
    const [{ blocked }, sc] = await Promise.all([api('/admin/blocked'), api('/admin/security')])
    const ro = LEVEL === 'super' ? '' : 'disabled'
    const fld = (id, label, hint = '') => `<label style="display:block;font-size:12.5px">${label}<input id="${id}" type="number" min="0" value="${sc[id.slice(3)]}" ${ro} style="width:100%;margin-top:4px">${hint ? `<span class="sub" style="font-size:11px">${hint}</span>` : ''}</label>`
    const exp = (b) => (b.expires_at ? fmtDT(b.expires_at) : 'Permanen')
    out().innerHTML = `<h1>Blokir IP</h1>
      <div class="panel"><h3>Auto-blokir IP</h3>
        <p class="sub" style="font-size:12.5px">IP yang melewati batas permintaan atau menumpuk pelanggaran akan diblokir otomatis dan muncul di daftar bawah. <b>IP admin (akun admin/super admin yang sedang/baru login) dan IP owner tidak pernah diblokir otomatis.</b>${LEVEL === 'super' ? '' : ' Hanya super admin yang bisa mengubah pengaturan ini.'}</p>
        <label style="display:flex;gap:8px;align-items:center;margin:10px 0"><input id="sc_enabled" type="checkbox" ${sc.enabled ? 'checked' : ''} ${ro}> Aktifkan auto-blokir &amp; pembatas permintaan</label>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">
          ${fld('sc_limit_auth', 'Login/daftar', 'permintaan / menit / IP')}${fld('sc_limit_priv', 'Admin/billing/tools', 'permintaan / menit / IP')}${fld('sc_limit_api', 'API publik', 'permintaan / menit / IP')}
          ${fld('sc_limit_page', 'Halaman web', 'permintaan / menit / IP')}${fld('sc_limit_asset', 'File statis (lewat Worker)', 'permintaan / menit / IP')}
          ${fld('sc_strikes', 'Jumlah pelanggaran limit', 'dalam 10 menit sebelum diblokir')}${fld('sc_flood_mult', 'Pengali banjir', 'lewat N× limit = langsung diblokir')}
          ${fld('sc_ban_minutes', 'Lama blokir (menit)', '0 = permanen sampai dibuka admin')}
          ${fld('sc_viol_threshold', 'Ambang pelanggaran akses', 'key salah / IP tak terdaftar / tier')}${fld('sc_viol_window_min', 'Jendela pelanggaran (menit)', '')}
        </div>
        ${LEVEL === 'super' ? '<div class="row" style="margin-top:12px"><button class="btn" id="sc_save">Simpan pengaturan</button></div>' : ''}
        <p class="msg" id="sc_m">IP admin yang dikenali saat ini: ${sc.admin_ips}. Perubahan berlaku maksimal ±30 detik.</p></div>
      <div class="panel"><h3>Blokir IP manual</h3><div class="row"><input id="bi" placeholder="Contoh: 203.0.113.9" style="flex:1;min-width:150px"><input id="br" placeholder="Alasan (opsional)" style="flex:2;min-width:150px"><button class="btn red" id="bb">Blokir</button></div>
      <p class="msg" id="bm">IP terblokir ditolak di semua halaman dan endpoint. Perubahan berlaku maksimal ±15 detik. IP owner tidak bisa diblokir.</p></div>
      <div class="panel tw"><table><tr><th>IP</th><th>Alasan</th><th>User terkait</th><th>Sejak</th><th>Berakhir</th><th></th></tr>${blocked.map((b) => `<tr><td class="ipc">${esc(b.ip)}</td><td>${esc(b.reason || '–')}</td><td>${esc(b.users || '–')}</td><td>${fmtDT(b.created_at)}</td><td>${exp(b)}</td>
        <td><button class="btn ghost" data-u="${esc(b.ip)}">Buka blokir</button></td></tr>`).join('') || '<tr><td class="sub" colspan="6">Tidak ada IP yang diblokir.</td></tr>'}</table></div>`
    const sv = $('#sc_save')
    if (sv) sv.onclick = async () => {
      const body = { enabled: $('#sc_enabled').checked }
      for (const k of ['limit_auth', 'limit_priv', 'limit_api', 'limit_page', 'limit_asset', 'strikes', 'flood_mult', 'ban_minutes', 'viol_threshold', 'viol_window_min']) body[k] = Number($('#sc_' + k).value)
      try { await put('/admin/security', body); toast('Pengaturan keamanan disimpan'); V.blokir() } catch (e) { say($('#sc_m'), e.message, 1) }
    }
    $('#bb').onclick = async () => { try { await put('/admin/blocked', { ip: val('bi'), reason: val('br') }, 'POST'); toast('IP diblokir'); V.blokir() } catch (e) { say($('#bm'), e.message, 1) } }
    out().querySelectorAll('[data-u]').forEach((b) => (b.onclick = async () => { await api('/admin/blocked/' + encodeURIComponent(b.dataset.u), { method: 'DELETE' }); toast('Blokir dibuka'); V.blokir() }))
  },

  async order() {
    const { orders } = await api('/admin/orders')
    out().innerHTML = `<h1>Order</h1><div class="panel tw"><table><tr><th>Tanggal</th><th>User</th><th>Paket</th><th>Total</th><th>Status</th><th></th></tr>${orders.map((o) => `<tr>
      <td>${fmtDate(o.created_at)}</td><td>${esc(o.username || '-')}</td><td>${esc(o.plan)} ${o.days ? o.days + ' hr' : '∞'}</td><td>${rp(o.total)}</td><td>${esc(o.status)}</td>
      <td>${o.status === 'pending' ? `<div class="acts"><button class="btn" data-c="${o.id}">Konfirmasi</button><button class="btn ghost" data-x="${o.id}">Batal</button></div>` : ''}</td></tr>`).join('')}</table></div>`
    const act = (sel, kind) => out().querySelectorAll(sel).forEach((b) => (b.onclick = async () => { try { await put(`/admin/orders/${b.dataset[kind]}/${kind === 'c' ? 'confirm' : 'cancel'}`, {}, 'POST'); V.order() } catch (e) { toast(e.message) } }))
    act('[data-c]', 'c'); act('[data-x]', 'x')
  },

  async kode() {
    const [{ codes }, { plans }] = await Promise.all([api('/admin/codes'), api('/admin/plans')])
    out().innerHTML = `<h1>Kode redeem</h1><div class="panel"><h3>Buat kode</h3>
      <div class="row"><input id="kc" placeholder="Kode (kosong = acak)" style="flex:1;min-width:140px"><select id="kp">${plans.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>
        <input id="kd" type="number" value="30" min="0" style="width:80px" title="hari (0 = permanen)"><input id="kx" type="number" value="1" min="1" style="width:80px" title="maks pemakaian"><button class="btn" id="kb">Buat</button></div>
      <p class="msg" id="kmsg">Durasi 0 = permanen. Kolom kedua = berapa orang yang boleh memakai kode.</p></div>
      <div class="panel tw"><table><tr><th>Kode</th><th>Paket</th><th>Durasi</th><th>Terpakai</th><th></th></tr>${codes.map((c) => `<tr><td class="mono">${esc(c.code)}</td><td>${esc((plans.find((p) => p.id === c.plan) || {}).name || c.plan)}</td>
        <td>${c.days ? c.days + ' hr' : 'Permanen'}</td><td>${c.used}/${c.max_uses}</td><td><button class="btn ghost" data-dc="${esc(c.code)}">Hapus</button></td></tr>`).join('') || '<tr><td class="sub">Belum ada kode</td></tr>'}</table></div>`
    $('#kb').onclick = async () => {
      const d = +$('#kd').value
      try { const r = await put('/admin/codes', { code: $('#kc').value, plan: $('#kp').value, days: d, permanent: d === 0, max_uses: +$('#kx').value }, 'POST'); await V.kode(); say($('#kmsg'), 'Kode dibuat: ' + r.code) }
      catch (e) { say($('#kmsg'), e.message, 1) }
    }
    out().querySelectorAll('[data-dc]').forEach((b) => (b.onclick = async () => { if (confirm('Hapus kode ' + b.dataset.dc + '?')) { await api('/admin/codes/' + encodeURIComponent(b.dataset.dc), { method: 'DELETE' }); V.kode() } }))
  },
}
let EPS = {}, PL = {}, BI = {}

/* ---------- detail IP user ---------- */
async function userIps(id, name, done) {
  const d = modal(`<h3>IP · ${esc(name)}</h3><div id="ipb"><div class="sk" style="height:60px"></div></div><button class="btn ghost" id="cl">Tutup</button>`, 'lg')
  $('#cl', d).onclick = () => d.close()
  const draw = async () => {
    const r = await api(`/admin/users/${id}/ips`)
    $('#ipb', d).innerHTML = `<p class="sub" style="font-size:12px">IP daftar: <span class="ipc">${esc(r.reg_ip || '–')}</span>. Tombol blokir menolak IP itu di seluruh situs, jadi pastikan bukan IP bersama (kantor/kampus).</p>
      <div class="tw"><table><tr><th>IP</th><th>Sumber</th><th>Pertama</th><th>Terakhir</th><th>Hit</th><th></th></tr>${r.ips.map((i) => `<tr><td class="ipc ${i.blocked ? 'bl' : ''}">${esc(i.ip)}</td><td>${i.src === 'api' ? 'API' : 'Web'}</td><td>${fmtDT(i.first_at)}</td><td>${fmtDT(i.last_at)}</td><td>${i.hits}</td>
        <td>${i.blocked ? `<button class="btn ghost" data-ub="${esc(i.ip)}">Buka</button>` : `<button class="btn red" data-bl="${esc(i.ip)}">Blokir</button>`}</td></tr>`).join('') || '<tr><td colspan="6" class="sub">Belum ada IP tercatat.</td></tr>'}</table></div>`
    d.querySelectorAll('[data-bl]').forEach((b) => (b.onclick = async () => { try { await put('/admin/blocked', { ip: b.dataset.bl, reason: 'user ' + name }, 'POST'); toast('IP diblokir'); draw(); done() } catch (e) { toast(e.message) } }))
    d.querySelectorAll('[data-ub]').forEach((b) => (b.onclick = async () => { await api('/admin/blocked/' + encodeURIComponent(b.dataset.ub), { method: 'DELETE' }); toast('Blokir dibuka'); draw(); done() }))
  }
  try { await draw() } catch (e) { $('#ipb', d).innerHTML = `<p class="err">${esc(e.message)}</p>` }
}

/* ---------- form paket ---------- */
function planForm(p) {
  const edit = !!p; p ||= { tier: 'premium', daily: 1000, maxIps: 3, customKey: false, visible: true, baseDays: 30, basePrice: 10000 }
  const d = modal(`<h3>${edit ? 'Edit paket' : 'Tambah paket'}</h3><div class="frm">
    <div><label>ID paket</label><input id="pid" value="${esc(p.id || '')}" ${edit ? 'disabled' : ''} placeholder="mis. premium4"></div>
    <div><label>Nama</label><input id="pn" value="${esc(p.name || '')}" placeholder="Premium 4"></div>
    <div><label>Tier</label><select id="pt"><option value="premium" ${p.tier === 'premium' ? 'selected' : ''}>Premium</option><option value="vip" ${p.tier === 'vip' ? 'selected' : ''}>VIP</option></select></div>
    <div><label>Limit / hari (kosong = unlimited)</label><input id="pd" type="number" min="1" value="${p.daily ?? ''}"></div>
    <div><label>Maks IP whitelist</label><input id="pm" type="number" min="0" value="${p.maxIps}"></div>
    <div><label>Harga acuan (Rp)</label><input id="pb" type="number" min="1000" value="${p.basePrice ?? ''}" placeholder="kosong = tanpa durasi"></div>
    <div><label>Hari acuan</label><input id="pbd" type="number" min="1" value="${p.baseDays ?? ''}"></div>
    <div><label>Harga permanen (Rp)</label><input id="pp" type="number" min="1000" value="${p.permanentPrice ?? ''}" placeholder="kosong = tidak ada"></div>
    <label class="chk"><input type="checkbox" id="pc" ${p.customKey ? 'checked' : ''}> Boleh custom API key</label>
    <label class="chk"><input type="checkbox" id="pv" ${p.visible ? 'checked' : ''}> Tampil di halaman paket</label></div>
    <p class="msg" id="pmsg">Harga per hari dihitung proporsional dari harga acuan. Perubahan limit berlaku langsung ke semua user paket ini.</p>
    <div class="row" style="margin-top:10px"><button class="btn" id="ps">Simpan</button><button class="btn ghost" id="pc2">Batal</button></div>`, 'lg')
  $('#pc2', d).onclick = () => d.close()
  $('#ps', d).onclick = async () => {
    const g = (id) => $('#' + id, d)
    const body = { id: g('pid').value.trim(), name: g('pn').value.trim(), tier: g('pt').value, daily: num(g('pd').value), maxIps: num(g('pm').value) ?? 0, customKey: g('pc').checked,
      basePrice: num(g('pb').value), baseDays: num(g('pbd').value), permanentPrice: num(g('pp').value), visible: g('pv').checked }
    try { await put(edit ? '/admin/plans/' + p.id : '/admin/plans', body, edit ? 'PUT' : 'POST'); d.close(); toast('Paket disimpan'); V.paket() } catch (e) { say($('#pmsg', d), e.message, 1) }
  }
}

/* ---------- form endpoint bawaan (override) ---------- */
function builtinForm(e) {
  const d = modal(`<h3>Edit endpoint bawaan</h3><p class="sub mono" style="font-size:12px">${esc(e.method)} ${esc(e.path)}</p><div class="frm">
    <div class="full"><label>Nama fitur</label><input id="bn" value="${esc(e.name)}"></div>
    <div><label>Akses</label><select id="ba">${[['free', 'Gratis'], ['premium', 'Premium'], ['vip', 'VIP'], ['owner', 'Hanya owner']].map(([v, t]) => `<option value="${v}" ${e.access === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div><label>Status</label><select id="bs"><option value="online" ${e.status === 'online' ? 'selected' : ''}>Online</option><option value="offline" ${e.status === 'offline' ? 'selected' : ''}>Offline</option></select></div>
    <div class="full"><label>Deskripsi</label><input id="bd" value="${esc(e.description || '')}"></div></div>
    <p class="msg" id="bmsg">Perubahan berlaku ±10 detik. Logika endpoint tetap di kode.</p><div class="row" style="margin-top:10px"><button class="btn" id="bsv">Simpan</button><button class="btn ghost" id="bcl">Batal</button></div>`, 'lg')
  $('#bcl', d).onclick = () => d.close()
  $('#bsv', d).onclick = async () => {
    try { await put('/admin/builtin', { path: e.path, name: $('#bn', d).value, access: $('#ba', d).value, status: $('#bs', d).value, description: $('#bd', d).value }); d.close(); toast('Endpoint disimpan'); V.endpoint() } catch (er) { say($('#bmsg', d), er.message, 1) }
  }
}

/* ---------- form endpoint ---------- */
function epForm(e) {
  const edit = !!e; e ||= { category: '', slug: '', name: '', description: '', method: 'GET', access: 'free', status: 'online', mode: 'proxy', code: '', headers: {}, inputs: [{ name: 'url', in: 'query', required: true, example: '' }] }
  const inRow = (i = {}) => `<div class="inrow"><input data-n placeholder="nama (url, username…)" value="${esc(i.name || '')}"><select data-in><option value="query" ${i.in !== 'body' ? 'selected' : ''}>query</option><option value="body" ${i.in === 'body' ? 'selected' : ''}>body</option></select>
    <label class="chk" style="padding:0"><input type="checkbox" data-rq ${i.required ? 'checked' : ''}> wajib</label><input data-ex placeholder="contoh nilai" value="${esc(i.example || '')}"><button class="ib" data-rm aria-label="Hapus input">${ico('x')}</button></div>`
  const d = modal(`<h3>${edit ? 'Edit fitur' : 'Tambah fitur endpoint'}</h3><div class="frm">
    <div class="full"><label>Nama fitur</label><input id="en" value="${esc(e.name)}" placeholder="CapCut Downloader"></div>
    <div><label>Kategori</label><input id="ec" value="${esc(e.category)}" placeholder="download"></div>
    <div><label>Slug</label><input id="es" value="${esc(e.slug)}" placeholder="capcut"></div>
    <div><label>Method</label><select id="em"><option ${e.method === 'GET' ? 'selected' : ''}>GET</option><option ${e.method === 'POST' ? 'selected' : ''}>POST</option></select></div>
    <div><label>Akses</label><select id="ea">${[['free', 'Gratis'], ['premium', 'Premium'], ['vip', 'VIP'], ['owner', 'Hanya owner']].map(([v, t]) => `<option value="${v}" ${e.access === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div><label>Mode kode</label><select id="eo"><option value="proxy" ${e.mode === 'proxy' ? 'selected' : ''}>proxy (panggil URL upstream)</option><option value="json" ${e.mode === 'json' ? 'selected' : ''}>json (balas template JSON)</option></select></div>
    <div><label>Status</label><select id="et"><option value="online" ${e.status === 'online' ? 'selected' : ''}>Online</option><option value="offline" ${e.status === 'offline' ? 'selected' : ''}>Offline</option></select></div>
    <div class="full"><label>Deskripsi</label><input id="ed" value="${esc(e.description || '')}" placeholder="Opsional"></div>
    <div class="full"><label id="ekl">Kode</label><textarea id="ek" rows="4" spellcheck="false">${esc(e.code)}</textarea><p class="msg" id="ekh"></p></div>
    <div class="full" id="ehw"><label>Headers upstream (JSON, opsional). Kosong = User-Agent browser otomatis. Isi \"User-Agent\" sendiri bila perlu.</label><textarea id="eh" rows="2" spellcheck="false">${esc(Object.keys(e.headers || {}).length ? JSON.stringify(e.headers, null, 2) : '')}</textarea></div>
    <div class="full"><label>Input endpoint</label><div id="eins">${e.inputs.map(inRow).join('')}</div><button class="btn ghost sm" id="eadd" type="button">${ico('plus')} Tambah input</button></div></div>
    <p class="msg" id="emsg"></p><div class="row" style="margin-top:10px"><button class="btn" id="es2">Simpan</button><button class="btn ghost" id="ec2">Batal</button></div>`, 'lg')
  const g = (id) => $('#' + id, d)
  const hint = () => {
    const p = g('eo').value === 'proxy'
    g('ekl').textContent = p ? 'Kode: URL upstream (https://)' : 'Kode: template JSON respons'
    g('ek').placeholder = p ? 'https://api.example.com/capcut?link={url}' : '{ "halo": "{username}", "ip": "{ip}" }'
    g('ekh').textContent = p ? 'Pakai {nama_input} untuk nilai input (otomatis di-URL-encode). Workers tidak mengizinkan eval, jadi kode berupa konfigurasi, bukan JavaScript bebas.' : 'Pakai "{nama_input}" di nilai string. Tersedia juga {ip} dan {now}.'
    g('ehw').hidden = !p
  }
  g('eo').onchange = hint; hint()
  g('em').onchange = () => {}
  g('eadd').onclick = () => g('eins').insertAdjacentHTML('beforeend', inRow())
  d.onclick = (ev) => { if (ev.target === d) d.close(); const r = ev.target.closest('[data-rm]'); if (r) r.closest('.inrow').remove() }
  g('ec2').onclick = () => d.close()
  g('es2').onclick = async () => {
    const inputs = [...d.querySelectorAll('.inrow')].map((r) => ({ name: r.querySelector('[data-n]').value.trim(), in: r.querySelector('[data-in]').value, required: r.querySelector('[data-rq]').checked, example: r.querySelector('[data-ex]').value.trim() })).filter((i) => i.name)
    const body = { name: g('en').value, category: g('ec').value, slug: g('es').value, method: g('em').value, access: g('ea').value, mode: g('eo').value, status: g('et').value,
      description: g('ed').value, code: g('ek').value, headers: g('eo').value === 'proxy' ? g('eh').value || '{}' : '{}', inputs }
    try { await put(edit ? '/admin/endpoints/' + e.id : '/admin/endpoints', body, edit ? 'PUT' : 'POST'); d.close(); toast('Endpoint disimpan'); V.endpoint() } catch (er) { say(g('emsg'), er.message, 1) }
  }
}

/* ---------- tes endpoint ---------- */
function epTest(e) {
  const d = modal(`<h3>Tes ${esc(e.name)}</h3><p class="sub mono" style="font-size:12px">${esc(e.method)} ${esc(e.path)} · ${accessBadge(e.access)}</p>
    <div class="frm">${e.inputs.map((i) => `<div><label>${esc(i.name)}${i.required ? ' *' : ''} <span style="opacity:.6">(${i.in})</span></label><input data-tk="${esc(i.name)}" data-tin="${i.in}" placeholder="${esc(i.example || i.name)}" value="${esc(i.example || '')}"></div>`).join('') || '<p class="sub">Endpoint ini tidak punya input.</p>'}</div>
    <div class="row" style="margin:12px 0 8px"><button class="btn go" id="run">${ico('play')} Jalankan</button><button class="btn ghost" id="cl">Tutup</button></div>
    <p class="rmeta" id="meta" style="font-size:12px;color:var(--mut)"></p><div class="cbox" style="background:var(--bg);border:1px solid var(--line);border-radius:10px;margin-top:6px"><pre id="res" style="max-height:280px;overflow:auto;white-space:pre-wrap;word-break:break-all">Belum dijalankan.</pre></div>`, 'lg')
  $('#cl', d).onclick = () => d.close()
  $('#run', d).onclick = async (ev) => {
    const b = ev.currentTarget, qs = new URLSearchParams(), bd = {}
    d.querySelectorAll('[data-tk]').forEach((i) => { const v = i.value.trim(); if (v) (i.dataset.tin === 'body' ? (bd[i.dataset.tk] = v) : qs.append(i.dataset.tk, v)) })
    b.disabled = true; const t0 = performance.now()
    try {
      const r = await fetch(e.path + (qs.toString() ? '?' + qs : ''), { method: e.method, headers: e.method === 'POST' ? { 'Content-Type': 'application/json' } : {}, body: e.method === 'POST' ? JSON.stringify(bd) : undefined })
      const t = await r.text(); let shown = t; try { shown = JSON.stringify(JSON.parse(t), null, 2) } catch {}
      $('#res', d).textContent = shown.slice(0, 20000)
      $('#meta', d).innerHTML = `Status <b class="${r.ok ? 'ok' : 'err'}">${r.status}</b> · ${Math.round(performance.now() - t0)} ms · ${esc(r.headers.get('content-type') || '')}`
    } catch (er) { $('#res', d).textContent = er.message; $('#meta', d).innerHTML = '<b class="err">Gagal</b>' }
    b.disabled = false
  }
}

const draw = () => { document.querySelectorAll('.side>nav a').forEach((a) => a.classList.toggle('on', a.hash.slice(1) === view())); loading(); load(V[view()]) }

let ME = null
ready.then(({ user, who }) => {
  /* Dashboard admin hanya bisa dibuka setelah login sebagai pengelola (IP tidak lagi memberi akses). */
  if (!user) { location.href = '/login.html?as=admin&next=/admin.html'; return }
  ME = user
  LEVEL = who.admin_level || 'admin'
  if (!who.is_admin) { $('#app').innerHTML = `<div class="panel" style="grid-column:1/-1"><h3>Akses ditolak</h3><p class="sub">Akun <b>${esc(user.username)}</b> bukan pengelola. <a href="/login.html?as=admin&next=/admin.html" style="color:var(--blue)">Login sebagai Pengelola</a> dengan email dan Access Key.</p></div>`; return }
  $('#app').innerHTML = `<nav>${Object.entries(MENU).filter(([k]) => allowed(k)).map(([k, [v, i]]) => `<a href="#${k}">${ico(i)}${v}</a>`).join('')}</nav><div id="v"></div>`
  window.onhashchange = draw; draw()
})
