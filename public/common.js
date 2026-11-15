const $ = (s, r = document) => r.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const rp = (n) => 'Rp' + Number(n).toLocaleString('id-ID')
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Permanen')
const api = async (path, opt = {}) => {
  const r = await fetch('/api' + path, { credentials: 'same-origin', ...opt, headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.message || 'Terjadi kesalahan'), { status: r.status })
  return j
}
const put = (path, data, method = 'PUT') => api(path, { method, body: JSON.stringify(data) })
const copy = (t, b) => navigator.clipboard.writeText(t).then(() => { const o = b.textContent; b.textContent = 'Tersalin'; setTimeout(() => (b.textContent = o), 1500) })
const say = (el, t, bad) => { el.textContent = t; el.className = 'msg' + (bad ? ' err' : '') }

const root = document.documentElement
root.dataset.theme = localStorage.getItem('theme') || 'dark'

/* header & footer dipakai semua halaman */
document.body.insertAdjacentHTML('afterbegin', `<header class="nav"><div class="wrap nav-in">
  <a class="brand" href="/">Arvo</a>
  <nav><a href="/#paket">Paket</a><a href="/#cara">Cara kerja</a><a href="/playground.html">Playground</a><a href="/#faq">FAQ</a></nav>
  <span id="navr" class="row"></span>
  <button id="theme" class="btn ghost" aria-label="Ganti tema"></button></div></header>`)
document.body.insertAdjacentHTML('beforeend', `<footer><div class="wrap foot"><b>Arvo</b><span>© 2026 · <a href="/docs">OpenAPI</a> · <a href="/playground.html">Playground</a></span></div></footer>`)
const syncTheme = () => ($('#theme').textContent = root.dataset.theme === 'dark' ? 'Terang' : 'Gelap')
$('#theme').onclick = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('theme', root.dataset.theme); syncTheme() }
syncTheme()

const ready = Promise.all([
  api('/auth/me').catch(() => null),
  api('/billing/whoami').catch(() => ({ ip: '-', is_owner: false })),
]).then(([user, who]) => {
  $('#navr').innerHTML = (who.is_owner ? '<a class="btn ghost" href="/admin.html">Admin</a>' : '') +
    (user ? `<a class="btn ghost" href="/profile.html">${esc(user.username)}</a>` : '<a class="btn" href="/login.html">Masuk</a>')
  return { user, who }
})
