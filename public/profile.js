let me, who = { ip: '-' }, tab = 'events', reveal = false
const el = $('#app')
const maskKey = (k) => (k.length > 8 ? k.slice(0, 5) + '•'.repeat(Math.min(14, k.length - 7)) + k.slice(-2) : '•'.repeat(k.length))
const muted = (t) => `<span style="color:var(--mut)">${t}</span>`
const fsay = (id, t, bad) => { const e = $('#' + id); if (e) { e.textContent = t; e.className = 'fmsg ' + (bad ? 'err' : 'ok') } }
const lim = () => (me.daily_limit === null ? (me.active ? 'Unlimited' : 'Limit IP gratis') : me.daily_limit.toLocaleString('id-ID') + ' / hari')

/* ---------- definisi baris field ---------- */
const profileSave = (k) => (v) => put('/auth/me/profile', { [k]: v.v })
const FIELDS = {
  username: { label: 'Username', icon: 'user', show: () => esc(me.username), inputs: () => [{ id: 'v', value: me.username, ph: '3-20 karakter: huruf, angka, _' }],
    save: (v) => put('/auth/me/username', { username: v.v }) },
  email: { label: 'Email', icon: 'mail', color: 'green', show: () => (me.email ? esc(me.email) : muted('Belum diatur')), inputs: () => [{ id: 'v', type: 'email', value: me.email || '', ph: 'nama@email.com', ac: 'email' }], save: profileSave('email') },
  phone: { label: 'Phone / WhatsApp', icon: 'phone', color: 'green', show: () => (me.phone ? esc(me.phone) : muted('Belum diatur')), inputs: () => [{ id: 'v', type: 'tel', value: me.phone || '', ph: '+62812xxxxxxx', ac: 'tel' }], save: profileSave('phone') },
  password: { label: 'Password', icon: 'lock', color: 'amber', show: () => (me.has_password ? '••••••••' : muted('Belum dibuat (akun Google)')),
    inputs: () => [...(me.has_password ? [{ id: 'cp', type: 'password', ph: 'Password lama', ac: 'current-password' }] : []), { id: 'np', type: 'password', ph: 'Password baru (min. 8)', ac: 'new-password' }],
    save: (v) => put('/auth/me/password', { current_password: v.cp, new_password: v.np }) },
  avatar_url: { label: 'Profile Photo', icon: 'image', color: 'amber', mono: 1, show: () => (me.avatar_url ? esc(me.avatar_url) : muted('Belum diatur')), inputs: () => [{ id: 'v', value: me.avatar_url || '', ph: 'https://…/foto.png (kosongkan untuk hapus)' }], save: profileSave('avatar_url') },
  banner_url: { label: 'Banner Photo', icon: 'image', color: 'amber', mono: 1, show: () => (me.banner_url ? esc(me.banner_url) : muted('Belum diatur')), inputs: () => [{ id: 'v', value: me.banner_url || '', ph: 'https://…/banner.jpg (kosongkan untuk hapus)' }], save: profileSave('banner_url') },
  api_key: { label: 'API Key', icon: 'key', mono: 1, show: () => `<span id="kv">${esc(reveal ? me.api_key : maskKey(me.api_key))}</span>`, edit: () => me.custom_key,
    btns: () => `<button class="ib" data-eye aria-label="Tampilkan key">${ico(reveal ? 'eyeoff' : 'eye')}</button><button class="ib" data-copyk aria-label="Salin key">${ico('copy')}</button>`,
    inputs: () => [{ id: 'v', value: me.api_key, ph: '10-40 karakter: huruf, angka, _ atau -' }], save: (v) => put('/auth/me/key', { new_key: v.v }) },
}
const READONLY = [
  ['Limit', 'grid', 'green', () => lim()],
  ['Masa aktif', 'clock', 'amber', () => (me.active ? (me.expires_at ? fmtDate(me.expires_at) : 'Permanen') : me.expired ? 'Sudah habis' : 'Tidak ada paket')],
  ['Paket', 'shield', '', () => (me.plan_name || 'Free User') + (me.expired ? ' (habis)' : '')],
]

