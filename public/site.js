const SN = {
  curl: `curl 'https://${location.host}/api/premium/ping' \\\n  --header 'x-api-key: KEY_KAMU'`,
  js: `const res = await fetch('https://${location.host}/api/premium/ping', {\n  headers: { 'x-api-key': 'KEY_KAMU' }\n})\nconsole.log(await res.json())`,
  py: `import requests\n\nr = requests.get('https://${location.host}/api/premium/ping',\n                 headers={'x-api-key': 'KEY_KAMU'})\nprint(r.json())`,
}
document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); $('#snip').textContent = SN[b.dataset.t]
}))
$('#snip').textContent = SN.curl

/* ---- video hero: path dari HERO_VIDEO (wrangler.toml). Gagal/kosong -> otomatis pakai cahaya cadangan ---- */
api('/auth/config').then(({ hero_video, hero_poster }) => {
  if (!hero_video) return
  const box = $('#hv'), v = $('#hvid'), calm = matchMedia('(prefers-reduced-motion:reduce)').matches
  if (hero_poster) v.poster = hero_poster
  v.addEventListener('loadeddata', () => { box.classList.add('on'); if (!calm) v.play().catch(() => {}) }, { once: true })
  v.addEventListener('error', () => { box.classList.remove('on'); v.remove() }, { once: true })
  v.src = hero_video; v.load()
  if (calm) return
  /* parallax: video ikut bergerak pelan saat scroll, ditempel di belakang hero */
  let y = 0, tick = false
  const hero = $('#herobox')
  const paint = () => { tick = false; const k = Math.min(1.2, Math.max(0, y / (hero.offsetHeight || 1))); box.style.transform = `translate3d(0,${(y * 0.28).toFixed(1)}px,0) scale(${(1 + k * 0.06).toFixed(4)})` }
  addEventListener('scroll', () => { y = scrollY; if (!tick) { tick = true; requestAnimationFrame(paint) } }, { passive: true })
  document.addEventListener('visibilitychange', () => (document.hidden ? v.pause() : box.classList.contains('on') && v.play().catch(() => {})))
}).catch(() => {})

/* teks berjalan: kategori endpoint (AI • DOWNLOADER • STATS), bergerak kiri ke kanan tanpa putus */
const marquee = (paths) => {
  const cats = [...new Set(Object.values(paths).flatMap((ms) => Object.values(ms).map((d) => String(d.tags?.[0] || '').trim().toUpperCase()).filter(Boolean)))].sort((a, b) => a.localeCompare(b))
  const box = $('#mq'), tr = $('#mqt'); if (!cats.length) return
  const unit = cats.map((c) => `<span>${esc(c)}</span><i aria-hidden="true"></i>`).join('')
  tr.innerHTML = `<div class="mq-g">${unit}</div>`
  const g = tr.firstChild; box.hidden = false
  /* ulangi isi sampai satu grup lebih lebar dari layar, lalu gandakan grup supaya putarannya mulus */
  const w = g.getBoundingClientRect().width || 1, n = Math.max(1, Math.ceil((innerWidth * 1.1) / w))
  g.innerHTML = unit.repeat(n)
  tr.append(g.cloneNode(true)); tr.lastChild.setAttribute('aria-hidden', 'true')
  tr.style.setProperty('--mq-d', Math.max(18, Math.round(g.getBoundingClientRect().width / 55)) + 's')
}
fetch('/api/catalog').then(async (r) => {
  const spec = await r.json()
  $('#s-ep').textContent = Object.keys(spec.paths || {}).length
  $('#dot').className = 'dot up'; $('#status').textContent = 'Semua sistem berjalan'
  try { marquee(spec.paths || {}) } catch {}
}).catch(() => { $('#dot').className = 'dot down'; $('#status').textContent = 'Server tidak dapat dijangkau' })
let session = {}
ready.then((s) => {
  session = s; $('#s-ip').textContent = s.who.ip
  const q = s.who.quota
  const u = s.user
  /* login: tampilkan sisa limit harian akunmu (dipakai saat request pakai API key); belum login: sisa kuota IP */
  if (u) { $('#s-rl').textContent = u.daily_limit === null ? 'Unlimited' : `${u.remaining}/${u.daily_limit}`; $('#s-rl').nextElementSibling.textContent = 'Sisa limit akun hari ini' }
  else $('#s-rl').textContent = !q ? '–' : q.unlimited ? 'Unlimited' : `${q.remaining}/${q.limit}`
})

