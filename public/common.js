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

/* Tautan & logo sosial (dipakai drawer menu dan popup sambutan) */
const WA_LINK = 'https://whatsapp.com/channel/0029Vb76SfPDzgTBlh5Tn70I'
const IG_LINK = 'https://www.instagram.com/brzee_.sky'
const WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'
const IG_SHAPES = '<rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.6" cy="6.4" r="1.3" fill="currentColor"/>'

const NI = {
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>', list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  play: '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/>', help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>', chev: '<path d="m9 6 6 6-6 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  home: '<path d="m3 10.5 9-7.5 9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>', compass: '<circle cx="12" cy="12" r="10"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5z"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>', grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', up: '<path d="m6 15 6-6 6 6"/>',
}
const ni = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${NI[n]}</svg>`
const DR_GROUPS = [   /* [judul grup, ikon, [[href, label, ikon], ...]] */
  ['Utama', 'compass', [['/', 'Beranda', 'home'], ['/dashboard.html', 'Dashboard', 'grid'], ['/#paket', 'Paket', 'bag'], ['/#cara', 'Cara kerja', 'list'], ['/#faq', 'FAQ', 'help']]],
  ['Developer', 'code', [['/playground.html', 'Playground', 'play']]],
]
const LINKS = [['/dashboard.html', 'Dashboard', 'grid'], ['/#paket', 'Paket', 'bag'], ['/#cara', 'Cara kerja', 'list'], ['/playground.html', 'Playground', 'play'], ['/#faq', 'FAQ', 'help']]

/* header & footer dipakai semua halaman */
document.body.insertAdjacentHTML('afterbegin', `<header class="nav"><div class="wrap nav-in">
  <button id="mbtn" class="nb mbtn" aria-label="Buka menu" aria-expanded="false" aria-controls="dr"><svg viewBox="0 0 24 24" class="burger" aria-hidden="true"><path class="b1" d="M4 6h16"/><path class="b2" d="M4 12h16"/><path class="b3" d="M4 18h16"/></svg></button>
  <a class="brand" href="/"><span class="logo">${LOGO}</span>Arvo</a>
  <nav class="links">${LINKS.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</nav>
  <span class="sp"></span>
  <span id="navr" class="navr"></span>
  <button id="theme" class="nb" aria-label="Ganti tema"></button></div></header>`)
document.body.insertAdjacentHTML('beforeend', `<footer><div class="wrap foot"><b>Arvo</b><span>© 2026 · <a href="/playground.html">Playground</a></span></div></footer>`)
/* ---------- drawer menu: meluncur dari kiri, ikon garis tiga berubah jadi silang ---------- */
document.body.insertAdjacentHTML('beforeend', `<div class="dr-bd" id="drbd"></div>
<aside class="dr" id="dr" aria-label="Menu navigasi" aria-hidden="true" inert>
  <nav class="dr-nav" id="drnav">${DR_GROUPS.map(([g, gi, items], gx) => `<section class="dr-g open" style="--i:${gx * 3}">
      <button type="button" class="dr-gh" aria-expanded="true"><span class="dr-gic">${ni(gi)}</span><span>${g}</span>${ni('up')}</button>
      <div class="dr-gb"><div class="dr-gl">${items.map(([h, t, ic]) => `<a class="dr-it" href="${h}"><span class="dr-ic">${ni(ic)}</span><span>${t}</span>${ni('check')}</a>`).join('')}</div></div></section>`).join('')}
    <hr class="dr-hr"><div class="dr-loose" id="drme"></div></nav>
  <div class="dr-card">
    <div class="dr-row"><span>Tampilan</span><button type="button" class="dr-sw" id="drtheme" role="switch" aria-label="Mode gelap"><i></i><b></b></button></div>
    <a class="dr-row dr-soc" href="${WA_LINK}" target="_blank" rel="noopener noreferrer"><span class="dr-sic wa"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${WA_PATH}"/></svg></span><span class="dr-st"><b>Ikuti saluran</b><small>Saluran WhatsApp resmi</small></span>${ni('chev')}</a>
    <a class="dr-row dr-soc" href="${IG_LINK}" target="_blank" rel="noopener noreferrer"><span class="dr-sic ig"><svg viewBox="0 0 24 24" aria-hidden="true">${IG_SHAPES}</svg></span><span class="dr-st"><b>Ikuti Instagram</b><small>@brzee_.sky</small></span>${ni('chev')}</a>
  </div>
</aside>`)
const syncTheme = () => {
  const dark = root.dataset.theme === 'dark'
  $('#theme').innerHTML = ni(dark ? 'sun' : 'moon')
  const sw = $('#drtheme'); if (sw) { sw.setAttribute('aria-checked', dark); sw.querySelector('b').textContent = dark ? 'Dark' : 'Light' }
}
const toggleTheme = () => {
  const swap = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('theme', root.dataset.theme); syncTheme() }
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion:reduce)').matches) return swap()
  root.dataset.vt = 'theme'
  document.startViewTransition(swap).finished.finally(() => delete root.dataset.vt)
}
$('#theme').onclick = toggleTheme
$('#drtheme').onclick = toggleTheme
const drawer = (open) => {
  const dr = $('#dr'), btn = $('#mbtn')
  if (open === dr.classList.contains('open')) return
  root.style.setProperty('--navh', $('.nav').offsetHeight + 'px')
  dr.classList.toggle('open', open); $('#drbd').classList.toggle('open', open); btn.classList.toggle('open', open)
  btn.setAttribute('aria-expanded', open); btn.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu')
  dr.setAttribute('aria-hidden', !open); dr.inert = !open
  root.classList.toggle('dr-lock', open)
}
$('#mbtn').onclick = () => drawer(!$('#dr').classList.contains('open'))
$('#drbd').onclick = () => drawer(false)
$('#dr').addEventListener('click', (e) => { if (e.target.closest('.dr-nav a')) drawer(false) })
addEventListener('keydown', (e) => { if (e.key === 'Escape') drawer(false) })
addEventListener('resize', () => { if (innerWidth > 760) drawer(false) })
{ let x0 = 0, y0 = 0   /* geser ke kiri untuk menutup */
  $('#dr').addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY }, { passive: true })
  $('#dr').addEventListener('touchend', (e) => { const t = e.changedTouches[0]; if (t.clientX - x0 < -55 && Math.abs(t.clientY - y0) < 70) drawer(false) }, { passive: true }) }

/* CSS drawer ikut di file ini supaya tidak bergantung pada site.css yang bisa ter-cache versi lama */
{
  const st = document.createElement('style'); st.id = 'dr-css'
  st.textContent = `
.nav{z-index:60}
.mbtn .burger{width:19px;height:19px;transition:transform .55s var(--ease,cubic-bezier(.22,1,.36,1))}
.burger path{transform-box:fill-box;transform-origin:center;transition:transform .5s var(--ease,cubic-bezier(.22,1,.36,1)),opacity .25s}
.mbtn.open .burger{transform:rotate(180deg)}
.mbtn.open .b1{transform:translateY(6px) rotate(45deg) scaleX(.9)}
.mbtn.open .b2{opacity:0;transform:scaleX(.2)}
.mbtn.open .b3{transform:translateY(-6px) rotate(-45deg) scaleX(.9)}
.dr,.dr-bd{display:none}
@media(max-width:760px){
html.dr-lock{overflow:hidden}
.dr-bd{display:block;position:fixed;left:0;right:0;bottom:0;top:var(--navh,53px);z-index:49;background:rgba(0,0,0,.38);opacity:0;visibility:hidden;transition:opacity .45s var(--ease,ease),visibility 0s .45s}
.dr-bd.open{opacity:1;visibility:visible;transition:opacity .45s var(--ease,ease),visibility 0s}
.dr{display:flex;flex-direction:column;position:fixed;left:0;top:var(--navh,53px);bottom:0;width:min(68vw,268px);z-index:50;background:color-mix(in srgb,var(--bg,#0d1016) 52%,transparent);-webkit-backdrop-filter:saturate(1.8) blur(24px);backdrop-filter:saturate(1.8) blur(24px);color:var(--tx,#e8ecf3);border-right:1px solid var(--line,#242b38);border-radius:0 20px 20px 0;overscroll-behavior:contain;transform:translate3d(-102%,0,0);visibility:hidden;transition:transform .55s cubic-bezier(.32,.72,0,1),visibility 0s .55s,box-shadow .55s}
.dr.open{transform:none;visibility:visible;box-shadow:18px 0 50px -26px #000c;transition:transform .55s cubic-bezier(.32,.72,0,1),visibility 0s,box-shadow .55s}
.dr-nav{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;padding:8px 8px 4px}
.dr-g,.dr-loose>*{opacity:0;transform:translate3d(-14px,0,0);transition:transform .5s var(--ease,ease),opacity .35s}
.dr.open .dr-g,.dr.open .dr-loose>*{opacity:1;transform:none;transition-delay:calc(var(--i,0)*45ms + 90ms),calc(var(--i,0)*45ms + 90ms)}
.dr-gh{display:flex;align-items:center;gap:10px;width:100%;padding:9px 8px;border:0;background:none;color:var(--tx,#e8ecf3);font:700 14px/1.2 inherit;font-family:inherit;cursor:pointer;text-align:left;border-radius:10px;-webkit-tap-highlight-color:transparent}
.dr-gh>span:nth-child(2){flex:1}
.dr-gic{width:20px;height:20px;display:grid;place-items:center;flex:none}
.dr-gh svg{width:16px;height:16px;fill:none;stroke:var(--mut,#8b95a7);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;flex:none;transition:transform .35s var(--ease,ease)}
.dr-gic svg{width:18px;height:18px;stroke:currentColor}
.dr-g:not(.open) .dr-gh>svg:last-child{transform:rotate(180deg)}
.dr-gb{display:grid;grid-template-rows:0fr;transition:grid-template-rows .4s var(--ease,ease)}
.dr-g.open .dr-gb{grid-template-rows:1fr}
.dr-gl{overflow:hidden;min-height:0;padding:0 0 0 12px}
.dr-it{position:relative;display:flex;align-items:center;gap:10px;margin-top:2px;padding:0 8px;height:38px;border-radius:11px;border:1px solid transparent;color:var(--mut,#8b95a7);font-weight:600;font-size:13.5px;text-decoration:none;-webkit-tap-highlight-color:transparent;transition:background-color .2s,color .2s,border-color .2s}
.dr-it:first-child{margin-top:0}
.dr-it::after{content:"";position:absolute;left:36px;right:0;bottom:-1.5px;height:1px;background:var(--line,#242b38);transform:scaleY(.5);transform-origin:bottom;pointer-events:none}
.dr-it:last-child::after,.dr-it.on::after,.dr-it:has(+ .dr-it.on)::after{opacity:0}
.dr-it:active{background:color-mix(in srgb,var(--mut,#8b95a7) 14%,transparent)}
.dr-it.on{color:var(--tx,#e8ecf3);background:color-mix(in srgb,var(--tx,#e8ecf3) 7%,transparent);border-color:color-mix(in srgb,var(--tx,#e8ecf3) 14%,transparent)}
.dr-ic{width:20px;height:20px;display:grid;place-items:center;flex:none}
.dr-ic svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.dr-it>span:nth-child(2){flex:1;min-width:0;white-space:nowrap}
.dr-it>svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;flex:none;opacity:0;transform:scale(.6);transition:opacity .25s,transform .35s var(--ease,ease)}
.dr-it.on>svg{opacity:1;transform:none}
.dr-hr{border:0;height:1px;margin:8px 8px 6px;background:var(--line,#242b38);transform:scaleY(.5);flex:none}
.dr-loose{display:flex;flex-direction:column}
.dr-loose .dr-it{height:40px;margin-top:0;padding:0 8px}
.dr-loose .dr-it::after{left:36px}
.dr-loose .dr-it .dr-ic svg{width:19px;height:19px}
.dr-card{margin:6px 8px calc(10px + env(safe-area-inset-bottom,0px));border:1px solid var(--line,#242b38);border-radius:16px;padding:0 12px;background:color-mix(in srgb,var(--tx,#e8ecf3) 3%,transparent);opacity:0;transform:translate3d(0,12px,0);transition:transform .55s var(--ease,ease) .2s,opacity .4s .2s}
.dr.open .dr-card{opacity:1;transform:none}
.dr-row{position:relative;display:flex;align-items:center;gap:10px;padding:9px 0;font-size:13px;font-weight:600;color:var(--tx,#e8ecf3);text-decoration:none}
.dr-row+.dr-row::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--line,#242b38);transform:scaleY(.5);transform-origin:top}
.dr-soc::before{left:42px!important}
.dr-row>span:first-child:not(.dr-sic){flex:1}
.dr-sw{display:flex;align-items:center;gap:8px;border:0;background:none;color:inherit;font:inherit;cursor:pointer;padding:0}
.dr-sw i{position:relative;width:40px;height:24px;border-radius:99px;background:color-mix(in srgb,var(--mut,#8b95a7) 35%,transparent);transition:background-color .3s;flex:none}
.dr-sw i::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px #0006;transition:transform .45s cubic-bezier(.34,1.5,.64,1)}
.dr-sw[aria-checked=true] i{background:var(--ac,#7c8cff)}.dr-sw[aria-checked=true] i::after{transform:translateX(16px)}
.dr-sw b{min-width:34px;text-align:left;font-style:italic;font-size:13px}
.dr-sic{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;flex:none;color:#fff}.dr-sic svg{width:17px;height:17px}
.dr-sic.wa{background:#25d366}.dr-sic.ig{background:linear-gradient(45deg,#f9ce34,#ee2a7b 55%,#6228d7)}
.dr-st{flex:1;min-width:0;display:grid;line-height:1.25}.dr-st b{font-size:13px}.dr-st small{color:var(--mut,#8b95a7);font-weight:500;font-size:11.5px}
.dr-soc>svg{width:15px;height:15px;fill:none;stroke:var(--mut,#8b95a7);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
}
@media(prefers-reduced-motion:reduce){.dr,.dr-bd,.dr-g,.dr-loose>*,.dr-gb,.dr-it,.dr-card,.burger,.burger path{transition-duration:.01s!important;transition-delay:0s!important}}`
  document.head.append(st)
}
document.querySelectorAll('.links a').forEach((a) => { if (a.pathname === location.pathname && !a.hash) a.classList.add('on') })
syncTheme()

/* item drawer yang sesuai halaman aktif diberi kotak + centang; grup bisa dilipat */
const drNorm = (p) => p.replace(/\.html$/, '').replace(/\/$/, '') || '/'
const drActive = () => {
  const links = [...document.querySelectorAll('#drnav a.dr-it')].map((a) => ({ a, u: new URL(a.href) }))
  const hashes = links.map(({ u }) => u.hash).filter(Boolean)
  links.forEach(({ a, u }) => {
    const on = drNorm(u.pathname) === drNorm(location.pathname) && (u.hash ? u.hash === location.hash : !hashes.includes(location.hash))
    a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')
  })
}
addEventListener('hashchange', drActive)
document.querySelectorAll('.dr-g').forEach((g) => {
  const h = g.querySelector('.dr-gh'), b = g.querySelector('.dr-gb')
  h.onclick = () => { const o = !g.classList.contains('open'); g.classList.toggle('open', o); h.setAttribute('aria-expanded', o); b.inert = !o }
})
drActive()

const ready = Promise.all([
  api('/auth/me').catch(() => null),
  api('/billing/whoami').catch(() => ({ ip: '-', is_owner: false })),
]).then(([user, who]) => {
  $('#navr').innerHTML = (who.is_admin || who.is_owner ? `<a class="nb adm" href="/admin.html" title="Admin" aria-label="Admin">${ni('shield')}</a>` : '') +
    (user ? `<a class="nb" href="/profile.html" title="${esc(user.username)}" aria-label="Profil ${esc(user.username)}">${ni('user')}</a>` : '<a class="btn" href="/login.html">Masuk</a>')
  const loose = (h, t, ic, i) => `<a class="dr-it" href="${h}" style="--i:${i}"><span class="dr-ic">${ni(ic)}</span><span>${t}</span>${ni('check')}</a>`
  $('#drme').innerHTML = (who.is_admin || who.is_owner ? loose('/admin.html', 'Admin', 'shield', 6) : '') +
    (user ? loose('/profile.html', 'Profil', 'user', 7) : loose('/login.html', 'Masuk', 'login', 7))
  drActive()
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


/* ---------- sentuhan: efek cincin di titik tap/klik, di semua halaman ---------- */
if (!matchMedia('(prefers-reduced-motion:reduce)').matches) {
  const layer = document.createElement('div'); layer.className = 'tap-layer'; layer.setAttribute('aria-hidden', 'true'); document.body.append(layer)
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    /* dialog modal berada di top layer di atas segalanya, jadi efeknya ditaruh di dalam dialog yang sedang terbuka */
    const dlg = document.querySelector('dialog[open]')
    const t = document.createElement('i'); t.className = 'tap'
    if (dlg && dlg.contains(e.target)) { const r = dlg.getBoundingClientRect(); t.style.left = e.clientX - r.left + dlg.scrollLeft + 'px'; t.style.top = e.clientY - r.top + dlg.scrollTop + 'px'; dlg.append(t) }
    else { t.style.left = e.clientX + 'px'; t.style.top = e.clientY + 'px'; layer.append(t) }
    setTimeout(() => t.remove(), 800)
  }, { passive: true, capture: true })
}

/* hitung kunjungan halaman (sekali per sesi tab) untuk "Page Views" di Dashboard */
try { if (!sessionStorage.getItem('pv')) { sessionStorage.setItem('pv', '1'); fetch('/api/pv', { method: 'POST', keepalive: true }).catch(() => {}) } } catch {}