const row = (k) => {
  const f = FIELDS[k], editable = f.edit ? f.edit() : true
  return `<div class="field" data-f="${k}">${tile(f.icon, f.color || '')}<div class="fb"><small>${f.label}</small><div class="fv ${f.mono ? 'mono' : ''}">${f.show()}</div></div>${f.btns ? f.btns() : ''}${editable ? `<button class="ib" data-edit="${k}" aria-label="Ubah ${f.label}">${ico('edit')}</button>` : ''}</div><p class="fmsg" id="fm-${k}"></p>`
}
const roRow = ([l, i, c, v]) => `<div class="field">${tile(i, c)}<div class="fb"><small>${l}</small><div class="fv">${esc(v())}</div></div></div>`

function startEdit(k) {
  const f = FIELDS[k], r = $(`[data-f="${k}"]`)
  r.classList.add('editing')
  r.querySelector('.fb').innerHTML = `<small>${f.label}</small>` + f.inputs().map((i) =>
    `<input data-i="${i.id}" type="${i.type || 'text'}" value="${esc(i.value || '')}" placeholder="${esc(i.ph || '')}" autocomplete="${i.ac || 'off'}">`).join('') +
    `<div class="eb"><button class="btn go sm" data-save="${k}">Simpan</button><button class="btn ghost sm" data-cancel>Batal</button></div>`
  r.querySelectorAll('.ib').forEach((b) => b.remove())
  r.querySelector('input').focus()
}
async function saveField(k, btn) {
  const vals = {}
  $(`[data-f="${k}"]`).querySelectorAll('[data-i]').forEach((i) => (vals[i.dataset.i] = i.value.trim()))
  btn.disabled = true
  try { await FIELDS[k].save(vals); toast(FIELDS[k].label + ' diperbarui'); await render() }
  catch (e) { fsay('fm-' + k, e.message, 1); btn.disabled = false }
}

/* ---------- panel tab ---------- */
const panelEvents = () => `<div class="sec">Claim Trial</div><div id="trial"><div class="sk" style="height:56px"></div></div>
  <div class="sec" style="margin-top:18px">Redeem Code</div>
  <p class="hint">Punya kode dari admin atau event? Masukkan di sini untuk mengaktifkan paketnya.</p>
  <div class="iprow"><input id="rc" placeholder="Contoh: ARVO2026" autocapitalize="characters" autocomplete="off"></div>
  <button class="btn go" id="rcb">${ico('check')} Submit</button><p class="msg" id="rcm"></p>`

const panelSettings = () => !me.active
  ? `<div class="sec">Whitelist IP</div><div class="lockbox">${tile('lock', 'mut')}<div>Whitelist IP aktif setelah kamu punya paket Premium/VIP.<br><a href="/#paket" style="color:var(--blue)">Lihat paket</a></div></div>`
  : `<div class="sec">Whitelist IP</div>
  <p class="hint">IP kamu saat ini: <span class="cur">${esc(who.ip)}</span></p>
  <div class="hint" style="margin-bottom:0">IP Address (maksimal ${me.max_ips} IP)</div>
  <div class="iprow"><input id="nip" placeholder="Contoh: 192.168.1.1" autocomplete="off"><button class="btn ghost sm" id="myip" type="button">IP saya</button></div>
  <p class="hint">Mendukung IPv4 dan IPv6 tunggal. Kalau daftar kosong, key bisa dipakai dari IP mana saja.</p>
  <button class="btn go" id="addip">${ico('plus')} Add to Whitelist</button><p class="msg" id="ipm"></p>
  <div class="tw" id="iplist" style="margin-top:12px"><p class="empty">Memuat…</p></div>`