const BEST = 'vip2'   /* paket yang diberi sorotan BEST SELLER */
const price = (p, d, perm) => perm ? p.permanentPrice : Math.max(1000, Math.ceil(p.basePrice * d / p.baseDays / 100) * 100)
/* ikon sub-poin paket (gaya garis, ikut warna aksen kartu) */
const FI = {
  inf: '<path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  key: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  award: '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
  verified: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
}
const fi = (n) => `<svg class="fi" viewBox="0 0 24 24" aria-hidden="true">${FI[n]}</svg>`
const feats = (p) => {
  const vip = p.tier === 'vip'
  return [
    p.daily === null ? ['inf', '<b>Request unlimited</b>'] : ['bolt', `<b>${p.daily.toLocaleString('id-ID')}</b> request / hari`],
    vip ? ['layers', 'Akses semua endpoint (termasuk khusus VIP)'] : ['plug', 'Akses endpoint Premium'],
    ['globe', `Whitelist IP hingga <b>${p.maxIps}</b> IP`],
    p.customKey ? ['key', 'Custom API key'] : null,
    ['award', vip ? 'Badge VIP' : 'Badge Premium'],
    ['verified', vip ? 'Profil centang gold & username gold berkilau' : 'Profil centang biru berkilau'],
    vip ? ['palette', 'Border profil custom (pilih warna sendiri)'] : null,
  ].filter(Boolean).map(([i, t]) => `<li>${fi(i)}<span>${t}</span></li>`).join('')
}

/* ---- carousel paket: swipe kiri-kanan, kartu tengah membesar, kartu samping mengecil, pudar & sedikit blur ---- */
const carousel = (box, start = 0) => {
  const cards = [...box.children]
  if (!cards.length) return
  const calm = matchMedia('(prefers-reduced-motion:reduce)').matches
  let cur = -1, raf = 0, drag = null, moved = false, swallow = false
  const mid = (c) => c.offsetLeft + c.offsetWidth / 2
  const go = (i, smooth = true) => box.scrollTo({ left: mid(cards[Math.max(0, Math.min(cards.length - 1, i))]) - box.clientWidth / 2, behavior: smooth ? 'smooth' : 'auto' })
  const dots = document.createElement('div'); dots.className = 'pdots'
  cards.forEach((c, i) => {
    const d = document.createElement('button'); d.type = 'button'; d.ariaLabel = 'Paket ' + (i + 1); d.onclick = () => go(i); dots.append(d)
    c.addEventListener('click', () => { if (i !== cur) go(i) })
  })
  box.after(dots)
  box.tabIndex = 0; box.setAttribute('role', 'region'); box.setAttribute('aria-label', 'Daftar paket, geser ke kiri atau kanan')
  const paint = () => {
    raf = 0
    const m = box.scrollLeft + box.clientWidth / 2
    let near = 0, nd = Infinity
    cards.forEach((c, i) => {
      const w = c.offsetWidth || 1, d = (mid(c) - m) / w, a = Math.min(Math.abs(d), 1.6)
      if (Math.abs(d) < nd) { nd = Math.abs(d); near = i }
      const sc = 1 - 0.1 * a, pull = -Math.sign(d) * Math.min(Math.abs(d), 1) * w * 0.07
      c.style.transform = `translate3d(${pull.toFixed(1)}px,0,0) scale(${sc.toFixed(4)})`
      c.style.opacity = Math.max(0.35, 1 - 0.42 * a).toFixed(3)
      c.style.filter = calm || a < 0.05 ? '' : `blur(${Math.min(2.4, a * 2.2).toFixed(2)}px)`
      c.style.zIndex = 10 - Math.round(a * 4)
    })
    if (near !== cur) {
      cur = near
      cards.forEach((c, i) => c.classList.toggle('cur', i === cur))
      dots.childNodes.forEach((d, i) => d.classList.toggle('on', i === cur))
    }
  }
  const tick = () => { if (!raf) raf = requestAnimationFrame(paint) }
  box.addEventListener('scroll', tick, { passive: true })
  addEventListener('resize', () => { go(cur < 0 ? start : cur, false); tick() })
  box.addEventListener('keydown', (e) => {
    if (e.target !== box || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    e.preventDefault(); go(cur + (e.key === 'ArrowRight' ? 1 : -1))
  })
  /* mouse (desktop): tarik untuk menggeser. Sentuhan sudah ditangani browser secara native. */
  box.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button,input,a')) return
    drag = { x: e.clientX, l: box.scrollLeft }; moved = false
  })
  addEventListener('pointermove', (e) => {
    if (!drag) return
    const dx = e.clientX - drag.x
    if (!moved && Math.abs(dx) < 5) return
    if (!moved) { moved = true; box.classList.add('drag') }
    box.scrollLeft = drag.l - dx
  })
  const end = () => {
    if (!drag) return
    drag = null; box.classList.remove('drag')
    if (moved) { swallow = true; setTimeout(() => (swallow = false), 60); go(cur) }
  }
  addEventListener('pointerup', end); addEventListener('pointercancel', end)
  box.addEventListener('click', (e) => { if (swallow) { e.stopPropagation(); e.preventDefault() } }, true)
  go(start, false); paint()
  requestAnimationFrame(() => { go(start, false); paint() })   /* ulangi setelah layout/font siap */
}

