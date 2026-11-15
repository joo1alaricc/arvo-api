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
root.classList.add('js')

/* Logo Arvo: huruf A dari dua garis naik + palang, dipakai di navbar dan kartu profil */
const LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 19 12 5l6.8 14M8.4 14.2h7.2"/></svg>'

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

/* Warna aksen dari sebuah foto: hue paling dominan (dibobot kejenuhan). null kalau fotonya abu-abu. */
const accentOf = (img) => {
  try {
    const S = 40, c = document.createElement('canvas'); c.width = c.height = S
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, S, S)
    const d = x.getImageData(0, 0, S, S).data, bin = Array.from({ length: 36 }, () => ({ w: 0, s: 0 }))
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn
      if (!dl) continue
      const s = dl / (1 - Math.abs(2 * l - 1) || 1), w = s * (1 - Math.abs(2 * l - 1)) ** 1.5
      if (w < 0.04) continue
      let h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4
      h = (h * 60 + 360) % 360
      const k = bin[Math.floor(h / 10) % 36]; k.w += w; k.s += s * w
    }
    let best = 0; bin.forEach((k, i) => { const n = k.w + (bin[(i + 1) % 36].w + bin[(i + 35) % 36].w) * 0.5; if (n > bin[best].w + (bin[(best + 1) % 36].w + bin[(best + 35) % 36].w) * 0.5) best = i })
    const k = bin[best]; if (k.w < 0.6) return null
    return { h: best * 10 + 5, s: Math.round(Math.min(0.9, Math.max(0.55, k.s / k.w)) * 100) }
  } catch { return null }
}

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
document.body.insertAdjacentHTML('beforeend', `<footer><div class="wrap foot"><b>Arvo</b><span>© 2026 · <a href="/docs">OpenAPI</a> · <a href="/playground.html">Playground</a></span></div></footer>`)
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
  $('#navr').innerHTML = (who.is_owner ? `<a class="nb adm" href="/admin.html" title="Admin" aria-label="Admin">${ni('shield')}</a>` : '') +
    (user ? `<a class="nb" href="/profile.html" title="${esc(user.username)}" aria-label="Profil ${esc(user.username)}">${ni('user')}</a>` : '<a class="btn" href="/login.html">Masuk</a>')
  return { user, who }
})
