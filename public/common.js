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

const NI = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
}
const ni = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${NI[n]}</svg>`
const LINKS = [['/#paket', 'Paket'], ['/#cara', 'Cara kerja'], ['/playground.html', 'Playground'], ['/#faq', 'FAQ']]

/* header & footer dipakai semua halaman */
document.body.insertAdjacentHTML('afterbegin', `<header class="nav"><div class="wrap nav-in">
  <button id="mbtn" class="nb mbtn" aria-label="Menu">${ni('menu')}</button>
  <a class="brand" href="/"><span class="logo">A</span>Arvo</a>
  <nav class="links">${LINKS.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</nav>
  <span class="sp"></span>
  <span id="navr" class="navr"></span>
  <button id="theme" class="nb" aria-label="Ganti tema"></button></div>
  <div class="mnav" id="mnav"><div>${LINKS.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</div></div></header>`)
document.body.insertAdjacentHTML('beforeend', `<footer><div class="wrap foot"><b>Arvo</b><span>© 2026 · <a href="/docs">OpenAPI</a> · <a href="/playground.html">Playground</a></span></div></footer>`)
const syncTheme = () => ($('#theme').innerHTML = ni(root.dataset.theme === 'dark' ? 'sun' : 'moon'))
$('#theme').onclick = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('theme', root.dataset.theme); syncTheme() }
$('#mbtn').onclick = () => $('#mnav').classList.toggle('open')
$('#mnav').onclick = (e) => { if (e.target.closest('a')) $('#mnav').classList.remove('open') }
document.querySelectorAll('.links a').forEach((a) => { if (a.pathname === location.pathname && !a.hash) a.classList.add('on') })
syncTheme()

const ready = Promise.all([
  api('/auth/me').catch(() => null),
  api('/billing/whoami').catch(() => ({ ip: '-', is_owner: false })),
]).then(([user, who]) => {
  $('#navr').innerHTML = (who.is_owner ? `<a class="nb adm" href="/admin.html" title="Admin" aria-label="Admin">${ni('shield')}</a>` : '') +
    (user ? `<a class="av" href="/profile.html" title="${esc(user.username)}" aria-label="Profil ${esc(user.username)}">${esc(user.username[0])}${user.avatar_url ? `<img src="${esc(user.avatar_url)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</a>` : '<a class="btn" href="/login.html">Masuk</a>')
  return { user, who }
})