Promise.all([api('/billing/plans'), ready]).then(([{ plans, min_days, max_days }, { user }]) => {
  const stacking = !!(user && user.active)
  $('#plans').innerHTML = ''
  plans.forEach((p) => {
    const el = document.createElement('article'); el.className = 'plan ' + p.tier + (p.id === BEST ? ' best' : '')
    const timed = !!p.basePrice, perm = !!p.permanentPrice
    let days = timed ? p.baseDays : 0, permanent = !timed
    el.innerHTML = `${p.id === BEST ? '<span class="ribbon">BEST SELLER</span>' : ''}<span class="tag">${p.tier === 'vip' ? 'VIP' : 'Premium'}</span><h3>${p.name}</h3>
      <div class="price"></div><ul>${feats(p)}</ul><div class="chips"></div><button class="btn">${stacking ? 'Tambah' : 'Beli'} ${p.name}</button>${stacking ? '<p class="hint" style="margin:0;font-size:11.5px">Masuk sebagai perpanjangan: durasi ditambah, limit &amp; slot IP dijumlahkan dengan paketmu sekarang.</p>' : ''}`
    const chips = el.querySelector('.chips'), priceEl = el.querySelector('.price')
    const draw = () => {
      priceEl.innerHTML = `${rp(price(p, days, permanent))} <small>${permanent ? 'sekali bayar, permanen' : `/ ${days} hari`}</small>`
      chips.innerHTML = ''
      if (timed) {
        ;[7, p.baseDays, 30, 90].filter((v, i, a) => a.indexOf(v) === i).forEach((v) => {
          const b = document.createElement('button'); b.textContent = v + ' hari'; b.className = !permanent && days === v ? 'on' : ''
          b.onclick = () => { days = v; permanent = false; draw() }; chips.append(b)
        })
        const i = document.createElement('input'); i.type = 'number'; i.min = min_days; i.max = max_days; i.value = days; i.ariaLabel = 'Jumlah hari'
        i.onchange = () => { days = Math.min(max_days, Math.max(min_days, +i.value || min_days)); permanent = false; draw() }; chips.append(i)
      }
      if (perm && timed) {
        const b = document.createElement('button'); b.textContent = 'Permanen'; b.className = permanent ? 'on' : ''
        b.onclick = () => { permanent = true; draw() }; chips.append(b)
      }
    }
    draw(); el.querySelector('.btn').onclick = () => buy(p.id, days, permanent, p); $('#plans').append(el)
  })
  carousel($('#plans'), Math.max(0, plans.findIndex((p) => p.id === BEST)))
}).catch((e) => ($('#plans').innerHTML = `<p class="err">${esc(e.message)}</p>`))

