let me, who = { ip: '-' }, tab = 'events', showKey = false
const el = $('#app')
const maskKey = (k) => (k.length > 8 ? k.slice(0, 5) + '•'.repeat(Math.min(14, k.length - 7)) + k.slice(-2) : '•'.repeat(k.length))
const muted = (t) => `<span style="color:var(--mut)">${t}</span>`
const fsay = (id, t, bad) => { const e = $('#' + id); if (e) { e.textContent = t; e.className = 'fmsg ' + (bad ? 'err' : 'ok') } }
const n = (v) => Number(v).toLocaleString('id-ID')
/* sisa limit hari ini, juga untuk akun gratis (limit per akun, reset 00:00 WIB) */
const lim = () => (me.daily_limit === null ? 'Unlimited' : `Sisa ${n(me.remaining)} dari ${n(me.daily_limit)} / hari`)
const DEF_BORDER = ['#f7d774', '#b8860b', '#fff1a8']
const SILVER_NAVY = ['#0a2463', '#c9d1dc', '#1e3a8a', '#f1f4f8']
/* warna cincin foto: free = Google, premium = silver & navy, vip = pilihan user */
const ringCss = (c) => `conic-gradient(${[...c, c[0]].join(',')})`
/* free: empat warna Google, potongan tegas (tanpa gradasi) */
const GOOGLE_RING = 'conic-gradient(#4285f4 0 25%,#ea4335 0 50%,#fbbc05 0 75%,#34a853 0 100%)'
const ringStyle = () => (me.role === 'vip' ? ringCss(me.border_colors && me.border_colors.length ? me.border_colors : DEF_BORDER) : me.role === 'premium' ? ringCss(SILVER_NAVY) : GOOGLE_RING)
/* centang terverifikasi: biru (premium) atau gold (vip), dengan kilau yang menyapu */
const SEAL = (() => { const P = [], N = 14; for (let i = 0; i < N * 2; i++) { const a = (i / (N * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 9.3 : 10.8; P.push((12 + r * Math.cos(a)).toFixed(2) + ' ' + (12 + r * Math.sin(a)).toFixed(2)) } return 'M' + P.join('L') + 'Z' })()
const verified = (kind) => `<svg class="vb ${kind}" viewBox="0 0 24 24" role="img" aria-label="Terverifikasi ${kind === 'gold' ? 'VIP' : 'Premium'}"><defs>
  <linearGradient id="vbg" x1="0" y1="0" x2="1" y2="1">${kind === 'gold' ? '<stop offset="0" stop-color="#ffe680"/><stop offset=".5" stop-color="#f0b400"/><stop offset="1" stop-color="#b07d00"/>' : '<stop offset="0" stop-color="#6bb4ff"/><stop offset=".55" stop-color="#2a7bf5"/><stop offset="1" stop-color="#1555c8"/>'}</linearGradient>
  <clipPath id="vbc"><path d="${SEAL}"/></clipPath></defs>
  <path d="${SEAL}" fill="url(#vbg)" stroke="url(#vbg)" stroke-width="1.2" stroke-linejoin="round"/>
  <g clip-path="url(#vbc)"><g transform="rotate(22 12 12)"><rect class="shine" x="-14" y="-6" width="6" height="36" fill="#fff" opacity=".75"/></g></g>
  <path d="M7.5 12.3l3 3 6-6.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

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
  bio: { label: 'Bio', icon: 'user', show: () => (me.bio ? esc(me.bio) : muted('Belum menambahkan bio.')), inputs: () => [{ id: 'v', value: me.bio || '', ph: 'Ceritakan sedikit tentang kamu (maks. 160)' }], save: profileSave('bio') },
  api_key: { label: 'API Key', icon: 'key', mono: 1, show: () => `<span id="kv">${esc(showKey ? me.api_key : maskKey(me.api_key))}</span>`, edit: () => me.custom_key,
    btns: () => `<button class="ib" data-eye aria-label="Tampilkan key">${ico(showKey ? 'eyeoff' : 'eye')}</button><button class="ib" data-copyk aria-label="Salin key">${ico('copy')}</button>`,
    inputs: () => [{ id: 'v', value: me.api_key, ph: '10-40 karakter: huruf, angka, _ atau -' }], save: (v) => put('/auth/me/key', { new_key: v.v }) },
}
const READONLY = [
  ['Limit harian', 'grid', 'green', () => lim()],
  ['Masa aktif', 'clock', 'amber', () => (me.active ? (me.expires_at ? fmtDate(me.expires_at) : 'Permanen') : me.expired ? 'Sudah habis' : 'Tidak ada paket')],
  ['Paket', 'shield', '', () => (me.active ? me.plan_name : (me.plan_name || 'Free User') + (me.expired ? ' (habis)' : ''))],
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

/* Access Key: hanya tampil untuk pengelola. Dipakai sebagai x-api-key untuk endpoint khusus owner / panel admin (tanpa batas). */
const panelAccessKey = () => !(who.is_admin || who.is_owner) ? '' : `<div class="sec">Access Key Pengelola</div>
  <p class="hint">Isi sebagai <code>x-api-key</code> untuk memanggil endpoint khusus owner. Berlaku tanpa batas, jangan dibagikan.</p>
  <div class="iprow"><input id="akv" readonly placeholder="Belum dibuat" autocomplete="off" spellcheck="false"><button class="ib" id="akshow" type="button" aria-label="Tampilkan/sembunyikan" title="Tampilkan/sembunyikan">${ico('eye')}</button><button class="ib" id="akcopy" type="button" aria-label="Salin" title="Salin" hidden>${ico('copy')}</button></div>
  <button class="btn go" id="akgen">${ico('plus')} Generate</button><p class="msg" id="akm"></p>
  <div style="height:14px"></div>`

const panelSettings = () => `${panelAccessKey()}<div class="sec">Whitelist IP</div>
  <p class="hint">IP kamu saat ini: <span class="cur">${esc(who.ip)}</span></p>
  <p class="hint">Semua request dengan API key hanya diterima dari IP yang ada di daftar ini. Daftar kosong = semua request ditolak.</p>
  <div class="hint" style="margin-bottom:0">IP Address (maksimal ${me.max_ips} IP${me.active ? '' : ', akun gratis'})</div>
  <div class="iprow"><input id="nip" placeholder="Contoh: 192.168.1.1" autocomplete="off"><button class="btn ghost sm" id="myip" type="button">IP saya</button></div>
  <p class="hint">Mendukung IPv4 dan IPv6 tunggal.</p>
  <button class="btn go" id="addip">${ico('plus')} Add to Whitelist</button><p class="msg" id="ipm"></p>
  <div class="tw" id="iplist" style="margin-top:12px"><p class="empty">Memuat…</p></div>${me.active ? '' : `<p class="hint">Butuh lebih banyak IP? <a href="/#paket" style="color:var(--blue)">Lihat paket</a></p>`}`

const panelManage = () => `<div class="danger-box">${tile('userx', 'red')}<h4>Hapus Akun</h4>
  <p class="hint">Aksi ini tidak bisa dibatalkan.</p>
  <ul><li>${ico('x')}Profil, foto, dan pengaturan akun dihapus permanen</li><li>${ico('x')}API key tidak bisa dipakai lagi</li><li>${ico('x')}Paket Premium/VIP yang masih aktif ikut hangus</li><li>${ico('x')}Riwayat pemakaian dihapus. Catatan order pembayaran tetap disimpan untuk pembukuan</li></ul>
  <p class="hint" style="text-align:left">Ketik <code>delete</code> untuk konfirmasi:</p>
  ${me.has_password ? '<input id="dp" type="password" placeholder="Password kamu" autocomplete="current-password" style="width:100%;margin-bottom:8px">' : ''}
  <div class="iprow"><input id="dc" placeholder="Ketik: delete" autocomplete="off"><button class="btn danger" id="dbtn" disabled>${ico('trash')} Hapus Akun</button></div>
  <p class="msg" id="dm"></p></div>`

const TABS = [['events', 'gift', 'Events', panelEvents], ['settings', 'shield', 'Settings', panelSettings], ['manage', 'userx', 'Management', panelManage]]

/* ---------- kartu profil ---------- */
const DESC = 'API simpel dan cepat. Mulai gratis, upgrade ke Premium atau VIP kapan saja.'

const photoRow = () => `<div class="field" data-f="photo">${tile('image', 'amber')}<div class="fb"><small>Foto profil</small><div class="fv" id="phv">${photoText()}</div></div>
  <button class="ib" data-pick aria-label="Pilih file foto" title="Pilih file">${ico('folder')}</button><button class="ib" data-rmphoto aria-label="Hapus foto" title="Hapus foto" ${me.avatar_url ? '' : 'hidden'}>${ico('trash')}</button></div><p class="fmsg" id="fm-photo"></p>`
const photoText = () => (me.avatar_url ? 'Foto dari file kamu' : muted('Belum ada. Pilih file JPG, PNG, atau WebP'))

/* border foto: VIP bisa pilih warna sendiri, yang lain dapat bawaan */
const isVip = () => me.role === 'vip' && me.active
const borderRow = () => isVip()
  ? `<div class="field" data-f="border">${tile('image', 'amber')}<div class="fb"><small>Border foto profil (VIP)</small><div class="bd-pick">
      ${(me.border_colors && me.border_colors.length === 3 ? me.border_colors : DEF_BORDER).map((c, i) => `<input type="color" data-bc="${i}" value="${esc(c)}" aria-label="Warna border ${i + 1}">`).join('')}
      <button class="btn go sm" data-bsave>Simpan</button><button class="btn ghost sm" data-breset>Reset</button></div></div></div><p class="fmsg" id="fm-border"></p>`
  : `<p class="hint" style="margin-top:-2px">Border foto profil custom tersedia di paket VIP.</p>`

function paintCard() {
  const box = $('#pimg'); if (!box) return
  const fallback = () => { box.innerHTML = `<span class="pc-ini">${esc(me.username[0])}</span>` }
  if (!me.avatar_url) return fallback()
  const im = new Image()
  im.onload = () => { box.innerHTML = ''; im.alt = ''; im.draggable = false; box.append(im) }
  im.onerror = fallback
  im.src = me.avatar_url
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
  const vb = me.role === 'vip' ? verified('gold') : me.role === 'premium' ? verified('blue') : ''
  el.innerHTML = `
  <section class="pcard" id="pcard">
    <div class="pc-top"><span class="badge ${me.role}">${me.role === 'member' ? 'Free User' : esc(me.plan_name || me.role)}</span></div>
    <div class="pc-mid">
      <div class="pc-photo"><span class="pc-ring" id="pring" style="--ring:${ringStyle()}"></span><div class="pc-img" id="pimg"></div><button class="pc-cam" data-pick aria-label="Ganti foto profil">${ico('camera')}</button></div>
      <p class="pc-hi">Selamat Datang,</p>
      <h1 class="pc-name ${me.role === 'vip' ? 'gold' : ''}"><span class="nm">${esc(me.username)}</span>${vb}</h1>
      <div class="pc-chips"><span class="chip ${me.google ? 'gg' : ''}">${me.google ? `<svg class="i gi" width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.5z"/><path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.2 13.6a6 6 0 0 1 0-3.8V7.1H2.7a10 10 0 0 0 0 9z"/><path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.9 1.5l2.9-2.9A10 10 0 0 0 2.7 7.1l3.5 2.7C7 7.9 9.3 6.1 12 6.1z"/></svg> Akun Google` : `${ico('user')} Akun Arvo`}</span>${me.email ? `<span class="chip">${ico('mail')} ${esc(me.email)}</span>` : ''}</div>
      <p class="pc-desc">${me.bio ? esc(me.bio) : muted('Belum menambahkan bio.')}</p>
    </div>
    <div class="pc-act"><a class="btn go sm" href="/#paket">${ico('bag')} ${me.active ? 'Perpanjang paket' : 'Lihat paket'}</a><a class="btn ghost sm" href="/playground.html">${ico('play')} Playground</a><button class="btn ghost sm" id="out">${ico('logout')} Keluar</button></div>
    <input type="file" id="pf" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
  </section>

  <section class="card trialcard" id="trialtop" hidden></section>

  <section class="card"><div class="card-h">${ico('trend')} Request Metrics</div><div class="card-b">
    <div class="tiles">
      <div class="tile" style="--c:var(--blue)"><div><small>Hari ini</small><b>${me.used_today.toLocaleString('id-ID')}</b><small>${me.daily_limit === null ? 'Unlimited' : `sisa ${n(me.remaining)} / ${n(me.daily_limit)}`}</small></div><span class="ico">${ico('activity')}</span></div>
      <div class="tile" style="--c:var(--g)"><div><small>Total request</small><b>${me.total_requests.toLocaleString('id-ID')}</b><small>sejak bergabung</small></div><span class="ico">${ico('trend')}</span></div>
      <div class="tile" style="--c:var(--amber)"><div><small>Paket</small><b class="sm">${esc(me.plan_name || 'Free User')}</b><small>${me.expired ? 'habis' : me.active ? 'aktif' : 'gratis'}</small></div><span class="ico">${ico('shield')}</span></div>
      <div class="tile" style="--c:var(--red)"><div><small>Masa aktif</small><b class="sm">${me.active ? (me.expires_at ? fmtDate(me.expires_at) : 'Permanen') : '–'}</b><small>${me.max_ips ? 'maks ' + me.max_ips + ' IP' : 'tanpa whitelist'}</small></div><span class="ico">${ico('clock')}</span></div>
    </div>
    ${me.daily_limit ? `<div class="meter" title="${pct.toFixed(0)}% limit harian terpakai"><i style="width:${pct}%"></i></div><p class="hint" style="margin:6px 0 0">Limit direset setiap 00:00 WIB.${me.active ? '' : ' Upgrade paket untuk limit lebih besar.'}</p>` : ''}
    <div id="use" style="margin-top:14px"></div>
  </div></section>

  <div class="dash-grid">
    <div>
      <section class="card"><div class="card-h">${ico('user')} Personal Info</div><div class="card-b">
        <div class="sec">Account</div>${['username', 'email', 'phone', 'bio', 'password'].map(row).join('')}${photoRow()}${borderRow()}
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
      <section class="card"><div class="card-h">${ico('bag')} Paket &amp; pembelian</div><div class="card-b"><p class="hint" style="margin-top:0">Beli paket saat paket kamu masih aktif = perpanjang: durasi ditambah, limit harian &amp; slot IP dijumlahkan, paket sebelumnya tidak hilang.</p><div class="tw" id="ord"><p class="empty">Memuat…</p></div></div></section>
    </div>
  </div>`

  paintCard()
  wireTabs(); loadSide(); loadTrial()
}

const TRIAL_MSG = { off: 'Claim trial sedang tidak tersedia.', claimed: 'Kamu sudah pernah claim trial.', has_plan: 'Kamu masih punya paket aktif, claim tersedia untuk akun tanpa paket.' }
async function claimTrial(btn) {
  btn.disabled = true
  try { const r = await put('/auth/me/trial', {}, 'POST'); toast(`Trial aktif: ${r.name} ${r.days} hari`); await render() }
  catch (err) { toast(err.message); const m = $('#tcm'); if (m) say(m, err.message, 1); btn.disabled = false }
}
/* Claim Trial tampil menonjol di bagian atas profil begitu admin mengaktifkannya (dan akun masih bisa claim).
   Di tab Events tetap ada ringkasan status supaya user tahu alasannya kalau belum bisa claim. */
async function loadTrial() {
  const box = $('#trial'), top = $('#trialtop'); if (!box) return
  try {
    const t = await api('/auth/me/trial')
    if (top) {
      top.hidden = !(t.enabled && t.can_claim)
      if (!top.hidden) {
        top.innerHTML = `<div class="tc-in">${tile('gift', 'green')}<div class="tc-tx"><b>Trial gratis ${esc(t.plan_name)}</b><span>${t.days} hari, satu kali per akun dan per IP.</span></div>
          <button class="btn go" id="tcl">${ico('gift')} Claim trial</button></div><p class="msg" id="tcm"></p>`
        $('#tcl').onclick = (e) => claimTrial(e.currentTarget)
      }
    }
    box.innerHTML = t.enabled
      ? (t.can_claim ? `<p class="hint">Trial <b>${esc(t.plan_name)}</b> ${t.days} hari tersedia untukmu. Klaim lewat kartu di bagian atas halaman.</p>
           <button class="btn go" id="tcl2">${ico('gift')} Claim trial</button>`
        : `<p class="hint">Coba <b>${esc(t.plan_name)}</b> gratis selama <b>${t.days} hari</b>. Satu kali per akun dan per IP.</p>
           <button class="btn go" disabled>${ico('gift')} Claim trial</button><p class="msg">${esc(TRIAL_MSG[t.reason] || '')}</p>`)
      : `<div class="lockbox">${tile('gift', 'mut')}<div>${TRIAL_MSG.off}</div></div>`
    const b2 = $('#tcl2'); if (b2) b2.onclick = (e) => claimTrial(e.currentTarget)
  } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>` }
}

