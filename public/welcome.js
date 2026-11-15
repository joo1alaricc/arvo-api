/* Popup sambutan di beranda: muncul 5 detik setelah halaman dibuka.
   Ubah angka di bawah kalau perlu. POPUP_ONCE=true -> hanya sekali per sesi browser (tidak mengganggu tiap pindah halaman). */
const POPUP_DELAY = 2000
const POPUP_ONCE = true
const WA_LINK = 'https://whatsapp.com/channel/0029Vb76SfPDzgTBlh5Tn70I'
const IG_LINK = 'https://www.instagram.com/brzee_.sky'
{
  const KEY = 'arvo_welcome_seen'
  const seen = () => { try { return POPUP_ONCE && sessionStorage.getItem(KEY) === '1' } catch { return false } }
  const mark = () => { try { sessionStorage.setItem(KEY, '1') } catch {} }

  /* logo Arvo (A + R) dipecah jadi dua path supaya bisa digambar bergantian */
  const PA = 'M40.6 0.5L0.1 70.9L14.2 70.9L40.5 25.6L41.7 27.3L56.0 27.3Z'
  const PR = 'M49.3 0.0L56.4 12.5L85.2 12.4L85.5 12.9L72.7 34.9L43.4 34.9L36.3 47.3L53.1 47.4L66.8 70.9L81.1 70.9L67.9 47.5L80.1 47.2L100.0 12.4L92.8 0.0Z'
  const WA = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'
  const IG = '<rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.6" cy="6.4" r="1.3" fill="currentColor"/>'
  const ARROW = '<svg class="wl-ar" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>'

  const html = () => `<div class="wl-in" tabindex="-1" autofocus>
    <button class="wl-x" type="button" aria-label="Tutup"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    <div class="wl-hero" aria-hidden="true"><i class="wl-glow"></i>
      <div class="wl-tile"><i class="wl-grid"></i>
        <svg viewBox="-4 -4 108 78.9" class="wl-logo">
          <defs><clipPath id="wl-clip"><path d="${PA}"/><path d="${PR}"/></clipPath></defs>
          <path class="wl-p a" pathLength="1" d="${PA}"/><path class="wl-p r" pathLength="1" d="${PR}"/>
          <g clip-path="url(#wl-clip)"><rect class="wl-shine" x="0" y="-10" width="16" height="92"/></g>
        </svg>
      </div>
    </div>
    <h3 id="wl-t">Selamat datang di Arvo</h3>
    <p class="wl-sub">Ikuti kami untuk info terbaru, lalu langsung coba API-nya.</p>
    <div class="wl-list">
      <a class="wl-it wa" href="${WA_LINK}" target="_blank" rel="noopener noreferrer"><span class="wl-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${WA}"/></svg></span><span class="wl-tx"><b>Ikuti saluran</b><small>Saluran WhatsApp</small></span>${ARROW}</a>
      <a class="wl-it ig" href="${IG_LINK}" target="_blank" rel="noopener noreferrer"><span class="wl-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${IG}</svg></span><span class="wl-tx"><b>Ikuti Instagram</b><small>@brzee_.sky</small></span>${ARROW}</a>
    </div>
    <a class="btn wl-go" href="/playground.html">Mulai pakai API</a>
  </div>`

  let tries = 0
  const open = () => {
    if (seen() || document.getElementById('welcome')) return
    /* jangan menimpa dialog lain yang sedang dipakai (mis. pembayaran); coba lagi sebentar */
    if (document.querySelector('dialog[open]') && tries++ < 6) return setTimeout(open, 3000)
    const d = document.createElement('dialog'); d.id = 'welcome'; d.className = 'wl'; d.setAttribute('aria-labelledby', 'wl-t'); d.innerHTML = html()
    document.body.append(d)
    const close = () => d.close()
    d.querySelector('.wl-x').onclick = close
    d.addEventListener('click', (e) => { if (e.target === d) close() })   /* klik area gelap di luar kartu */
    d.querySelector('.wl-go').addEventListener('click', mark)
    d.addEventListener('close', () => { mark(); setTimeout(() => d.remove(), 700) })
    d.showModal()
  }
  setTimeout(open, POPUP_DELAY)
}
