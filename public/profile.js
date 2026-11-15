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

/* ---------- kartu profil: foto bulat di tengah, aksen latar mengikuti warna foto ---------- */
const DESC = 'API simpel dan cepat. Mulai gratis, upgrade ke Premium atau VIP kapan saja.'
const hueOf = (t) => [...t].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7)

const photoRow = () => `<div class="field" data-f="photo">${tile('image', 'amber')}<div class="fb"><small>Foto profil</small><div class="fv" id="phv">${photoText()}</div></div>
  <button class="ib" data-pick aria-label="Pilih file foto" title="Pilih file">${ico('folder')}</button><button class="ib" data-rmphoto aria-label="Hapus foto" title="Hapus foto" ${me.avatar_url ? '' : 'hidden'}>${ico('trash')}</button></div><p class="fmsg" id="fm-photo"></p>`
const photoText = () => (me.avatar_url ? 'Foto dari file kamu' : muted('Belum ada. Pilih file JPG, PNG, atau WebP'))

function setAccent(card, h, s) {
  card.style.setProperty('--ph', h); card.style.setProperty('--ps', s + '%')
}
function paintCard() {
  const card = $('#pcard'), box = $('#pimg'); if (!card || !box) return
  const fallback = () => { box.innerHTML = `<span class="pc-ini">${esc(me.username[0])}</span>`; card.style.removeProperty('--img'); setAccent(card, hueOf(me.username), 72) }
  if (!me.avatar_url) return fallback()
  const im = new Image()
  if (!me.avatar_url.startsWith('/')) im.crossOrigin = 'anonymous'
  im.onload = () => {
    box.innerHTML = ''; im.alt = ''; im.draggable = false; box.append(im)
    card.style.setProperty('--img', `url("${me.avatar_url}")`)
    const a = accentOf(im); a ? setAccent(card, a.h, a.s) : setAccent(card, hueOf(me.username), 18)
    card.classList.add('has-img')
  }
  im.onerror = fallback
  im.src = me.avatar_url
}

/* sedikit miring mengikuti kursor (hanya perangkat dengan mouse) */
function tiltCard() {
  const c = $('#pcard'); if (!c || !matchMedia('(hover:hover) and (pointer:fine)').matches || matchMedia('(prefers-reduced-motion:reduce)').matches) return
  c.onpointermove = (e) => { const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
    c.style.setProperty('--rx', (-y * 4).toFixed(2) + 'deg'); c.style.setProperty('--ry', (x * 5).toFixed(2) + 'deg'); c.style.setProperty('--mx', (x * 100 + 50).toFixed(1) + '%'); c.style.setProperty('--my', (y * 100 + 50).toFixed(1) + '%') }
  c.onpointerleave = () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg') }
}

/* potong tengah jadi persegi 320px lalu kompres, supaya ringan disimpan */
const toAvatar = (file) => new Promise((res, rej) => {
  if (!/^image\//.test(file.type)) return rej(new Error('File harus berupa gambar.'))
  if (file.size > 15 * 1024 * 1024) return rej(new Error('Ukuran file maksimal 15 MB.'))
  const url = URL.createObjectURL(file), im = new Image()
  im.onload = () => {
    const s = Math.min(im.naturalWidth, im.naturalHeight), c = document.createElement('canvas'); c.width = c.height = 320
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 320, 320)
    x.drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, 0, 0, 320, 320); URL.revokeObjectURL(url)
    let q = 0.88, out = c.toDataURL('image/jpeg', q)
    while (out.length > 150000 && q > 0.45) out = c.toDataURL('image/jpeg', (q -= 0.1))
    res(out)
  }
  im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('File gambar tidak bisa dibaca.')) }
  im.src = url
})
async function refreshPhoto(msg) {
  me = await api('/auth/me'); paintCard()
  const t = $('#phv'); if (t) t.innerHTML = photoText()
  const rm = el.querySelector('[data-rmphoto]'); if (rm) rm.hidden = !me.avatar_url
  if (msg) toast(msg)
}
async function pickPhoto(file) {
  if (!file) return
  const card = $('#pcard'); card.classList.add('busy')
  try { await put('/auth/me/avatar', { data: await toAvatar(file) }); await refreshPhoto('Foto profil diperbarui') }
  catch (e) { fsay('fm-photo', e.message, 1); toast(e.message) }
  card.classList.remove('busy'); $('#pf').value = ''
}

/* ---------- render utama ---------- */
async function render() {
  me = await api('/auth/me')
  const joined = new Date(me.created_at || Date.now())
  const pct = me.daily_limit ? Math.min(100, (me.used_today / me.daily_limit) * 100) : 0
  el.innerHTML = `
  <section class="pcard" id="pcard">
    <div class="pc-bg"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>
    <div class="pc-top"><span class="pc-brand"><span class="logo">${LOGO}</span>Arvo</span><span class="badge ${me.role}">${me.role === 'member' ? 'Free User' : esc(me.plan_name || me.role)}</span></div>
    <div class="pc-mid">
      <div class="pc-photo"><span class="pc-halo"></span><div class="pc-img" id="pimg"></div><button class="pc-cam" data-pick aria-label="Ganti foto profil">${ico('camera')}</button></div>
      <h1 class="pc-name">${esc(me.username.toUpperCase())}</h1>
      <p class="pc-desc">${esc(DESC)}</p>
    </div>
    <div class="pc-foot">
      <div><small>Bergabung</small><b>${joined.getFullYear()}</b></div>
      <div class="r"><small>Tanggal</small><b>${joined.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}</b></div>
    </div>
    <div class="pc-act"><a class="btn go sm" href="/#paket">${ico('bag')} ${me.active ? 'Perpanjang paket' : 'Lihat paket'}</a><a class="btn ghost sm" href="/playground.html">${ico('play')} Playground</a><button class="btn ghost sm" id="out">${ico('logout')} Keluar</button></div>
    <input type="file" id="pf" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
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
        <div class="sec">Account</div>${['username', 'email', 'phone', 'password'].map(row).join('')}${photoRow()}
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

  paintCard(); tiltCard()
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
  else if ('pick' in t.dataset) $('#pf').click()
  else if ('rmphoto' in t.dataset) { t.disabled = true; try { await api('/auth/me/avatar', { method: 'DELETE' }); await refreshPhoto('Foto profil dihapus') } catch (err) { toast(err.message) } t.disabled = false }
  else if (t.id === 'out') { await put('/auth/logout', {}, 'POST'); location.href = '/' }
}

el.onchange = (e) => { if (e.target.id === 'pf') pickPhoto(e.target.files[0]) }

ready.then(({ user, who: w }) => { who = w; return user ? render() : (location.href = '/login.html?next=/profile.html') })
