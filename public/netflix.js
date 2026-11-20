/* Tools › Netflix Token Generator. API key hanya berada di Worker Secret. */
const el = $('#app'); el.classList.add('nft')
const css = document.createElement('style')
css.textContent = `.nft{max-width:620px}.nft h1{font-size:19px;margin:0 0 2px}.nft>.sub{font-size:12.5px;line-height:1.5;margin:0 0 12px}.nft .card{margin-bottom:10px}.nft .card-h{padding:10px 12px;font-size:13px}.nft .card-b{padding:11px 12px}.nft input,.nft textarea{width:100%;padding:9px 11px}.nft textarea{min-height:84px;resize:vertical;font-family:'JetBrains Mono',monospace;font-size:11.5px}.nft .btn{padding:9px 14px}.nft .msg{margin:8px 0 0;font-size:12.5px;white-space:pre-wrap;overflow-wrap:anywhere}.nft .msg:empty{display:none}.nft .mono{font-family:'JetBrains Mono',monospace;overflow-wrap:anywhere;word-break:break-all}.nft .data{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.nft .datum{padding:9px 10px;border:1px solid var(--bd);border-radius:10px;min-width:0}.nft .datum small{display:block;color:var(--mut);font-size:10px;margin-bottom:3px}.nft .datum strong{font-size:12px;overflow-wrap:anywhere}.nft .dev-links{display:flex;gap:7px;flex-wrap:wrap}.nft .dev-links .link-item{font-size:12px;font-weight:600;padding:8px 8px 8px 14px;display:inline-flex;align-items:center;gap:8px;color:var(--acx)}.nft .dev-links .li-copy{display:inline-flex;align-items:center;justify-content:center;width:23px;height:23px;border-radius:7px;background:rgba(0,0,0,.32);flex:none;transition:background-color .2s,transform .15s}.nft .dev-links .li-copy:hover{background:rgba(0,0,0,.46)}.nft .dev-links .li-copy:active{transform:scale(.88)}.nft .dev-links .li-copy svg{width:14px;height:14px;stroke:#fff}.nft .dev-links .li-copy.ok svg{stroke:#6bffa0}.nft .token{max-height:125px}.nft .muted{color:var(--mut);font-size:11.5px;line-height:1.5}@media(max-width:420px){.nft .data{grid-template-columns:1fr}}`
document.head.append(css)
const I = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${NI[n] || ''}</svg>`
const note = (e, t, bad) => { e.textContent = t; e.className = 'msg' + (bad ? ' err' : ''); e.style.color = bad ? 'var(--r)' : t ? 'var(--g)' : '' }
const safe = (v) => v == null || v === '' ? '—' : esc(String(v))
const copyToken = async (v, b) => {
  try {
    await navigator.clipboard.writeText(v)
    if (b.classList.contains('li-copy')) { b.innerHTML = I('check'); b.classList.add('ok'); setTimeout(() => { b.innerHTML = I('copy'); b.classList.remove('ok') }, 1200) }
    else { const old = b.textContent; b.textContent = 'Tersalin'; setTimeout(() => b.textContent = old, 1200) }
  } catch { note($('#gen-msg'), 'Browser tidak mengizinkan akses clipboard.', true) }
}
const render = () => {
  el.innerHTML = `<h1>Netflix Token Generator</h1><p class="sub">Buat token Netflix untuk akun yang kamu miliki. Cookie bersifat opsional, kosongkan untuk mode auto-generate.</p>
  <div class="card"><div class="card-h">${I('key')}<span>Konfigurasi Token</span></div><div class="card-b">
    <form id="gen" style="display:grid;gap:9px"><label for="cookie" style="font-size:12px;font-weight:700">Netflix session cookie <span style="color:var(--mut);font-weight:400">(opsional)</span></label>
    <textarea id="cookie" rows="3" placeholder="Kosongkan untuk auto-generate" autocomplete="off" spellcheck="false"></textarea>
    <p class="muted" style="margin:0">Cookie merupakan kredensial sesi. Jangan masukkan cookie milik orang lain dan jangan bagikan hasil token kepada siapa pun.</p>
    <button class="btn block" id="generate">Generate Token</button></form><p class="msg" id="gen-msg"></p>
  </div></div><section id="result" hidden></section>`
  $('#gen').onsubmit = async (ev) => {
    ev.preventDefault(); const b = $('#generate'), m = $('#gen-msg'); b.disabled = true; note(m, 'Menghubungi layanan…')
    try {
      const r = await put('/tools/netflix-token/generate', { cookie: $('#cookie').value.trim() }, 'POST')
      show(r.result); note(m, r.code || 'Token berhasil dibuat.')
    } catch (e) { note(m, e.message || 'Gagal membuat token.', true) }
    b.disabled = false
  }
}
const show = (r) => {
  const d = r.accountData || {}, links = r.links || {}
  const rows = [['Email',d.email],['Paket',d.plan],['Negara',d.country],['Batas perangkat',d.deviceLimit],['Profil',d.profiles],['Metode pembayaran',d.paymentMethod]]
  $('#result').hidden = false
  $('#result').innerHTML = `<div class="card"><div class="card-h">${I('check')}<span>Token berhasil dibuat</span></div><div class="card-b" style="display:grid;gap:10px">
    <div><label style="font-size:12px;font-weight:700">Netflix Token</label><textarea class="token mono" id="token" readonly spellcheck="false"></textarea><button class="btn" id="copy-token" style="margin-top:7px">Salin Token</button></div>
    <div class="data">${rows.map(([k,v])=>`<div class="datum"><small>${k}</small><strong>${safe(v)}</strong></div>`).join('')}</div>
    <div class="datum"><small>Kedaluwarsa</small><strong>${safe(r.expiry ? new Date(r.expiry).toLocaleString('id-ID') : null)}</strong></div>
    <div><label style="font-size:12px;font-weight:700">Tautan perangkat</label><div class="dev-links" style="margin-top:7px">${[['PC',links.pc],['Android',links.android],['Android Intent',links.androidIntent],['TV',links.tv]].filter(x=>x[1]).map(([n,u])=>`<a class="btn link-item" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><span>${n}</span><span class="li-copy" data-u="${esc(u)}" role="button" tabindex="0" aria-label="Salin tautan ${esc(n)}">${I('copy')}</span></a>`).join('')}</div></div>
    <p class="muted" style="margin:0">Token dan tautan ini dapat memberikan akses ke sesi akun. Simpan secara pribadi. Data harga tidak ditampilkan.</p>
  </div></div>`
  $('#token').value = r.token || ''
  $('#copy-token').onclick = () => copyToken(r.token || '', $('#copy-token'))
  $('#result').querySelectorAll('.li-copy').forEach((b) => {
    const go = (ev) => { ev.preventDefault(); ev.stopPropagation(); copyToken(b.dataset.u || '', b) }
    b.addEventListener('click', go)
    b.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') go(ev) })
  })
}
const locked = (user, requiredName = 'Premium 2') => {
  const current = user?.plan_name || 'Free User'
  el.innerHTML = `<h1>Netflix Token Generator</h1><p class="sub">Generator token untuk akun Netflix milikmu.</p>
  <div class="card"><div class="card-b">
    <p style="margin:0 0 6px;font-weight:700">Khusus ${esc(requiredName)} ke atas</p>
    <p class="sub" style="margin:0 0 12px">Paket saat ini: <b>${esc(current)}</b>. ${user?.expired ? 'Paketmu sudah berakhir. Perpanjang' : 'Upgrade paketmu'} untuk memakai fitur ini.</p>
    <a class="btn" href="/#paket">Lihat paket</a>
  </div></div>`
}
let booted = false
const bootError = (message) => {
  if (booted) return
  booted = true
  el.innerHTML = `<h1>Netflix Token Generator</h1><div class="card"><div class="card-b"><p class="msg" style="color:var(--r)">${esc(message)}</p><button class="btn" onclick="location.reload()">Muat ulang</button></div></div>`
}
const bootTimer = setTimeout(() => bootError('Halaman terlalu lama memuat data akun. Periksa koneksi lalu muat ulang.'), 12000)
Promise.all([
  api('/auth/me').catch((error) => ({ __error: error })),
  api('/billing/whoami').catch(() => ({ is_admin: false })),
  api('/billing/plans').catch(() => ({ plans: [] })),
]).then(([user, who, catalog]) => {
  if (booted) return
  booted = true; clearTimeout(bootTimer)
  if (user?.__error) {
    if (user.__error.status === 401) return location.href = '/login.html?next=/netflix'
    return bootError(user.__error.message || 'Gagal memuat data akun. Muat ulang halaman.')
  }
  if (!user) return location.href = '/login.html?next=/netflix'
  const allowed = user.active && ['premium2','premium3','vip1','vip2','vip3'].includes(user.plan)
  const requiredName = catalog?.plans?.find((p) => p.id === 'premium2')?.name || 'Premium 2'
  if (allowed || who?.is_admin) render()
  else locked(user, requiredName)
}).catch((e) => { clearTimeout(bootTimer); bootError(e?.message || 'Gagal memuat data akun. Muat ulang halaman.') })