function wireTabs() {
  const rc = $('#rc'), dc = $('#dc')
  if (rc) $('#rcb').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true
    try { const r = await put('/auth/me/redeem', { code: rc.value }, 'POST'); toast(`Kode berhasil: ${r.name} ${r.days ? r.days + ' hari' : 'permanen'}`); await render() }
    catch (err) { say($('#rcm'), err.message, 1); b.disabled = false }
  }
  if ($('#akgen')) {
    let key = ''
    const paint = (show) => { const v = $('#akv'); v.value = key ? (show ? key : maskKey(key)) : ''; v.type = 'text'; $('#akcopy').hidden = !key; $('#akgen').lastChild.textContent = key ? ' Generate ulang' : ' Generate' }
    let shown = false
    const apply = (k, show) => { key = k || ''; shown = !!show; paint(shown) }
    api('/auth/me/accesskey').then((r) => apply(r.access_key, false)).catch((e) => say($('#akm'), e.message, 1))
    $('#akshow').onclick = () => { shown = !shown; paint(shown) }
    $('#akcopy').onclick = () => navigator.clipboard.writeText(key).then(() => toast('Access key disalin'))
    $('#akgen').onclick = async (e) => {
      if (key && !confirm('Generate ulang? Access key lama langsung tidak berlaku.')) return
      const b = e.currentTarget; b.disabled = true
      try { const r = await put('/auth/me/accesskey/reset', {}, 'POST'); apply(r.access_key, true); say($('#akm'), 'Access key baru dibuat. Simpan sekarang.') }
      catch (err) { say($('#akm'), err.message, 1) }
      b.disabled = false
    }
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
    orders = orders.slice(0, 2)
    $('#ord').innerHTML = orders.length ? `<table><tr><th>Tanggal</th><th>Paket</th><th>Total</th><th>Status</th></tr>${orders.map((o) =>
      `<tr><td>${fmtDate(o.created_at)}</td><td>${esc(o.plan)} ${o.days ? o.days + ' hr' : '∞'}</td><td>${rp(o.total)}</td><td>${esc(o.status)}</td></tr>`).join('')}</table>` : '<p class="empty">Belum ada pembelian.</p>'
  }).catch(() => {})
  api('/auth/me/usage').then(({ days, paths, recent }) => {
    if (!days.length) { $('#use').innerHTML = '<p class="empty">Belum ada request dengan API key ini. Coba endpoint di Playground dengan key kamu.</p>'; return }
    /* selalu 14 hari penuh (hari kosong = 0) supaya grafik terbaca, bukan satu balok */
    const key = (off) => new Date(Date.now() + 7 * 3600e3 - off * 864e5).toISOString().slice(0, 10), by = Object.fromEntries(days.map((d) => [d.day, d.n]))
    const series = Array.from({ length: 14 }, (_, i) => { const k = key(13 - i); return { day: k, n: by[k] || 0 } }), max = Math.max(1, ...series.map((d) => d.n))
    $('#use').innerHTML = `<div class="sec">Pemakaian 14 hari</div><div class="chart">${series.map((d, i) => `<div class="cb ${i === 13 ? 'today' : ''}" title="${esc(d.day)}: ${d.n} request"><span class="cv">${d.n || ''}</span><div class="bw"><i style="height:${d.n ? Math.max(8, (d.n / max) * 100) : 2}%"></i></div><em>${d.day.slice(8)}</em></div>`).join('')}</div>
      <div class="tw"><table><tr><th>Endpoint</th><th>Request</th></tr>${paths.map((p) => `<tr><td class="mono">${esc(p.path)}</td><td>${p.n.toLocaleString('id-ID')}</td></tr>`).join('')}</table></div>
      ${recent && recent.length ? `<div class="sec" style="margin-top:14px">Riwayat terbaru</div><div class="tw"><table><tr><th>Waktu</th><th>Endpoint</th><th>IP</th></tr>${recent.slice(0, 2).map((r) => `<tr><td>${fmtDT(r.at)}</td><td class="mono">${esc(r.path)}</td><td class="mono">${esc(r.ip || '-')}</td></tr>`).join('')}</table></div>` : ''}`
  }).catch(() => {})
}

