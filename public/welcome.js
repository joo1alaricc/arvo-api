/* Popup sambutan di beranda. Muncul setiap halaman dibuka/di-refresh, POPUP_DELAY ms setelah layar pembuka (splash) selesai.
   Tidak muncul saat pindah dari halaman lain di dalam situs (mis. dari /playground atau /profile kembali ke beranda),
   dan memang hanya dipasang di beranda. Ubah angka di bawah kalau perlu.
   POPUP_ONCE=true -> hanya sekali per sesi browser. */
const POPUP_DELAY = 2000
const POPUP_ONCE = false
{
  const KEY = 'arvo_welcome_seen'
  const seen = () => { try { return POPUP_ONCE && sessionStorage.getItem(KEY) === '1' } catch { return false } }
  const mark = () => { try { sessionStorage.setItem(KEY, '1') } catch {} }

  /* logo Arvo (A + R) dipecah jadi dua path supaya bisa digambar bergantian */
  const PA = 'M40.6 0.5L0.1 70.9L14.2 70.9L40.5 25.6L41.7 27.3L56.0 27.3Z'
  const PR = 'M49.3 0.0L56.4 12.5L85.2 12.4L85.5 12.9L72.7 34.9L43.4 34.9L36.3 47.3L53.1 47.4L66.8 70.9L81.1 70.9L67.9 47.5L80.1 47.2L100.0 12.4L92.8 0.0Z'
  const ARROW = '<svg class="wl-ar" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>'

  const html = () => `<div class="wl-in" tabindex="-1" autofocus>
    <button class="wl-x" type="button" aria-label="Tutup"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    <div class="wl-hero" aria-hidden="true"><i class="wl-glow"></i>
      <div class="wl-tile"><i class="wl-grid"></i>
        <svg viewBox="-4 -4 108 78.9" width="78" height="55" class="wl-logo">
          <defs><clipPath id="wl-clip"><path d="${PA}"/><path d="${PR}"/></clipPath></defs>
          <path class="wl-p a" pathLength="1" d="${PA}"/><path class="wl-p r" pathLength="1" d="${PR}"/>
          <g clip-path="url(#wl-clip)"><rect class="wl-shine" x="0" y="-10" width="16" height="92"/></g>
        </svg>
      </div>
    </div>
    <h3 id="wl-t">Selamat datang di Arvo</h3>
    <p class="wl-sub">Ikuti kami untuk info terbaru, lalu langsung coba API-nya.</p>
    <div class="wl-list">
      <a class="wl-it wa" href="${WA_LINK}" target="_blank" rel="noopener noreferrer"><span class="wl-ic"><svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${WA_PATH}"/></svg></span><span class="wl-tx"><b>Ikuti saluran</b><small>Saluran WhatsApp</small></span>${ARROW}</a>
      <a class="wl-it ig" href="${IG_LINK}" target="_blank" rel="noopener noreferrer"><span class="wl-ic"><svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">${IG_SHAPES}</svg></span><span class="wl-tx"><b>Ikuti Instagram</b><small>@brzee_.sky</small></span>${ARROW}</a>
    </div>
    <a class="btn wl-go" href="/playground.html">Mulai pakai API</a>
  </div>`

  /* CSS ikut di file ini supaya popup tidak bergantung pada site.css (yang bisa ter-cache versi lama) */
  const CSS = `dialog.wl{padding:0;width:min(400px,92vw);overflow:hidden;text-align:center}
.wl-in{position:relative;padding:26px 20px 20px}
.wl-x{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:10px;border:1px solid var(--line);background:none;color:var(--mut);display:grid;place-items:center;cursor:pointer;transition:background-color .2s,color .2s,transform .5s var(--spring,cubic-bezier(.34,1.5,.64,1))}
.wl-x:hover{background:color-mix(in srgb,var(--mut) 12%,transparent);color:var(--tx)}.wl-x:active{transform:scale(.88)}
.wl-x svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
.wl h3{font-size:20px;letter-spacing:-.02em;margin:16px 0 4px}
.wl-sub{color:var(--mut);font-size:13px;max-width:290px;margin:0 auto 16px}
.wl-list{display:grid;gap:8px;text-align:left}
.wl-it{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:13px;text-decoration:none;color:var(--tx);background:color-mix(in srgb,var(--tx) 3%,transparent);transition:border-color .25s,background-color .25s,transform .5s var(--spring,cubic-bezier(.34,1.5,.64,1))}
.wl-it:hover{border-color:color-mix(in srgb,var(--ac) 55%,var(--line));background:color-mix(in srgb,var(--ac) 7%,transparent)}.wl-it:active{transform:scale(.975);transition-duration:.12s}
.wl-ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;flex:none;color:#fff}.wl-ic svg{width:21px;height:21px}
.wl-it.wa .wl-ic{background:#25d366}.wl-it.ig .wl-ic{background:linear-gradient(45deg,#f9ce34,#ee2a7b 55%,#6228d7)}
.wl-tx{flex:1;min-width:0;display:grid;line-height:1.3}.wl-tx b{font-size:14px}.wl-tx small{color:var(--mut);font-size:12px}
.wl-ar{width:16px;height:16px;fill:none;stroke:var(--mut);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none;transition:transform .4s var(--ease,cubic-bezier(.32,.72,0,1)),stroke .2s}.wl-it:hover .wl-ar{stroke:var(--ac);transform:translate(2px,-2px)}
.wl-go{display:flex;align-items:center;justify-content:center;width:100%;margin-top:12px;padding:12px 15px;font:600 14px/1.2 inherit;font-family:inherit;border-radius:12px;text-decoration:none;cursor:pointer;background:var(--ac);color:var(--acx,#0d1016);border:1px solid var(--ac);transition:transform .5s var(--spring,cubic-bezier(.34,1.5,.64,1)),filter .2s,box-shadow .2s}.wl-go:hover{filter:brightness(1.08);box-shadow:0 4px 14px color-mix(in srgb,var(--ac) 28%,transparent)}.wl-go:active{transform:scale(.96);transition-duration:.12s}

/* animasi logo: digambar garisnya -> terisi -> berkilau -> terhapus halus -> ulang */
.wl-hero{position:relative;width:112px;height:112px;margin:0 auto}
.wl-glow{position:absolute;inset:-26px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--ac) 38%,transparent),transparent 68%);animation:wlGlow 6s ease-in-out infinite}
.wl-tile{position:relative;width:100%;height:100%;border-radius:28px;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,var(--ac),#e16bff);box-shadow:0 14px 34px -12px color-mix(in srgb,var(--ac) 70%,transparent),inset 0 1px 0 #fff4}
.wl-grid{position:absolute;inset:0;background:linear-gradient(#fff2 1px,transparent 1px) 0 0/14px 14px,linear-gradient(90deg,#fff2 1px,transparent 1px) 0 0/14px 14px;animation:wlGrid 6s ease-in-out infinite}
.wl-logo{position:relative;width:70%;height:auto;overflow:visible;color:#fff}
.wl-p{fill:#fff;fill-opacity:0;stroke:#fff;stroke-width:2.2;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;stroke-opacity:1}
.wl-p.a{animation:wlA 6s cubic-bezier(.65,0,.35,1) infinite}.wl-p.r{animation:wlR 6s cubic-bezier(.65,0,.35,1) infinite}
.wl-shine{fill:#fff;opacity:0;transform:translateX(-30px) skewX(-20deg);animation:wlShine 6s cubic-bezier(.4,0,.2,1) infinite}
@keyframes wlA{0%{stroke-dashoffset:1;stroke-opacity:1;fill-opacity:0}26%{stroke-dashoffset:0;stroke-opacity:1;fill-opacity:0}42%{stroke-dashoffset:0;stroke-opacity:0;fill-opacity:1}86%{stroke-dashoffset:0;stroke-opacity:0;fill-opacity:1}96%{stroke-dashoffset:0;stroke-opacity:0;fill-opacity:0}100%{stroke-dashoffset:1;stroke-opacity:0;fill-opacity:0}}
@keyframes wlR{0%{stroke-dashoffset:1;stroke-opacity:1;fill-opacity:0}10%{stroke-dashoffset:1;stroke-opacity:1;fill-opacity:0}38%{stroke-dashoffset:0;stroke-opacity:1;fill-opacity:0}52%{stroke-dashoffset:0;stroke-opacity:0;fill-opacity:1}86%{stroke-dashoffset:0;stroke-opacity:0;fill-opacity:1}96%{stroke-dashoffset:0;stroke-opacity:0;fill-opacity:0}100%{stroke-dashoffset:1;stroke-opacity:0;fill-opacity:0}}
@keyframes wlShine{0%,56%{opacity:0;transform:translateX(-30px) skewX(-20deg)}58%{opacity:.75}72%{opacity:.75;transform:translateX(130px) skewX(-20deg)}74%,100%{opacity:0;transform:translateX(130px) skewX(-20deg)}}
@keyframes wlGrid{0%{opacity:0}12%,40%{opacity:1}56%,100%{opacity:0}}
@keyframes wlGlow{0%,100%{opacity:.35;transform:scale(.92)}55%,75%{opacity:.95;transform:scale(1.06)}}
@media(prefers-reduced-motion:reduce){.wl-p{animation:none!important;stroke-dashoffset:0;stroke-opacity:0;fill-opacity:1}.wl-glow,.wl-grid,.wl-shine{animation:none}.wl-grid{opacity:0}}
@media(max-width:600px){dialog.wl::before{margin:10px auto 0}.wl-in{padding-top:20px}}
.wl-in:focus{outline:0}`
  const addCss = () => { if (document.getElementById('wl-css')) return; const s = document.createElement('style'); s.id = 'wl-css'; s.textContent = CSS; document.head.append(s) }

  let tries = 0
  const open = () => {
    if (seen() || document.getElementById('welcome')) return
    /* jangan menimpa dialog lain yang sedang dipakai (mis. pembayaran); coba lagi sebentar */
    if ((document.querySelector('dialog[open]') || document.documentElement.classList.contains('dr-lock')) && tries++ < 6) return setTimeout(open, 3000)
    addCss()
    const d = document.createElement('dialog'); d.id = 'welcome'; d.className = 'wl'; d.setAttribute('aria-labelledby', 'wl-t'); d.innerHTML = html()
    document.body.append(d)
    const close = () => d.close()
    d.querySelector('.wl-x').onclick = close
    d.addEventListener('click', (e) => { if (e.target === d) close() })   /* klik area gelap di luar kartu */
    d.querySelector('.wl-go').addEventListener('click', mark)
    d.addEventListener('close', () => { mark(); setTimeout(() => d.remove(), 700) })
    d.showModal()
  }
  /* tunggu splash selesai (kalau ada), baru hitung jeda */
  if (window.__fresh !== false) {
    const afterSplash = window.__splashDone ? Promise.resolve() : new Promise((r) => addEventListener('splashdone', r, { once: true }))
    afterSplash.then(() => setTimeout(open, POPUP_DELAY))
  }
}
