const $ = (s, r = document) => r.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const rp = (n) => 'Rp' + Number(n).toLocaleString('id-ID')
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Permanen')
const api = async (path, opt = {}) => {
  let r
  try { r = await fetch('/api' + path, { credentials: 'same-origin', signal: AbortSignal.timeout(25000), ...opt, headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) } }) }
  catch (e) { throw new Error(e.name === 'TimeoutError' ? 'Server tidak merespons (timeout 25 detik).' : 'Tidak bisa menghubungi server.') }
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error((j.message || 'Terjadi kesalahan') + (j.detail ? '\n' + j.detail : '')), { status: r.status })
  return j
}
const put = (path, data, method = 'PUT') => api(path, { method, body: JSON.stringify(data) })
const copy = (t, b) => navigator.clipboard.writeText(t).then(() => { const o = b.textContent; b.textContent = 'Tersalin'; setTimeout(() => (b.textContent = o), 1500) })
const say = (el, t, bad) => { el.textContent = t; el.className = 'msg' + (bad ? ' err' : '') }

const root = document.documentElement
root.dataset.theme = localStorage.getItem('theme') || 'dark'
root.classList.add('js')

/* Logo Arvo (huruf A + R) hasil tracing logo asli ke vektor. Sama dengan /logo.svg; fill=currentColor supaya ikut warna tile. */
const LOGO_PATH = 'M40.6 0.5L0.1 70.9L14.2 70.9L40.5 25.6L41.7 27.3L56.0 27.3ZM49.3 0.0L56.4 12.5L85.2 12.4L85.5 12.9L72.7 34.9L43.4 34.9L36.3 47.3L53.1 47.4L66.8 70.9L81.1 70.9L67.9 47.5L80.1 47.2L100.0 12.4L92.8 0.0Z'
const LOGO = `<svg viewBox="0 0 100 70.9" aria-hidden="true"><path d="${LOGO_PATH}"/></svg>`

/* Muncul halus saat di-scroll. Tandai elemen dengan class "rv" lalu panggil reveal(). */
const revealIO = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) {
    const el = e.target, wait = 1100 + (+el.style.getPropertyValue('--i') || 0) * 70
    el.classList.add('in'); revealIO.unobserve(el)
    setTimeout(() => { el.classList.remove('rv', 'in'); el.style.removeProperty('--i') }, wait)
  }
}), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }) : null
const reveal = (scope = document) => scope.querySelectorAll('.rv:not(.in)').forEach((el, i) => {
  if (!el.style.getPropertyValue('--i')) el.style.setProperty('--i', i % 6)
  revealIO ? revealIO.observe(el) : el.classList.add('in')
})

const NI = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
}
const ni = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${NI[n]}</svg>`
const LINKS = [['/#paket', 'Paket'], ['/#cara', 'Cara kerja'], ['/playground.html', 'Playground'], ['/#faq', 'FAQ']]

/* header & footer dipakai semua halaman */
document.body.insertAdjacentHTML('afterbegin', `<header class="nav"><div class="wrap nav-in">
  <button id="mbtn" class="nb mbtn" aria-label="Menu">${ni('menu')}</button>
  <a class="brand" href="/"><span class="logo">${LOGO}</span>Arvo</a>
  <nav class="links">${LINKS.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</nav>
  <span class="sp"></span>
  <span id="navr" class="navr"></span>
  <button id="theme" class="nb" aria-label="Ganti tema"></button></div>
  <div class="mnav" id="mnav"><div>${LINKS.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</div></div></header>`)
document.body.insertAdjacentHTML('beforeend', `<footer><div class="wrap foot"><b>Arvo</b><span>© 2026 · <a href="/playground.html">Playground</a></span></div></footer>`)
const syncTheme = () => ($('#theme').innerHTML = ni(root.dataset.theme === 'dark' ? 'sun' : 'moon'))
$('#theme').onclick = () => {
  const swap = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('theme', root.dataset.theme); syncTheme() }
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion:reduce)').matches) return swap()
  root.dataset.vt = 'theme'
  document.startViewTransition(swap).finished.finally(() => delete root.dataset.vt)
}
$('#mbtn').onclick = () => $('#mnav').classList.toggle('open')
$('#mnav').onclick = (e) => { if (e.target.closest('a')) $('#mnav').classList.remove('open') }
document.querySelectorAll('.links a').forEach((a) => { if (a.pathname === location.pathname && !a.hash) a.classList.add('on') })
syncTheme()

const ready = Promise.all([
  api('/auth/me').catch(() => null),
  api('/billing/whoami').catch(() => ({ ip: '-', is_owner: false })),
]).then(([user, who]) => {
  $('#navr').innerHTML = (who.is_admin || who.is_owner ? `<a class="nb adm" href="/admin.html" title="Admin" aria-label="Admin">${ni('shield')}</a>` : '') +
    (user ? `<a class="nb" href="/profile.html" title="${esc(user.username)}" aria-label="Profil ${esc(user.username)}">${ni('user')}</a>` : '<a class="btn" href="/login.html">Masuk</a>')
  return { user, who }
})

/* ---------- bar atas bereaksi saat scroll + indikator tab yang meluncur ---------- */
{
  const bar = $('.nav'); const onScroll = () => bar.classList.toggle('sc', scrollY > 6)
  addEventListener('scroll', onScroll, { passive: true }); onScroll()
  const slider = (box) => {
    const ind = document.createElement('i'); ind.className = 'ind'; box.append(ind); box.classList.add('has-ind')
    let first = true
    const move = () => {
      const on = box.querySelector('button.on'); if (!on || !on.offsetWidth) { ind.style.opacity = 0; return }
      ind.style.opacity = 1; ind.classList.toggle('red', on.classList.contains('del'))
      if (first) ind.style.transition = 'none'
      ind.style.transform = `translate3d(${on.offsetLeft}px,0,0)`; ind.style.width = on.offsetWidth + 'px'
      if (first) { void ind.offsetWidth; ind.style.transition = ''; first = false }
    }
    new MutationObserver(move).observe(box, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] })
    addEventListener('resize', () => { first = true; move() }); move()
  }
  let q = false
  const scan = () => { q = false; document.querySelectorAll('.tabs:not(.has-ind),.seg:not(.has-ind)').forEach(slider) }
  new MutationObserver(() => { if (!q) { q = true; requestAnimationFrame(scan) } }).observe(document.body, { childList: true, subtree: true })
  scan()
}