const panelManage = () => `<div class="danger-box">${tile('userx', 'red')}<h4>Hapus Akun</h4>
  <p class="hint">Aksi ini tidak bisa dibatalkan.</p>
  <ul><li>${ico('x')}Profil, foto, dan pengaturan akun dihapus permanen</li><li>${ico('x')}API key tidak bisa dipakai lagi</li><li>${ico('x')}Paket Premium/VIP yang masih aktif ikut hangus</li><li>${ico('x')}Riwayat pemakaian dihapus. Catatan order pembayaran tetap disimpan untuk pembukuan</li></ul>
  <p class="hint" style="text-align:left">Ketik <code>delete</code> untuk konfirmasi:</p>
  ${me.has_password ? '<input id="dp" type="password" placeholder="Password kamu" autocomplete="current-password" style="width:100%;margin-bottom:8px">' : ''}
  <div class="iprow"><input id="dc" placeholder="Ketik: delete" autocomplete="off"><button class="btn danger" id="dbtn" disabled>${ico('trash')} Hapus Akun</button></div>
  <p class="msg" id="dm"></p></div>`

const TABS = [['events', 'gift', 'Events', panelEvents], ['settings', 'shield', 'Settings', panelSettings], ['manage', 'userx', 'Management', panelManage]]

/* ---------- render utama ---------- */
async function render() {
  me = await api('/auth/me')
  const pct = me.daily_limit ? Math.min(100, (me.used_today / me.daily_limit) * 100) : 0
  el.innerHTML = `
  <section class="card hero-c">
    <div class="banner">${me.banner_url ? `<img data-fb src="${esc(me.banner_url)}" alt="" referrerpolicy="no-referrer">` : ''}</div>
    <div class="hero-b">
      <div class="avatar">${esc(me.username[0])}${me.avatar_url ? `<img data-fb src="${esc(me.avatar_url)}" alt="" referrerpolicy="no-referrer">` : ''}</div>
      <div class="hname"><h1>${esc(me.username)}</h1><span class="badge ${me.role}">${me.role === 'member' ? 'Free User' : esc(me.plan_name || me.role)}</span></div>
      <p class="since">Sejak ${fmtDate(me.created_at)}${me.email ? ' · ' + esc(me.email) : ''}</p>
      <div class="row"><a class="btn go sm" href="/#paket">${ico('bag')} ${me.active ? 'Perpanjang paket' : 'Lihat paket'}</a><a class="btn ghost sm" href="/playground.html">${ico('play')} Playground</a><button class="btn ghost sm" id="out">${ico('logout')} Keluar</button></div>
    </div>
  </section>

  <section class="card"><div class="card-h">${ico('trend')} Request Metrics</div><div class="card-b">
    <div class="tiles">
      <div class="tile" style="--c:var(--blue)"><div><small>Hari ini</small><b>${me.used_today.toLocaleString('id-ID')}</b><small>${esc(lim())}</small></div><span class="ico">${ico('activity')}</span></div>
      <div class="tile" style="--c:var(--g)"><div><small>Total request</small><b>${me.total_requests.toLocaleString('id-ID')}</b><small>sejak bergabung</small></div><span class="ico">${ico('trend')}</span></div>
      <div class="tile" style="--c:var(--amber)"><div><small>Paket</small><b class="sm">${esc(me.plan_name || 'Free User')}</b><small>${me.expired ? 'habis' : me.active ? 'aktif' : 'gratis'}</small></div><span class="ico">${ico('shield')}</span></div>
      <div class="tile" style="--c:var(--red)"><div><small>Masa aktif</small><b class="sm">${me.active ? (me.expires_at ? fmtDate(me.expires_at) : 'Permanen') : '–'}</b><small>${me.max_ips ? 'maks ' + me.max_ips + ' IP' : 'tanpa whitelist'}</small></div><span class="ico">${ico('clock')}</span></div>
    </div>
    ${me.daily_limit ? `<div class="meter" title="${pct.toFixed(0)}% limit harian terpakai"><i style="width:${pct}%"></i></div>` : ''}
    <div id="use" style="margin-top:14px"></div>
  </div></section>

  <div class="dash-grid">
    <div>
      <section class="card"><div class="card-h">${ico('user')} Personal Info</div><div class="card-b">
        <div class="sec">Account</div>${['username', 'email', 'phone', 'password', 'avatar_url', 'banner_url'].map(row).join('')}
        <div class="sec" style="margin-top:18px">API</div>${row('api_key')}
        ${me.custom_key ? '' : '<p class="hint" style="margin-top:-2px">Custom API key tersedia di Premium 2 ke atas.</p>'}
        ${READONLY.map(roRow).join('')}
      </div></section>
    </div>
    <div>
      <section class="card">
        <div class="seg">${TABS.map(([id, ic, label]) => `<button data-tab="${id}" class="${id === 'manage' ? 'del ' : ''}${id === tab ? 'on' : ''}">${ico(ic)}${label}</button>`).join('')}</div>
        <div class="card-b">${TABS.map(([id, , , fn]) => `<div class="tab-p" data-p="${id}" ${id === tab ? '' : 'hidden'}>${fn()}</div>`).join('')}</div>
      </section>
      <section class="card"><div class="card-h">${ico('bag')} Paket &amp; pembelian</div><div class="card-b"><div class="tw" id="ord"><p class="empty">Memuat…</p></div></div></section>
    </div>
  </div>`

  el.querySelectorAll('img[data-fb]').forEach((i) => (i.onerror = () => i.remove()))
  wireTabs(); loadSide(); loadTrial()
}