let poll
const dlg = $('#pay'), body = $('#paybody'), closeBtn = $('#payclose')
const stop = () => { clearInterval(poll); poll = null }
closeBtn.onclick = () => { stop(); dlg.close() }
dlg.addEventListener('close', stop)
const label = (name, days, permanent) => `${name} · ${permanent || !days ? 'permanen' : days + ' hari'}`
const view = (o) => {
  closeBtn.textContent = 'Tutup'
  if (o.status === 'paid') {
    body.innerHTML = `<h3>Pembayaran berhasil</h3><p class="sub">${esc(o.name)} sudah aktif di akunmu.</p><a class="btn" href="/profile.html">Buka profil</a>`
    stop(); window.hangNotice && hangNotice.refresh(); return
  }
  if (o.status !== 'pending') { body.innerHTML = '<h3>Order tidak aktif</h3><p class="sub">Silakan buat order baru.</p>'; stop(); return }
  body.innerHTML = `<h3>${esc(label(o.name, o.days))}</h3>
    <img alt="QRIS" src="${o.qris.image}"><div class="big">${rp(o.total)}</div>
    <p class="sub">Bayar sesuai nominal di atas, tanpa biaya tambahan. Halaman ini otomatis berubah setelah pembayaran terkonfirmasi. ID order: <span class="mono">${o.id}</span></p>`
}
/* Langkah 1: konfirmasi dulu. QR baru dibuat setelah user menekan "Lanjut ke Pembayaran". */
function buy(plan, days, permanent, p) {
  if (!session.user) { location.href = '/login.html?next=' + encodeURIComponent('/#paket'); return }
  stop(); closeBtn.textContent = 'Batal'
  body.innerHTML = `<h3>Konfirmasi Pembelian</h3>
    <div class="cfm"><div><span>Paket</span><b>${esc(p.name)}</b></div>
      <div><span>Durasi</span><b>${permanent ? 'Permanen' : days + ' hari'}</b></div>
      <div class="tot"><span>Total bayar</span><b>${rp(price(p, days, permanent))}</b></div></div>
    <p class="sub" style="margin:10px 0 0;font-size:12.5px">Sesuai harga paket, tanpa biaya admin atau tambahan lain.</p>
    <button class="btn" id="paygo" style="width:100%;margin-top:12px">Lanjut ke Pembayaran</button>`
  if (!dlg.open) dlg.showModal()
  $('#paygo').onclick = () => pay(plan, days, permanent)
}
async function pay(plan, days, permanent) {
  body.innerHTML = '<p class="sub" style="display:flex;gap:8px;align-items:center"><i class="spin"></i> Membuat QR pembayaran…</p>'
  try {
    const o = await put('/billing/orders', { plan, days, permanent }, 'POST')
    view(o); stop(); window.hangNotice && hangNotice.refresh()
    poll = setInterval(async () => { try { view(await api('/billing/orders/' + o.id)) } catch {} }, 4000)
  } catch (e) { closeBtn.textContent = 'Tutup'; body.innerHTML = `<p class="err">${esc(e.message)}</p>` }
}

/* muncul halus saat scroll untuk bagian di bawah hero */
document.querySelectorAll('main > section:not(.hero) > h2, main > section > .sub, .steps li, #cara .code, details').forEach((e) => e.classList.add('rv'))
reveal()
