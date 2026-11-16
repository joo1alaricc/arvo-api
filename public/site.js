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

fetch('/api/catalog').then(async (r) => {
  $('#s-ep').textContent = Object.keys((await r.json()).paths || {}).length
  $('#dot').className = 'dot up'; $('#status').textContent = 'Semua sistem berjalan'
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
const feats = (p) => [
  p.daily === null ? 'Request unlimited' : `${p.daily.toLocaleString('id-ID')} request / hari`,
  p.tier === 'vip' ? 'Akses semua endpoint (termasuk khusus VIP)' : 'Akses endpoint Premium', `Whitelist IP hingga ${p.maxIps} IP`, p.customKey ? 'Custom API key' : null,
  p.tier === 'vip' ? 'Badge VIP' : 'Badge Premium',
  p.tier === 'vip' ? 'Profil centang gold & username gold berkilau' : 'Profil centang biru berkilau',
  p.tier === 'vip' ? 'Border profil custom (pilih warna sendiri)' : null,
].filter(Boolean).map((f) => `<li>${f}</li>`).join('')

Promise.all([api('/billing/plans'), ready]).then(([{ plans, min_days, max_days }, { user }]) => {
  const stacking = !!(user && user.active)
  $('#plans').innerHTML = ''
  plans.forEach((p) => {
    const el = document.createElement('article'); el.className = 'rv plan ' + p.tier + (p.id === BEST ? ' best' : '')
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
  reveal($('#plans'))
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
    stop(); return
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
    view(o); stop()
    poll = setInterval(async () => { try { view(await api('/billing/orders/' + o.id)) } catch {} }, 4000)
  } catch (e) { closeBtn.textContent = 'Tutup'; body.innerHTML = `<p class="err">${esc(e.message)}</p>` }
}

/* muncul halus saat scroll untuk bagian di bawah hero */
document.querySelectorAll('main > section:not(.hero) > h2, main > section > .sub, .steps li, #cara .code, details').forEach((e) => e.classList.add('rv'))
reveal()