/* satu handler klik untuk seluruh halaman */
el.onclick = async (e) => {
  const t = e.target.closest('button'); if (!t) return
  if (t.dataset.tab) { tab = t.dataset.tab; el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b === t)); el.querySelectorAll('[data-p]').forEach((p) => (p.hidden = p.dataset.p !== tab)) }
  else if (t.dataset.edit) startEdit(t.dataset.edit)
  else if (t.dataset.save) saveField(t.dataset.save, t)
  else if ('cancel' in t.dataset) render()
  else if ('eye' in t.dataset) { showKey = !showKey; $('#kv').textContent = showKey ? me.api_key : maskKey(me.api_key); t.innerHTML = ico(showKey ? 'eyeoff' : 'eye') }
  else if ('copyk' in t.dataset) navigator.clipboard.writeText(me.api_key).then(() => flash(t))
  else if (t.dataset.delip) { t.disabled = true; try { await api('/auth/me/ips/' + encodeURIComponent(t.dataset.delip), { method: 'DELETE' }); loadIps() } catch (err) { say($('#ipm'), err.message, 1); t.disabled = false } }
  else if ('bsave' in t.dataset) { t.disabled = true; try { await put('/auth/me/border', { colors: [...el.querySelectorAll('[data-bc]')].map((i) => i.value) }); toast('Border profil diperbarui'); await render() } catch (err) { fsay('fm-border', err.message, 1); t.disabled = false } }
  else if ('breset' in t.dataset) { t.disabled = true; try { await put('/auth/me/border', { colors: [] }); toast('Border dikembalikan ke bawaan'); await render() } catch (err) { fsay('fm-border', err.message, 1); t.disabled = false } }
  else if ('pick' in t.dataset) $('#pf').click()
  else if ('rmphoto' in t.dataset) { t.disabled = true; try { await api('/auth/me/avatar', { method: 'DELETE' }); await refreshPhoto('Foto profil dihapus') } catch (err) { toast(err.message) } t.disabled = false }
  else if (t.id === 'out') { await put('/auth/logout', {}, 'POST'); location.href = '/' }
}

/* pratinjau langsung saat memilih warna border */
el.oninput = (e) => { if (e.target.dataset.bc != null) $('#pring').style.setProperty('--ring', ringCss([...el.querySelectorAll('[data-bc]')].map((i) => i.value))) }
el.onchange = (e) => { if (e.target.id === 'pf') pickPhoto(e.target.files[0]) }

ready.then(({ user, who: w }) => { who = w; return user ? render() : (location.href = '/login.html?next=/profile.html') })
  .catch((e) => { el.innerHTML = `<p class="err" style="padding:20px">Gagal memuat profil: ${esc(e.message || e)}. <a href="" style="color:var(--blue)">Coba lagi</a></p>` })
