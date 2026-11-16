/* Layar pembuka: logo Arvo digambar garisnya (dengan titik cahaya di ujung pena), lalu terisi penuh bersamaan bar loading.
   Bar = kemajuan nyata: berjalan minimal MIN ms, dan tertahan di 92% sampai halaman (window.load + font) benar-benar siap.
   Markup & CSS-nya inline di index.html (supaya tampil sejak frame pertama, tanpa kedip konten). */
(() => {
  const el = document.getElementById('splash'); if (!el) return
  const root = document.documentElement
  const finishNow = () => { el.remove(); root.classList.remove('splash-on'); window.__splashDone = true; dispatchEvent(new Event('splashdone')) }
  if (window.__fresh === false || matchMedia('(prefers-reduced-motion:reduce)').matches) return finishNow()

  const MIN = 2600   /* lama minimal animasi (ms) */
  const $s = (id) => document.getElementById(id)
  const la = $s('spla'), lr = $s('splr'), fa = $s('spfa'), fr = $s('spfr'), da = $s('spda'), dr = $s('spdr')
  const bar = $s('spf'), pct = $s('spp'), txt = $s('spt'), logo = el.querySelector('.sp-logo')
  const LA = la.getTotalLength(), LR = lr.getTotalLength()
  la.style.strokeDasharray = LA; lr.style.strokeDasharray = LR; la.style.strokeDashoffset = LA; lr.style.strokeDashoffset = LR

  const clamp = (x) => Math.max(0, Math.min(1, x))
  const seg = (p, a, b) => clamp((p - a) / (b - a))
  const ease = (x) => 1 - Math.pow(1 - x, 2.4)
  const pen = (path, L, f, dot) => {
    if (f > 0.003 && f < 0.997) { const pt = path.getPointAtLength(L * f); dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y); dot.style.opacity = 1 } else dot.style.opacity = 0
  }
  const render = (p) => {
    const a = ease(seg(p, 0, 0.46)), r = ease(seg(p, 0.3, 0.8)), f = seg(p, 0.8, 0.97)
    la.style.strokeDashoffset = LA * (1 - a); lr.style.strokeDashoffset = LR * (1 - r)
    pen(la, LA, a, da); pen(lr, LR, r, dr)
    fa.style.fillOpacity = fr.style.fillOpacity = f
    bar.style.width = p * 100 + '%'; pct.textContent = Math.round(p * 100) + '%'
  }

  let loaded = document.readyState === 'complete', fonts = !document.fonts
  const check = () => { if (loaded && fonts) cap = 1 }
  let cap = 0.92
  if (!loaded) addEventListener('load', () => { loaded = true; check() }, { once: true })
  if (document.fonts) document.fonts.ready.then(() => { fonts = true; check() })
  check()

  const t0 = performance.now()
  const frame = (now) => {
    const t = clamp((now - t0) / MIN)
    const p = Math.min(t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, cap)
    render(p)
    if (p < 1) return requestAnimationFrame(frame)
    logo.classList.add('done'); txt.textContent = 'Siap'
    setTimeout(() => { el.classList.add('out'); setTimeout(finishNow, 720) }, 320)
  }
  requestAnimationFrame(frame)
})()
