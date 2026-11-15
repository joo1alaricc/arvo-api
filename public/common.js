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

/* Logo Arvo: huruf A dan R menyatu. A utuh (dua kaki + palang), perut huruf R menggantung dari puncak A,
 * dan kaki kanan A sekaligus jadi kaki R. Digambar dari garis saja (tanpa gambar eksternal). */
const LOGO_PATH = 'M4 20 10.5 4 17 20M6.9 14.6h7.2M10.5 4h3.8a3.75 3.75 0 0 1 0 7.5h-1.4'
const LOGO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path style="stroke-width:2.1" d="${LOGO_PATH}"/></svg>`

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

/* ---- Cache background profil di localDb (IndexedDB, cadangan localStorage) ----
 * Background kartu profil (warna aksen + gambar blur kecil) dibuat SEKALI di latar belakang saat user masuk web,
 * lalu disimpan per user. Dipakai ulang sampai foto profil berganti (versi di URL foto berubah). */
const localDb = {
  open: () => (localDb._p ||= new Promise((ok, no) => {
    if (!('indexedDB' in window)) return no()
    const r = indexedDB.open('arvo', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv')
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error)
  })),
  async get(k) {
    try { const db = await localDb.open(); return await new Promise((ok) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => ok(q.result ?? null); q.onerror = () => ok(null) }) }
    catch { try { return JSON.parse(localStorage.getItem('arvo:' + k)) } catch { return null } }
  },
  async set(k, v) {
    try { const db = await localDb.open(); await new Promise((ok, no) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = ok; t.onerror = () => no(t.error) }) }
    catch { try { localStorage.setItem('arvo:' + k, JSON.stringify(v)) } catch {} }
  },
  async del(k) {
    try { const db = await localDb.open(); await new Promise((ok) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = ok; t.onerror = ok }) } catch {}
    try { localStorage.removeItem('arvo:' + k) } catch {}
  },
}
/* gambar blur kecil (48px, sudah halus) menggantikan filter:blur() CSS yang berat di HP */
const makeBg = (src) => new Promise((done) => {
  const im = new Image(); if (!src.startsWith('/')) im.crossOrigin = 'anonymous'
  im.onload = () => {
    const out = { h: null, s: null, bg: null }
    const a = accentOf(im); if (a) { out.h = a.h; out.s = a.s }
    try {
      const t = document.createElement('canvas'); t.width = t.height = 12
      const x = t.getContext('2d'); x.drawImage(im, 0, 0, 12, 12)
      const big = document.createElement('canvas'); big.width = big.height = 48
      const y = big.getContext('2d'); y.imageSmoothingQuality = 'high'; y.drawImage(t, 0, 0, 48, 48)
      out.bg = big.toDataURL('image/jpeg', 0.7)
    } catch {}
    done(out)
  }
  im.onerror = () => done(null); im.src = src
})
const bgJobs = {}
/* Ambil background user: dari cache bila fotonya masih sama, kalau tidak dibuat lalu disimpan. */
const getBg = (user, force = false) => {
  if (!user || !user.avatar_url) { if (user) localDb.del('bg:' + user.id); return Promise.resolve(null) }
  const key = 'bg:' + user.id, ver = user.avatar_url
  return (bgJobs[key + ver] ||= (async () => {
    if (!force) { const c = await localDb.get(key); if (c && c.ver === ver) return c }
    const made = await makeBg(ver); if (!made) return null
    const rec = { ver, ...made, at: Date.now() }; await localDb.set(key, rec); return rec
  })().finally(() => setTimeout(() => delete bgJobs[key + ver], 0)))
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
  $('#navr').innerHTML = (who.is_admin || who.is_owner ? `<a class="nb adm" href="/admin.html" title="Admin" aria-label="Admin">${ni('shield')}</a>` : '') +
    (user ? `<a class="nb" href="/profile.html" title="${esc(user.username)}" aria-label="Profil ${esc(user.username)}">${ni('user')}</a>` : '<a class="btn" href="/login.html">Masuk</a>')
  /* siapkan background profil di latar belakang, supaya halaman profil tinggal memakai */
  if (user) (window.requestIdleCallback || ((f) => setTimeout(f, 800)))(() => getBg(user).catch(() => {}))
  return { user, who }
})