const TRIAL_MSG = { off: 'Claim trial sedang tidak tersedia.', claimed: 'Kamu sudah pernah claim trial.', has_plan: 'Kamu masih punya paket aktif, claim tersedia untuk akun tanpa paket.' }
async function loadTrial() {
  const box = $('#trial'); if (!box) return
  try {
    const t = await api('/auth/me/trial')
    box.innerHTML = t.enabled
      ? `<p class="hint">Coba <b>${esc(t.plan_name)}</b> gratis selama <b>${t.days} hari</b>. Satu kali per akun dan per IP.</p>
         <button class="btn go" id="tcl" ${t.can_claim ? '' : 'disabled'}>${ico('gift')} Claim trial</button><p class="msg" id="tcm">${t.can_claim ? '' : esc(TRIAL_MSG[t.reason] || '')}</p>`
      : `<div class="lockbox">${tile('gift', 'mut')}<div>${TRIAL_MSG.off}</div></div>`
    const b = $('#tcl'); if (b) b.onclick = async () => {
      b.disabled = true
      try { const r = await put('/auth/me/trial', {}, 'POST'); toast(`Trial aktif: ${r.name} ${r.days} hari`); await render() }
      catch (err) { say($('#tcm'), err.message, 1); b.disabled = false }
    }
  } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>` }
}

function wireTabs() {
  const rc = $('#rc'), dc = $('#dc')
  if (rc) $('#rcb').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true
    try { const r = await put('/auth/me/redeem', { code: rc.value }, 'POST'); toast(`Kode berhasil: ${r.name} ${r.days ? r.days + ' hari' : 'permanen'}`); await render() }
    catch (err) { say($('#rcm'), err.message, 1); b.disabled = false }
  }
  if ($('#myip')) {
    $('#myip').onclick = () => ($('#nip').value = who.ip)
    $('#addip').onclick = async (e) => {
      const b = e.currentTarget; b.disabled = true
      try { await put('/auth/me/ips', { ip: $('#nip').value }, 'POST'); $('#nip').value = ''; say($('#ipm'), 'IP ditambahkan ke whitelist.'); loadIps() }
      catch (err) { say($('#ipm'), err.message, 1) }
      b.disabled = false
    }
    loadIps()
  }
  if (dc) {
    dc.oninput = () => ($('#dbtn').disabled = dc.value.trim().toLowerCase() !== 'delete')
    $('#dbtn').onclick = async (e) => {
      const b = e.currentTarget; b.disabled = true
      try { await put('/auth/me/delete', { confirm: dc.value, password: $('#dp')?.value }, 'POST'); location.href = '/' }
      catch (err) { say($('#dm'), err.message, 1); b.disabled = false }
    }
  }
}

async function loadIps() {
  const box = $('#iplist'); if (!box) return
  try {
    const { ips } = await api('/auth/me/ips')
    box.innerHTML = ips.length ? `<table class="ipt"><tr><th>#</th><th>IP Address</th><th>Dibuat</th><th>Terakhir dipakai</th><th>Req</th><th></th></tr>${ips.map((r, n) => `<tr>
      <td>${n + 1}</td><td class="mono">${esc(r.ip)}${r.ip === who.ip ? ' <span class="cur">kamu</span>' : ''}</td><td>${fmtDate(r.created_at)}</td><td>${r.last_used ? fmtDT(r.last_used) : '–'}</td><td>${(r.req || 0).toLocaleString('id-ID')}</td>
      <td><button class="ib" data-delip="${esc(r.ip)}" aria-label="Hapus ${esc(r.ip)}">${ico('trash')}</button></td></tr>`).join('')}</table>` : '<p class="empty">Belum ada IP di whitelist.</p>'
  } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>` }
}

function loadSide() {
  api('/auth/me/orders').then(({ orders }) => {
    $('#ord').innerHTML = orders.length ? `<table><tr><th>Tanggal</th><th>Paket</th><th>Total</th><th>Status</th></tr>${orders.map((o) =>
      `<tr><td>${fmtDate(o.created_at)}</td><td>${esc(o.plan)} ${o.days ? o.days + ' hr' : '∞'}</td><td>${rp(o.total)}</td><td>${esc(o.status)}</td></tr>`).join('')}</table>` : '<p class="empty">Belum ada pembelian.</p>'
  }).catch(() => {})
  api('/auth/me/usage').then(({ days, paths }) => {
    if (!days.length) { $('#use').innerHTML = '<p class="empty">Belum ada request dengan API key ini.</p>'; return }
    const max = Math.max(...days.map((d) => d.n)), list = [...days].reverse()
    $('#use').innerHTML = `<div class="sec">Pemakaian 14 hari</div><div class="bars">${list.map((d) => `<div style="height:${Math.max(3, (d.n / max) * 100)}%" title="${esc(d.day)}: ${d.n}"></div>`).join('')}</div>
      <div class="tw"><table><tr><th>Endpoint</th><th>Request</th></tr>${paths.map((p) => `<tr><td class="mono">${esc(p.path)}</td><td>${p.n.toLocaleString('id-ID')}</td></tr>`).join('')}</table></div>`
  }).catch(() => {})
}

/* satu handler klik untuk seluruh halaman */
el.onclick = async (e) => {
  const t = e.target.closest('button'); if (!t) return
  if (t.dataset.tab) { tab = t.dataset.tab; el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b === t)); el.querySelectorAll('[data-p]').forEach((p) => (p.hidden = p.dataset.p !== tab)) }
  else if (t.dataset.edit) startEdit(t.dataset.edit)
  else if (t.dataset.save) saveField(t.dataset.save, t)
  else if ('cancel' in t.dataset) render()
  else if ('eye' in t.dataset) { reveal = !reveal; $('#kv').textContent = reveal ? me.api_key : maskKey(me.api_key); t.innerHTML = ico(reveal ? 'eyeoff' : 'eye') }
  else if ('copyk' in t.dataset) navigator.clipboard.writeText(me.api_key).then(() => flash(t))
  else if (t.dataset.delip) { t.disabled = true; try { await api('/auth/me/ips/' + encodeURIComponent(t.dataset.delip), { method: 'DELETE' }); loadIps() } catch (err) { say($('#ipm'), err.message, 1); t.disabled = false } }
  else if (t.id === 'out') { await put('/auth/logout', {}, 'POST'); location.href = '/' }
}

ready.then(({ user, who: w }) => { who = w; return user ? render() : (location.href = '/login.html?next=/profile.html') })
