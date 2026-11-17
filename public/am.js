/* Tools › Aktivasi AM: kirim magic link ke email Alight Motion, lalu verifikasi link-nya. Khusus Premium 1 ke atas. */
const el = $('#app')
const KEY = 'arvo_am_job'
const okc = 'color:var(--g)'
const loadJob = () => { try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j && j.id && Date.now() - j.t < 6 * 3600e3 ? j : null } catch { return null } }
const saveJob = (j) => { try { j ? localStorage.setItem(KEY, JSON.stringify(j)) : localStorage.removeItem(KEY) } catch {} }
const note = (e, t, bad) => { e.textContent = t; e.className = 'msg' + (bad ? ' err' : ''); e.style.cssText = bad || !t ? '' : okc }

const locked = (user) => {
  el.innerHTML = `<h1>Aktivasi AM</h1><p class="sub">Aktivasi premium Alight Motion lewat magic link.</p>
  <div class="card"><div class="card-b">
    <p style="margin:0 0 6px;font-weight:700">Khusus Premium 1 ke atas</p>
    <p class="sub" style="margin:0 0 12px">${user.expired ? 'Paketmu sudah berakhir. Perpanjang' : 'Upgrade paketmu'} untuk memakai fitur ini.</p>
    <a class="btn" href="/#paket">Lihat paket</a>
  </div></div>`
}

const render = () => {
  const job = loadJob()
  el.innerHTML = `<h1>Aktivasi AM</h1><p class="sub">Aktivasi premium Alight Motion lewat magic link: kirim ke emailmu, buka emailnya, lalu tempel link-nya di langkah 2.</p>
  <div class="card"><div class="card-h">${ni('bolt')}<span>1. Kirim Magic Link</span></div><div class="card-b">
    <form id="f1" style="display:grid;gap:10px">
      <input id="em" type="email" placeholder="Email akun Alight Motion" autocomplete="email" required>
      <button class="btn block" id="b1">Kirim Magic Link</button>
    </form><p class="msg" id="m1"></p>
  </div></div>
  <div class="card"><div class="card-h">${ni('check')}<span>2. Verifikasi Magic Link</span></div><div class="card-b">
    <form id="f2" style="display:grid;gap:10px">
      <p class="sub" style="margin:0;font-size:12.5px">Job ID: <span class="mono" id="jid">${job ? esc(job.id) : '—'}</span></p>
      <textarea id="lk" rows="4" placeholder="Tempel link dari email (https://alight-creative.firebaseapp.com/__/auth/action?...)" style="width:100%;font-family:'JetBrains Mono',monospace;font-size:12.5px" required></textarea>
      <button class="btn block" id="b2" ${job ? '' : 'disabled'}>Verifikasi</button>
    </form><p class="msg" id="m2">${job ? '' : 'Kirim magic link dulu di langkah 1.'}</p>
  </div></div>`

  $('#f1').onsubmit = async (ev) => {
    ev.preventDefault()
    const b = $('#b1'), m = $('#m1'); b.disabled = true; note(m, 'Mengirim…')
    try {
      const r = await put('/tools/am/generate', { email: $('#em').value.trim() }, 'POST')
      saveJob(r.job_id ? { id: r.job_id, t: Date.now() } : null)
      $('#jid').textContent = r.job_id || '—'; $('#b2').disabled = !r.job_id
      note(m, r.message + (r.job_id ? '' : ' (Job ID tidak diterima, coba kirim ulang.)')); note($('#m2'), '')
    } catch (e) { note(m, e.message, 1) }
    b.disabled = false
  }
  $('#f2').onsubmit = async (ev) => {
    ev.preventDefault()
    const j = loadJob(), b = $('#b2'), m = $('#m2')
    if (!j) return note(m, 'Job ID kedaluwarsa. Kirim magic link lagi di langkah 1.', 1)
    b.disabled = true; note(m, 'Memverifikasi…')
    try {
      const r = await put('/tools/am/verify', { job_id: j.id, link: $('#lk').value.trim() }, 'POST')
      saveJob(null); $('#jid').textContent = '—'; $('#lk').value = ''
      note(m, r.message); return
    } catch (e) { note(m, e.message, 1) }
    b.disabled = false
  }
}

ready.then(({ user, who }) => {
  if (!user) return (location.href = '/login.html?next=/am')
  const allowed = (user.active && (user.role === 'premium' || user.role === 'vip')) || (who && who.is_admin)
  allowed ? render() : locked(user)
})
