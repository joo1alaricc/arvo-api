/* Tools › Aktivasi AM: kirim magic link ke email Alight Motion, lalu verifikasi link-nya. Khusus Premium 1 ke atas. */
const el = $('#app'); el.classList.add('am')
const st = document.createElement('style')
st.textContent = `.am{max-width:520px}.am h1{font-size:19px;margin:0 0 2px}.am>.sub{font-size:12.5px;line-height:1.45;margin:0 0 12px}.am .card{margin-bottom:10px}.am .card-h{padding:10px 12px;font-size:13px}.am .card-b{padding:11px 12px}.am input,.am textarea{width:100%;padding:9px 11px}.am textarea{min-height:84px;resize:vertical}.am .btn{padding:9px 14px}.am .msg{margin:8px 0 0;font-size:12.5px;white-space:pre-wrap;overflow-wrap:anywhere}.am .msg:empty{display:none}.am .jid{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--mut)}.am .jid .mono{color:var(--tx);overflow-wrap:anywhere}`
document.head.append(st)
const KEY = 'arvo_am_job'
const I = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${NI[n]}</svg>`
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
  el.innerHTML = `<h1>Aktivasi AM</h1><p class="sub">Kirim magic link ke email Alight Motion, buka emailnya, lalu tempel link-nya di langkah 2.</p>
  <div class="card"><div class="card-h">${I('bolt')}<span>1. Kirim Magic Link</span></div><div class="card-b">
    <form id="f1" style="display:grid;gap:8px">
      <input id="em" type="email" placeholder="Email akun Alight Motion" autocomplete="email" required>
      <button class="btn block" id="b1">Kirim Magic Link</button>
    </form><p class="msg" id="m1"></p>
  </div></div>
  <div class="card"><div class="card-h">${I('check')}<span>2. Verifikasi Magic Link</span></div><div class="card-b">
    <form id="f2" style="display:grid;gap:8px">
      <p class="jid" style="margin:0">Job ID <span class="mono" id="jid">${job ? esc(job.id) : '—'}</span></p>
      <textarea id="lk" rows="4" placeholder="Tempel link dari email (https://alight-creative.firebaseapp.com/__/auth/action?...)" style="font-family:'JetBrains Mono',monospace;font-size:12px" required></textarea>
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
