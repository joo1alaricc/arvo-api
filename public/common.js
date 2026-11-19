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
/* Versi animasi untuk header: A + R dipecah dua path supaya digambar bergantian (garis -> terisi -> berkilau -> ulang) */
const LOGO_AN = `<svg viewBox="-4 -4 108 78.9" aria-hidden="true"><defs><clipPath id="lgc"><path d="${LOGO_PATH.split('ZM')[0]}Z"/><path d="M${LOGO_PATH.split('ZM')[1]}"/></clipPath></defs><path class="lg-p a" pathLength="1" d="${LOGO_PATH.split('ZM')[0]}Z"/><path class="lg-p r" pathLength="1" d="M${LOGO_PATH.split('ZM')[1]}"/><g clip-path="url(#lgc)"><rect class="lg-s" x="0" y="-10" width="16" height="92"/></g></svg>`
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
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  home: '<path d="m3 10.5 9-7.5 9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>', compass: '<circle cx="12" cy="12" r="10"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5z"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>', grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', up: '<path d="m6 15 6-6 6 6"/>',
  tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>', bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', msg: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>', trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
}
Object.assign(NI, {
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  userc: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19.5 8v6M16.5 11h6"/>',
  shieldk: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="10" r="1.6"/><path d="M12 11.6V15"/>',
  bars: '<path d="M4 20v-6M10 20V9M16 20V4M22 20H2"/>',
  star: '<path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>',
  palette: '<circle cx="12" cy="12" r="10"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10.5" cy="7" r="1" fill="currentColor"/><circle cx="15.5" cy="7.5" r="1" fill="currentColor"/><path d="M12 22a2.5 2.5 0 0 1-.6-4.9c1-.3 1.6-1.2 1.4-2.1-.2-1 .6-2 1.7-2H18a4 4 0 0 0 4-4"/>',
})
const ni = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${NI[n]}</svg>`
const DR_GROUPS = [   /* [judul grup, ikon, [[href, label, ikon], ...]] */
  ['Utama', 'compass', [['/', 'Beranda', 'home'], ['/dashboard.html', 'Dashboard', 'grid'], ['/#paket', 'Paket', 'bag'], ['/#cara', 'Cara kerja', 'list'], ['/#faq', 'FAQ', 'help']]],
  ['Developer', 'code', [['/playground.html', 'Playground', 'play']]],
  ['Tools', 'tool', [['/am', 'Aktivasi AM', 'bolt'], ['/smm', 'Layanan SMM', 'trend'], ['/otp', 'Layanan OTP', 'msg']]],
]
const LINKS = [['/dashboard.html', 'Dashboard', 'grid'], ['/#paket', 'Paket', 'bag'], ['/#cara', 'Cara kerja', 'list'], ['/playground.html', 'Playground', 'play'], ['/am', 'Aktivasi AM', 'bolt'], ['/smm', 'Layanan SMM', 'trend'], ['/otp', 'Layanan OTP', 'msg'], ['/#faq', 'FAQ', 'help']]

/* header & footer dipakai semua halaman */
document.body.insertAdjacentHTML('afterbegin', `<header class="nav"><div class="wrap nav-in">
  <button id="mbtn" class="nb mbtn" aria-label="Buka menu" aria-expanded="false" aria-controls="dr"><svg viewBox="0 0 24 24" class="burger" aria-hidden="true"><path class="b1" d="M4 6h16"/><path class="b2" d="M4 12h16"/><path class="b3" d="M4 18h16"/></svg></button>
  <a class="brand" href="/"><span class="logo logo-an">${LOGO_AN}</span>Arvo</a>
  <nav class="links">${LINKS.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</nav>
  <span class="sp"></span>
  <span id="navr" class="navr"></span>
  <button id="theme" class="nb" aria-label="Ganti tema"></button></div></header>`)
/* ---------- footer: brand, deskripsi, ikon sosial, kolom tautan. Isinya diatur admin (Admin > Konten Dashboard > Footer) ---------- */
const TG_PATH = 'M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z'
const ftIcon = (name, url) => {
  const k = (name + ' ' + url).toLowerCase()
  if (/whatsapp|wa\.me/.test(k)) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${WA_PATH}"/></svg>`
  if (/instagram/.test(k)) return `<svg viewBox="0 0 24 24" aria-hidden="true">${IG_SHAPES}</svg>`
  if (/telegram|t\.me/.test(k)) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${TG_PATH}"/></svg>`
  return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>'
}
const ftHref = (v) => { const ext = /^https?:\/\//i.test(v) && new URL(v).origin !== location.origin; return `href="${esc(v)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}` }
const drawFooter = (f) => {
  const el = $('#ftmain'); if (!el) return
  const groups = (f.groups || []).filter((g) => g.links && g.links.length)
  el.innerHTML = `<div class="ft-brand"><a class="brand" href="/"><span class="logo"><svg viewBox="-4 -4 108 78.9" aria-hidden="true"><path fill="#fff" d="${LOGO_PATH}"/></svg></span>Arvo</a>
      ${f.desc ? `<p>${esc(f.desc)}</p>` : ''}
      ${(f.social || []).length ? `<div class="ft-soc">${f.social.map((x) => `<a class="ft-ic" ${ftHref(x.value)} title="${esc(x.name)}" aria-label="${esc(x.name)}">${ftIcon(x.name, x.value)}</a>`).join('')}</div>` : ''}</div>
    ${groups.map((g) => `<nav class="ft-col" aria-label="${esc(g.title)}"><h4>${esc(g.title)}</h4>${g.links.map((x) => `<a ${ftHref(x.value)}>${esc(x.name)}</a>`).join('')}</nav>`).join('')}`
}
if (!/^\/admin/.test(location.pathname)) {
  const st = document.createElement('style'); st.id = 'ft-css'
  st.textContent = `.ft{border-top:1px solid var(--line);margin-top:40px;padding:36px 0 0;color:var(--mut);font-size:14px}
.ft-main{display:grid;gap:30px;grid-template-columns:1.6fr 1fr 1fr}
.ft-brand .brand{display:inline-flex;align-items:center;gap:12px;font-size:19px;color:var(--tx)}
.ft-brand .logo{width:36px;height:36px;border-radius:10px}.ft-brand .logo svg{width:70%}
.ft-brand p{margin:14px 0 0;max-width:420px;line-height:1.7}
.ft-soc{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}
.ft-ic{width:44px;height:44px;border:1px solid var(--line);border-radius:12px;display:grid;place-items:center;color:var(--mut);transition:color .2s,border-color .2s,background-color .2s,transform .2s}
.ft-ic svg{width:21px;height:21px}
.ft-ic:hover{color:var(--tx);border-color:color-mix(in srgb,var(--ac) 55%,var(--line));background:color-mix(in srgb,var(--ac) 8%,transparent)}.ft-ic:active{transform:scale(.92)}
.ft-col h4{margin:0 0 14px;font-size:15px;color:var(--tx)}
.ft-col a{display:block;padding:7px 0;color:var(--mut);transition:color .2s}.ft-col a:hover{color:var(--tx)}
.ft-copy{border-top:1px solid var(--line);margin-top:30px;padding:20px 0 24px;text-align:center;display:grid;gap:6px;font-size:13px}
.ft-copy small{font-size:12.5px;opacity:.85}
@media(max-width:760px){.ft-main{grid-template-columns:1fr;gap:26px}.ft-col a{padding:9px 0}}`
  document.head.append(st)
  document.body.insertAdjacentHTML('beforeend', `<footer class="ft"><div class="wrap"><div class="ft-main" id="ftmain"></div>
    <div class="ft-copy"><span>© ${new Date().getFullYear()} Arvo. All rights reserved.</span><small>Powered by Arvo</small></div></div></footer>`)
  drawFooter({ desc: '', social: [], groups: [] })
  api('/site-content').then((d) => d.footer && drawFooter(d.footer)).catch(() => {})
} else document.body.insertAdjacentHTML('beforeend', `<footer><div class="wrap foot"><b>Arvo</b><span>© 2026 · <a href="/playground.html">Playground</a></span></div></footer>`)
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
  const pw = $('#pmtheme'); if (pw) { pw.setAttribute('aria-checked', dark); pw.querySelector('b').textContent = dark ? 'Gelap' : 'Terang' }
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
.dr-bd{display:block;position:fixed;left:0;right:0;bottom:0;top:var(--navh,53px);z-index:49;background:rgba(0,0,0,.38);opacity:0;visibility:hidden;transition:opacity .6s var(--ease,ease),visibility 0s .6s}
.dr-bd.open{opacity:1;visibility:visible;transition:opacity .6s var(--ease,ease),visibility 0s}
.dr{display:flex;flex-direction:column;position:fixed;left:0;top:var(--navh,53px);bottom:0;width:min(68vw,268px);z-index:50;background:color-mix(in srgb,var(--bg,#0d1016) 52%,transparent);-webkit-backdrop-filter:saturate(1.8) blur(24px);backdrop-filter:saturate(1.8) blur(24px);color:var(--tx,#e8ecf3);border-right:1px solid var(--line,#242b38);border-radius:0;overscroll-behavior:contain;transform:translate3d(-102%,0,0);visibility:hidden;transition:transform .75s cubic-bezier(.22,.8,.24,1),visibility 0s .75s,box-shadow .75s}
.dr.open{transform:none;visibility:visible;box-shadow:18px 0 50px -26px #000c;transition:transform .75s cubic-bezier(.22,.8,.24,1),visibility 0s,box-shadow .75s}
.dr-nav{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;padding:8px 8px 4px}
.dr-g{padding:0}.dr-g+.dr-g{margin-top:2px}
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
.dr-out{width:100%;background:none;font-family:inherit;text-align:left;cursor:pointer;color:#ef4444}
.dr-out .dr-ic svg{stroke:#ef4444}.dr-out:active{background:color-mix(in srgb,#ef4444 14%,transparent)}
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

/* layanan yang dimatikan admin (Admin > Layanan) disembunyikan dari menu atas & sidebar. Status terakhir disimpan supaya tidak berkedip. */
const SVC_PATH = { '/smm': 'smm', '/otp': 'otp', '/am': 'am' }
const applySvc = (cfg) => {
  if (!cfg) return
  document.querySelectorAll('.links a, #drnav a.dr-it').forEach((a) => {
    const k = SVC_PATH[drNorm(new URL(a.href).pathname)]
    if (k) a.style.display = cfg[k] === false ? 'none' : ''
  })
  document.querySelectorAll('.dr-g').forEach((g) => { const its = [...g.querySelectorAll('.dr-it')]; g.style.display = its.length && its.every((a) => a.style.display === 'none') ? 'none' : '' })
}
try { applySvc(JSON.parse(localStorage.getItem('svc'))) } catch {}
api('/services').then((c) => { try { localStorage.setItem('svc', JSON.stringify(c)) } catch {} ; applySvc(c) }).catch(() => {})

/* ---------- menu profil (klik foto profil di bar atas): kartu identitas + daftar menu, gaya Zireku ---------- */
const pmAvatar = (u) => `<span class="pm-av">${u.avatar_url ? `<img src="${esc(u.avatar_url)}" alt="" draggable="false">` : ''}<i>${esc((u.username || '?')[0].toUpperCase())}</i></span>`
const initProfileMenu = (user, who, doLogout) => {
  const st = document.createElement('style'); st.id = 'pm-css'
  st.textContent = `
.pm-btn{padding:0;border-radius:50%;overflow:hidden}
.pm-av{position:relative;display:grid;place-items:center;width:100%;height:100%;border-radius:50%;overflow:hidden;background:color-mix(in srgb,var(--tx) 10%,transparent);color:var(--tx);font-weight:800;font-size:.9em}
.pm-av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.pm-av i{font-style:normal}.pm-av img+i{visibility:hidden}.pm-av.no-img img{display:none}.pm-av.no-img i{visibility:visible}
.pm-bd{position:fixed;inset:0;z-index:69;display:none}.pm-bd.open{display:block}
.pm{position:fixed;z-index:70;top:calc(var(--navh,53px) + 8px);right:12px;width:min(340px,calc(100vw - 24px));max-height:calc(100dvh - var(--navh,53px) - 20px);overflow:auto;overscroll-behavior:contain;background:var(--card);color:var(--tx);border:1px solid var(--line);border-radius:18px;box-shadow:0 24px 60px -22px #000c;opacity:0;visibility:hidden;transform:translate3d(0,-8px,0) scale(.97);transform-origin:top right;transition:opacity .22s,transform .35s var(--ease),visibility 0s .35s}
.pm.open{opacity:1;visibility:visible;transform:none;transition:opacity .22s,transform .35s var(--ease),visibility 0s}
.pm-h{display:flex;align-items:center;gap:14px;padding:18px 16px 16px;position:relative}
.pm-h .pm-av{width:60px;height:60px;flex:none;font-size:24px;border:1px solid var(--line)}
.pm-id{min-width:0;flex:1;display:grid;gap:2px;line-height:1.3}
.pm-id b{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pm-id span{color:var(--mut);font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pm-on{display:inline-flex;align-items:center;gap:7px;color:var(--tx)!important;font-size:13px!important;margin-top:3px}
.pm-on::before{content:"";width:8px;height:8px;border-radius:50%;background:#34d081;box-shadow:0 0 0 3px color-mix(in srgb,#34d081 22%,transparent)}
.pm-plan{align-self:flex-end;flex:none;display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border:1px solid var(--line);border-radius:9px;font-size:12px;font-weight:800;letter-spacing:.04em;color:var(--mut);background:color-mix(in srgb,var(--tx) 4%,transparent)}
.pm-plan svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.pm-sec{border-top:1px solid var(--line);padding:6px 0}
.pm-it{display:flex;align-items:center;gap:14px;width:100%;padding:11px 16px;border:0;background:none;color:var(--tx);font:inherit;text-align:left;text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color .2s}
.pm-it:hover,.pm-it:focus-visible{background:color-mix(in srgb,var(--tx) 6%,transparent);outline:0}.pm-it:active{background:color-mix(in srgb,var(--tx) 10%,transparent)}
.pm-ic{width:22px;height:22px;display:grid;place-items:center;flex:none;color:var(--mut)}
.pm-ic svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.pm-tx{display:grid;gap:1px;line-height:1.3;min-width:0;flex:1}.pm-tx b{font-size:15.5px;font-weight:600}.pm-tx small{color:var(--mut);font-size:13.5px}
.pm-sw{display:flex;align-items:center;gap:9px;border:0;background:none;color:inherit;font:inherit;cursor:pointer;padding:0}
.pm-sw i{position:relative;width:44px;height:26px;border-radius:99px;background:color-mix(in srgb,var(--mut) 35%,transparent);transition:background-color .3s;flex:none}
.pm-sw i::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px #0006;transition:transform .45s cubic-bezier(.34,1.5,.64,1)}
.pm-sw[aria-checked=true] i{background:var(--tx)}.pm-sw[aria-checked=true] i::after{transform:translateX(18px);background:var(--bg)}
.pm-sw b{min-width:42px;text-align:left;font-style:italic;font-weight:800;font-size:15px}
.pm-it.out,.pm-it.out .pm-ic{color:#ef4444}.pm-it.out .pm-tx b{font-weight:600}.pm-it.out:hover{background:color-mix(in srgb,#ef4444 10%,transparent)}
@media(prefers-reduced-motion:reduce){.pm{transition-duration:.01s!important}}`
  document.head.append(st)
  const it = (h, ic, t, sub) => `<a class="pm-it" role="menuitem" href="${h}"><span class="pm-ic">${ni(ic)}</span><span class="pm-tx"><b>${t}</b><small>${sub}</small></span></a>`
  const plan = user.active ? String(user.role || user.plan_name || 'Premium').toUpperCase() : 'FREE'
  const dark = root.dataset.theme === 'dark'
  document.body.insertAdjacentHTML('beforeend', `<div class="pm-bd" id="pmbd"></div>
<div class="pm" id="pm" role="menu" aria-label="Menu profil" aria-hidden="true" inert>
  <div class="pm-h">${pmAvatar(user)}
    <div class="pm-id"><b>${esc(user.username)}</b><span>@${esc(user.username)}</span><span class="pm-on">Online</span></div>
    <span class="pm-plan">${ni('star')}${esc(plan)}</span></div>
  <div class="pm-sec">
    ${it('/profile.html', 'userc', 'Profil &amp; Kredensial', 'Ubah profil, foto &amp; keamanan')}
    ${it('/profile.html#settings', 'cog', 'Pengaturan Akun', 'Atur preferensi akun')}
    ${it('/profile.html#settings', 'shieldk', 'Keamanan', 'Whitelist IP &amp; access key')}
  </div>
  <div class="pm-sec">
    ${it('/dashboard.html', 'bars', 'Dashboard', 'Lihat statistik')}
    ${it('/#paket', 'star', 'Kelola Paket', 'Kelola langganan &amp; kuota harian')}
    ${who.is_admin ? it('/admin.html', 'shield', 'Admin', 'Panel pengelola') : ''}
    <div class="pm-it" role="none"><span class="pm-ic">${ni('palette')}</span><span class="pm-tx"><b>Tema</b></span>
      <button type="button" class="pm-sw" id="pmtheme" role="switch" aria-checked="${dark}" aria-label="Mode gelap"><i></i><b>${dark ? 'Gelap' : 'Terang'}</b></button></div>
  </div>
  <div class="pm-sec"><button type="button" class="pm-it out" id="pmout" role="menuitem"><span class="pm-ic">${ni('logout')}</span><span class="pm-tx"><b>Keluar</b></span></button></div>
</div>`)
  document.querySelectorAll('.pm-av img').forEach((im) => { const f = () => im.parentElement.classList.add('no-img'); im.addEventListener('error', f); if (im.complete && !im.naturalWidth) f() })
  const pm = $('#pm'), bd = $('#pmbd'), btn = $('#pmbtn')
  const open = (o) => {
    if (o === pm.classList.contains('open')) return
    if (o) { drawer(false); root.style.setProperty('--navh', $('.nav').offsetHeight + 'px') }
    pm.classList.toggle('open', o); bd.classList.toggle('open', o)
    btn.setAttribute('aria-expanded', o); pm.setAttribute('aria-hidden', !o); pm.inert = !o
  }
  btn.onclick = () => open(!pm.classList.contains('open'))
  bd.onclick = () => open(false)
  pm.addEventListener('click', (e) => { if (e.target.closest('a.pm-it')) open(false) })
  $('#pmtheme').onclick = toggleTheme
  $('#pmout').onclick = (e) => doLogout(e.currentTarget)
  addEventListener('keydown', (e) => { if (e.key === 'Escape') open(false) })
  addEventListener('resize', () => open(false))
  $('#mbtn').addEventListener('click', () => open(false))
}

const ready = Promise.all([
  api('/auth/me').catch(() => null),
  api('/billing/whoami').catch(() => ({ ip: '-', is_owner: false })),
]).then(([user, who]) => {
  $('#navr').innerHTML = (who.is_admin ? `<a class="nb adm" href="/admin.html" title="Admin" aria-label="Admin">${ni('shield')}</a>` : '') +
    (user ? `<button type="button" class="nb pm-btn" id="pmbtn" title="${esc(user.username)}" aria-label="Menu profil ${esc(user.username)}" aria-haspopup="menu" aria-expanded="false" aria-controls="pm">${pmAvatar(user)}</button>` : '<a class="btn" href="/login.html">Masuk</a>')
  const loose = (h, t, ic, i) => `<a class="dr-it" href="${h}" style="--i:${i}"><span class="dr-ic">${ni(ic)}</span><span>${t}</span>${ni('check')}</a>`
  $('#drme').innerHTML = (who.is_admin ? loose('/admin.html', 'Admin', 'shield', 6) : '') +
    (user ? `<button type="button" class="dr-it dr-out" id="drout" style="--i:7"><span class="dr-ic">${ni('logout')}</span><span>Keluar</span></button>` : loose('/login.html', 'Masuk', 'login', 7))
  const doLogout = async (b) => { b.disabled = true; try { await api('/auth/logout', { method: 'POST', body: '{}' }) } catch {} ; location.href = '/' }
  const out = $('#drout'); if (out) out.onclick = () => doLogout(out)
  if (user) initProfileMenu(user, who, doLogout)
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


/* ---- Dropdown kustom: menggantikan tampilan <select> bawaan browser dengan menu bergaya situs.
 * <select> asli tetap ada (tersembunyi) sebagai sumber nilai, jadi kode lain (.value, onchange) tidak berubah.
 * Pilihan di-opt-out dengan atribut data-native. Select yang muncul belakangan (modal, render ulang) ikut ditangani. ---- */
(() => {
  const CH = '<svg class="sel-c" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
  const CK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
  let menu = null, cur = null, curBtn = null, off = []
  const close = (instant) => {
    if (!menu) return
    const m = menu; menu = null
    off.forEach((f) => f()); off = []
    if (curBtn) { curBtn.classList.remove('open'); curBtn.setAttribute('aria-expanded', 'false') }
    cur = curBtn = null
    if (instant) return m.remove()
    m.classList.remove('in'); m.classList.add('out'); setTimeout(() => m.remove(), 200)
  }
  const open = (s, b) => {
    close(true)
    const m = document.createElement('div'); m.className = 'sel-m'; m.setAttribute('role', 'listbox')
    m.innerHTML = [...s.options].map((o, i) => `<button type="button" role="option" class="sel-o${i === s.selectedIndex ? ' on' : ''}" data-i="${i}" aria-selected="${i === s.selectedIndex}"${o.disabled ? ' disabled' : ''}><span>${esc(o.textContent)}</span>${CK}</button>`).join('')
    ;(b.closest('dialog') || document.body).append(m)
    const r = b.getBoundingClientRect(), w = Math.max(r.width, 170), mh = Math.min(m.scrollHeight, innerHeight * 0.5, 360)
    const below = innerHeight - r.bottom - 12, up = below < mh && r.top > below
    m.style.width = Math.min(w, innerWidth - 16) + 'px'
    m.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px'
    m.style.top = (up ? Math.max(8, r.top - mh - 6) : r.bottom + 6) + 'px'
    if (up) m.dataset.o = 'up'
    m.style.maxHeight = Math.max(120, up ? r.top - 14 : below) + 'px'
    requestAnimationFrame(() => m.classList.add('in'))
    b.classList.add('open'); b.setAttribute('aria-expanded', 'true'); menu = m; cur = s; curBtn = b
    const on = m.querySelector('.on') || m.firstElementChild; if (on) { m.scrollTop = Math.max(0, on.offsetTop - m.clientHeight / 2 + on.offsetHeight / 2); setTimeout(() => on.focus({ preventScroll: true }), 30) }
    m.onclick = (e) => {
      const o = e.target.closest('.sel-o'); if (!o || o.disabled) return
      s.selectedIndex = +o.dataset.i; s._sync()
      s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }))
      const btn = b; close(); btn.focus({ preventScroll: true })
    }
    m.onkeydown = (e) => {
      const it = [...m.querySelectorAll('.sel-o:not(:disabled)')], i = it.indexOf(document.activeElement)
      if (e.key === 'ArrowDown') { e.preventDefault(); it[Math.min(it.length - 1, i + 1)]?.focus() }
      else if (e.key === 'ArrowUp') { e.preventDefault(); it[Math.max(0, i - 1)]?.focus() }
      else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); const btn = b; close(); btn.focus() }
    }
    const down = (e) => { if (!m.contains(e.target) && !b.contains(e.target)) close() }
    const t0 = performance.now(), scr = (e) => { if (performance.now() - t0 > 500 && !m.contains(e.target)) close() }
    const rs = () => close(true)
    document.addEventListener('pointerdown', down, true); addEventListener('scroll', scr, true); addEventListener('resize', rs)
    off = [() => document.removeEventListener('pointerdown', down, true), () => removeEventListener('scroll', scr, true), () => removeEventListener('resize', rs)]
  }
  const enhance = (s) => {
    if (s._sel || s.multiple || s.size > 1 || s.hasAttribute('data-native')) return
    s._sel = true
    const w = document.createElement('span'); w.className = 'sel-w'
    for (const k of ['width', 'flex', 'minWidth', 'maxWidth', 'margin', 'marginTop']) if (s.style[k]) w.style[k] = s.style[k]
    s.before(w)
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sel-btn'
    b.setAttribute('aria-haspopup', 'listbox'); b.setAttribute('aria-expanded', 'false')
    const al = s.getAttribute('aria-label'); if (al) b.setAttribute('aria-label', al)
    b.innerHTML = `<span class="sel-t"></span>${CH}`
    w.append(b, s); s.tabIndex = -1; s.setAttribute('aria-hidden', 'true')
    const sync = () => { const o = s.options[s.selectedIndex]; b.firstChild.textContent = o ? o.textContent : 'Pilih'; b.disabled = s.disabled }
    s._sync = sync
    const d = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')
    Object.defineProperty(s, 'value', { get() { return d.get.call(this) }, set(v) { d.set.call(this, v); sync() }, configurable: true })
    s.addEventListener('change', sync)
    new MutationObserver(sync).observe(s, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled'] })
    b.onclick = () => (cur === s ? close() : open(s, b))
    sync()
  }
  const scan = (n) => { if (n.nodeType !== 1) return; if (n.tagName === 'SELECT') enhance(n); else n.querySelectorAll && n.querySelectorAll('select').forEach(enhance) }
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(scan))).observe(document.documentElement, { childList: true, subtree: true })
  scan(document.documentElement)
})()


/* ---------- jendela mengambang (dialog) berkaca blur, sama seperti bar atas & drawer ---------- */
{
  const st = document.createElement('style'); st.id = 'glass-css'
  st.textContent = `
dialog{background:color-mix(in srgb,var(--card) 58%,transparent);-webkit-backdrop-filter:saturate(1.8) blur(24px);backdrop-filter:saturate(1.8) blur(24px);border-color:color-mix(in srgb,var(--tx) 14%,var(--line));box-shadow:0 24px 70px -28px #000c}
dialog[open]::backdrop{background:#0006;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.sel-m{background:color-mix(in srgb,var(--card) 62%,transparent)!important;-webkit-backdrop-filter:saturate(1.8) blur(24px)!important;backdrop-filter:saturate(1.8) blur(24px)!important}`
  document.head.append(st)
}

/* ---------- order belum dikonfirmasi admin: tombol melayang ala AssistiveTouch iOS (bisa digeser, menempel ke tepi layar); diketuk -> kartu status mengembang ---------- */
{
  const st = document.createElement('style'); st.id = 'hang-css'
  /* Wrapper .hang TIDAK boleh beranimasi opacity/filter: itu membuat "backdrop root" dan memutus blur anak-anaknya. Opacity hanya dipasang di elemen yang punya blur itu sendiri. */
  st.textContent = `
.hang{--S:48px;position:fixed;left:0;top:0;z-index:45;width:var(--S);height:var(--S);pointer-events:none;transform:translate3d(var(--hx,0px),var(--hy,0px),0)}
.hang.snap{transition:transform .75s var(--ease-soft,cubic-bezier(.22,.8,.24,1))}
.hang-bt{pointer-events:auto;position:relative;display:grid;place-items:center;width:var(--S);height:var(--S);padding:0;border-radius:50%;border:1px solid color-mix(in srgb,var(--tx) 16%,var(--line));background:color-mix(in srgb,var(--card) 62%,transparent);-webkit-backdrop-filter:saturate(1.8) blur(20px);backdrop-filter:saturate(1.8) blur(20px);box-shadow:0 10px 26px -12px #000b;color:var(--tx);cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;animation:hangIn .9s var(--spring) both;transition:opacity .7s var(--ease-soft,ease),transform .6s var(--spring),box-shadow .5s}
.hang.idle:not(.open):not(.drag) .hang-bt{opacity:.5}
.hang-bt:active{transform:scale(.94);transition-duration:.7s,.15s,.5s}
.hang.drag .hang-bt{transform:scale(1.1);cursor:grabbing;box-shadow:0 18px 34px -12px #000c;transition-duration:.7s,.25s,.4s}
.hang-ic{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,#f5a524 24%,transparent);color:#f5a524;transition:background-color .5s,color .5s}
.hang-ic svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.hang:not(.ok):not(.open) .hang-bt::after{content:"";position:absolute;inset:-1px;border-radius:50%;border:1.5px solid #f5a524;opacity:0;animation:hangPing 3.2s var(--ease-soft,ease-out) 1.2s infinite;pointer-events:none}
.hang.ok .hang-ic{background:color-mix(in srgb,var(--ok,#4ade80) 24%,transparent);color:var(--ok,#4ade80)}
.hang.out .hang-bt{animation:hangOut .55s var(--ease-soft,ease) forwards}.hang.out .hang-pn{opacity:0!important;transition-duration:.3s!important}
.hang-pn{position:absolute;width:min(284px,calc(100vw - 24px));overflow:auto;overscroll-behavior:contain;border-radius:20px;border:1px solid color-mix(in srgb,var(--tx) 16%,var(--line));background:color-mix(in srgb,var(--card) 66%,transparent);-webkit-backdrop-filter:saturate(1.8) blur(24px);backdrop-filter:saturate(1.8) blur(24px);color:var(--tx);box-shadow:0 22px 50px -20px #000d;scrollbar-width:none;
  opacity:0;visibility:hidden;pointer-events:none;transform:scale(.3);transition:transform .75s var(--ease-soft,cubic-bezier(.22,.8,.24,1)),opacity .4s var(--ease-soft,ease),visibility 0s linear .75s}
.hang-pn::-webkit-scrollbar{display:none}
.hang.open .hang-pn{opacity:1;visibility:visible;pointer-events:auto;transform:none;transition-delay:0s}
.hang[data-x=r] .hang-pn{right:0}.hang[data-x=l] .hang-pn{left:0}
.hang[data-y=b] .hang-pn{top:calc(100% + 10px)}.hang[data-y=t] .hang-pn{bottom:calc(100% + 10px)}
.hang[data-x=r][data-y=b] .hang-pn{transform-origin:calc(100% - 24px) -34px}.hang[data-x=l][data-y=b] .hang-pn{transform-origin:24px -34px}
.hang[data-x=r][data-y=t] .hang-pn{transform-origin:calc(100% - 24px) calc(100% + 34px)}.hang[data-x=l][data-y=t] .hang-pn{transform-origin:24px calc(100% + 34px)}
.hg-p{padding:14px 14px 14px}
.hg-p>*{opacity:0;transform:translate3d(0,6px,0);transition:opacity .45s var(--ease-soft,ease),transform .7s var(--ease-soft,ease)}
.hang.open .hg-p>*{opacity:1;transform:none}
.hang.open .hg-p>:nth-child(1){transition-delay:.12s}.hang.open .hg-p>:nth-child(2){transition-delay:.17s}.hang.open .hg-p>:nth-child(3){transition-delay:.22s}.hang.open .hg-p>:nth-child(n+4){transition-delay:.27s}
.hg-st{display:inline-flex;align-items:center;gap:7px;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:700;color:#f5a524;background:color-mix(in srgb,#f5a524 14%,transparent);border:1px solid color-mix(in srgb,#f5a524 40%,transparent)}
.hg-st i{width:7px;height:7px;border-radius:50%;background:currentColor;animation:hangPulse 1.8s ease-in-out infinite}
.hg-st.ok{color:var(--ok,#4ade80);background:color-mix(in srgb,var(--ok,#4ade80) 14%,transparent);border-color:color-mix(in srgb,var(--ok,#4ade80) 40%,transparent)}.hg-st.ok i{animation:none}
.hg-p .cfm{margin-top:10px}.hg-p .cfm>div{padding:7px 10px;font-size:12.5px}.hg-p .cfm .tot b{font-size:15px}
.hg-qr{display:grid;grid-template-rows:0fr;transition:grid-template-rows .8s var(--ease-soft,cubic-bezier(.22,.8,.24,1))}
.hg-qr.on{grid-template-rows:1fr}
.hg-qi{overflow:hidden;min-height:0}
.hg-qi>*{display:block;margin:0 auto;opacity:0;transform:scale(.94) translate3d(0,-6px,0);transition:opacity .5s var(--ease-soft,ease),transform .8s var(--ease-soft,ease)}
.hg-qr.on .hg-qi>*{opacity:1;transform:none;transition-delay:.12s}
.hg-qi img{width:100%;max-width:200px;background:#fff;border-radius:12px;padding:6px;margin-top:10px}
.hg-qi .hg-n{padding-top:10px;text-align:center}
.hg-n{margin:8px 0 0;font-size:11.5px;color:var(--mut);line-height:1.4}
.hg-act{display:flex;gap:8px;margin-top:10px}.hg-act .btn{flex:1;padding:8px 10px;font-size:12.5px;margin:0;width:auto}
.hg-act .hg-cancel{transition:color .35s,border-color .35s,background-color .35s,transform .6s var(--spring)}
.hg-act .hg-cancel.sure{border-color:#ef4444;color:#ef4444;background:color-mix(in srgb,#ef4444 10%,transparent)}
@keyframes hangIn{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:none}}
@keyframes hangOut{to{opacity:0;transform:scale(.3)}}
@keyframes hangPing{0%{opacity:.55;transform:scale(1)}60%,100%{opacity:0;transform:scale(1.7)}}
@keyframes hangPulse{0%,100%{opacity:1}50%{opacity:.45}}
@media(prefers-reduced-motion:reduce){.hang-bt,.hang-bt::after,.hg-st i{animation:none!important}.hang.snap,.hang-pn,.hg-p>*,.hg-qr,.hg-qi>*{transition-duration:.01s!important;transition-delay:0s!important}}`
  document.head.append(st)

  const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
  const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
  const S = 48, M = 10, KEY = 'arvo_hang'
  const H = { el: null, order: null, poll: null, tick: null, idle: null, open: false, qr: {}, done: null }
  const navh = () => ($('.nav') ? $('.nav').offsetHeight : 56)
  const clampX = (x) => Math.min(Math.max(x, M), innerWidth - S - M)
  const clampY = (y) => Math.min(Math.max(y, navh() + 8), innerHeight - S - 14)
  let P = { side: 'r', fy: null }
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && (v.side === 'l' || v.side === 'r') && Number.isFinite(v.fy)) P = v } catch {}
  const home = () => ({ x: P.side === 'r' ? innerWidth - S - M : M, y: clampY((P.fy ?? (navh() + 16) / innerHeight) * innerHeight) })
  const apply = (x, y) => { H.el.style.setProperty('--hx', x + 'px'); H.el.style.setProperty('--hy', y + 'px') }
  const geo = () => {   /* arah kartu mengembang: ke sisi layar yang lega */
    if (!H.el) return
    const r = H.el.getBoundingClientRect(), below = r.top + S / 2 < innerHeight * 0.5
    H.el.dataset.x = P.side; H.el.dataset.y = below ? 'b' : 't'
    H.el.querySelector('.hang-pn').style.maxHeight = Math.max(170, (below ? innerHeight - r.bottom : r.top - navh()) - 24) + 'px'
  }
  const wake = () => { if (!H.el) return; H.el.classList.remove('idle'); clearTimeout(H.idle); H.idle = setTimeout(() => { if (H.el && !H.open) H.el.classList.add('idle') }, 3500) }
  addEventListener('resize', () => { if (!H.el) return; const h = home(); H.el.classList.remove('snap'); apply(h.x, h.y); geo() })

  const sub = (o) => `${o.name || o.plan} · ${rp(o.total)}`
  const fmtLeft = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }
  const startPoll = () => { clearInterval(H.poll); H.poll = setInterval(pull, H.open ? 5000 : 15000) }
  const stopTimers = () => { clearInterval(H.poll); clearInterval(H.tick); clearTimeout(H.idle); H.poll = H.tick = null }

  const render = () => {            /* isi kartu (dipanggil saat dibuka / order berganti / lunas) */
    const o = H.done || H.order, pn = H.el && H.el.querySelector('.hang-pn'); if (!o || !pn) return
    const paid = !!H.done, qr = H.qr[o.id]
    pn.innerHTML = `<div class="hg-p"><div><span class="hg-st${paid ? ' ok' : ''}"><i></i>${paid ? 'Pembayaran berhasil' : 'Menunggu konfirmasi admin'}</span></div>
      <div class="cfm"><div><span>Paket</span><b>${esc(o.name || o.plan)}</b></div><div><span>Durasi</span><b>${o.days ? esc(o.days) + ' hari' : 'Permanen'}</b></div>
      ${paid ? '' : '<div><span>Sisa waktu bayar</span><b class="mono" id="hgleft">--:--</b></div>'}<div class="tot"><span>Total bayar</span><b>${rp(o.total)}</b></div></div>
      ${paid ? '' : `<div class="hg-qr" inert><div class="hg-qi">${qr ? `<img alt="QRIS" src="${esc(qr)}">` : '<p class="hg-n">Memuat QR…</p>'}</div></div>`}
      <div><p class="hg-n">${paid ? 'Paketmu sudah aktif di akun.' : 'Sudah bayar? Tunggu admin mengonfirmasi. Status ini berubah otomatis.'}</p>
      <p class="hg-n" id="hgerr" style="color:#ef4444" hidden></p></div>
      <div class="hg-act">${paid ? '<a class="btn" href="/profile.html" style="text-align:center">Buka profil</a>' : '<button class="btn ghost" type="button" data-a="qr">Tampilkan QR</button><button class="btn ghost hg-cancel" type="button" data-a="cancel">Batalkan</button>'}</div>
      <div><p class="hg-n" style="font-size:10.5px">ID order: <span class="mono">${esc(o.id)}</span></p></div></div>`
    clearInterval(H.tick); H.tick = null
    if (!paid && o.expires_at) { const t = () => { const e = $('#hgleft'); if (e) e.textContent = fmtLeft(o.expires_at - Date.now()) }; t(); H.tick = setInterval(t, 1000) }
  }
  const loadQr = async () => {
    const o = H.order; if (!o || H.qr[o.id]) return
    try {
      const r = await api('/billing/orders/' + o.id)
      if (r.qris) { H.qr[o.id] = r.qris.image; if (H.el && H.order && H.order.id === o.id) { const qi = $('.hg-qi', H.el); if (qi) qi.innerHTML = `<img alt="QRIS" src="${esc(r.qris.image)}">` } }
    } catch {}
  }
  const setOpen = (v) => {
    if (!H.el || v === H.open) return
    H.open = v
    if (v) { geo(); render(); loadQr(); H.el.classList.add('open'); clearTimeout(H.idle); H.el.classList.remove('idle') }
    else { H.el.classList.remove('open'); clearInterval(H.tick); H.tick = null; wake() }
    H.el.querySelector('.hang-bt').setAttribute('aria-expanded', v)
    if (H.poll) startPoll()
  }
  const act = async (e) => {
    const b = e.target.closest('button[data-a]'); if (!b) return
    if (b.dataset.a === 'qr') {
      const box = $('.hg-qr', H.el), on = box.classList.toggle('on'); box.inert = !on
      b.textContent = on ? 'Sembunyikan QR' : 'Tampilkan QR'; return
    }
    if (!b.classList.contains('sure')) {   /* batalkan: ketuk dua kali */
      b.classList.add('sure'); b.textContent = 'Yakin batalkan?'
      setTimeout(() => { if (b.isConnected) { b.classList.remove('sure'); b.textContent = 'Batalkan' } }, 4000); return
    }
    b.disabled = true
    try { await put('/billing/orders/' + H.order.id + '/cancel', {}, 'POST'); unmount() }
    catch (err) { const m = $('#hgerr', H.el); if (m) { m.textContent = err.message; m.hidden = false } b.disabled = false }
  }

  const mount = (o) => {
    const el = document.createElement('div'); el.className = 'hang'
    el.innerHTML = `<button class="hang-bt" type="button" aria-label="Status pembelian: menunggu konfirmasi" aria-expanded="false"><span class="hang-ic">${CLOCK}</span></button><div class="hang-pn" role="dialog" aria-label="Status pembelian"></div>`
    document.body.append(el); H.el = el
    const h = home(); apply(h.x, h.y); geo(); wake()
    el.querySelector('.hang-pn').addEventListener('click', act)
    /* geser dengan jari/kursor; lepas -> menempel ke tepi kiri/kanan dengan pegas. Ketuk tanpa geser -> buka/tutup kartu. */
    const bt = el.querySelector('.hang-bt'); let g = null
    bt.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return
      const p = home(); g = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, x: p.x, y: p.y, drag: false, moved: false }
      try { bt.setPointerCapture(e.pointerId) } catch {}; wake()
    })
    bt.addEventListener('pointermove', (e) => {
      if (!g || e.pointerId !== g.id) return
      const dx = e.clientX - g.sx, dy = e.clientY - g.sy
      if (!g.drag) { if (Math.hypot(dx, dy) < 7) return; g.moved = true; if (H.open) return; g.drag = true; el.classList.remove('snap'); el.classList.add('drag') }
      g.x = clampX(g.ox + dx); g.y = clampY(g.oy + dy); apply(g.x, g.y)
    })
    const end = (e, cancel) => {
      if (!g || e.pointerId !== g.id) return
      const s = g; g = null; el.classList.remove('drag')
      if (s.drag) {
        P = { side: s.x + S / 2 < innerWidth / 2 ? 'l' : 'r', fy: s.y / innerHeight }
        try { localStorage.setItem(KEY, JSON.stringify(P)) } catch {}
        el.classList.add('snap'); const p = home(); apply(p.x, p.y); geo()
      } else if (!cancel && !s.moved) setOpen(!H.open)
      wake()
    }
    bt.addEventListener('pointerup', (e) => end(e, false)); bt.addEventListener('pointercancel', (e) => end(e, true))
    bt.addEventListener('mouseenter', wake)
  }
  const unmount = () => {
    stopTimers()
    const el = H.el; H.el = null; H.order = null; H.done = null; H.open = false
    if (!el) return
    el.classList.add('out'); setTimeout(() => el.remove(), 650)
  }
  const success = (o) => {
    clearInterval(H.poll); H.poll = null; H.done = o
    if (!H.el) return
    H.el.classList.add('ok'); H.el.querySelector('.hang-ic').innerHTML = TICK
    H.el.querySelector('.hang-bt').setAttribute('aria-label', 'Pembayaran dikonfirmasi')
    wake(); if (H.open) render()
    setTimeout(unmount, 14000)
  }

  const pull = async () => {
    let r; try { r = await api('/auth/me/orders') } catch { return }
    const list = r.orders || [], now = Date.now()
    const pend = list.find((o) => o.status === 'pending' && (!o.expires_at || o.expires_at > now))
    if (pend) {
      const changed = !H.order || H.order.id !== pend.id
      H.order = pend
      if (!H.el) mount(pend)
      if (changed && H.open) { render(); loadQr() }
      if (!H.poll) startPoll()
      return
    }
    if (H.order) {
      const was = list.find((o) => o.id === H.order.id)
      if (was && was.status === 'paid') success({ ...H.order, ...was }); else unmount()
    }
  }

  document.addEventListener('pointerdown', (e) => { if (H.open && H.el && !H.el.contains(e.target)) setOpen(false) }, { passive: true })
  window.hangNotice = { refresh: pull }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && H.el) pull() })
  if (!location.pathname.startsWith('/login')) ready.then(({ user }) => { if (user) pull() })
}

/* membuat efek :active (tekan) langsung terasa di layar sentuh iOS */
document.addEventListener('touchstart', () => {}, { passive: true })
