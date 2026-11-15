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

fetch('/docs').then(async (r) => {
  $('#s-ep').textContent = Object.keys((await r.json()).paths || {}).length
  $('#dot').className = 'dot up'; $('#status').textContent = 'Semua sistem berjalan'
}).catch(() => { $('#dot').className = 'dot down'; $('#status').textContent = 'Server tidak dapat dijangkau' })
let session = {}
ready.then((s) => {
  session = s; $('#s-ip').textContent = s.who.ip
  const q = s.who.quota
  $('#s-rl').textContent = !q ? '–' : q.unlimited ? 'Unlimited' : `${q.remaining}/${q.limit}`
})

const price = (p, d, perm) => perm ? p.permanentPrice : Math.max(1000, Math.ceil(p.basePrice * d / p.baseDays / 100) * 100)
const feats = (p) => [
  p.daily === null ? 'Request unlimited' : `${p.daily.toLocaleString('id-ID')} request / hari`,
  'Akses API premium', `Whitelist IP hingga ${p.maxIps} IP`, p.customKey ? 'Custom API key' : null,
].filter(Boolean).map((f) => `<li>${f}</li>`).join('')

api('/billing/plans').then(({ plans, min_days, max_days }) => {
  $('#plans').innerHTML = ''
  plans.forEach((p) => {
    const el = document.createElement('article'); el.className = 'rv plan ' + p.tier
    const timed = !!p.basePrice, perm = !!p.permanentPrice
    let days = timed ? p.baseDays : 0, permanent = !timed
    el.innerHTML = `<span class="tag">${p.tier === 'vip' ? 'VIP' : 'Premium'}</span><h3>${p.name}</h3>
      <div class="price"></div><ul>${feats(p)}</ul><div class="chips"></div><button class="btn">Beli ${p.name}</button>`
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
    draw(); el.querySelector('.btn').onclick = () => buy(p.id, days, permanent); $('#plans').append(el)
  })
  reveal($('#plans'))
}).catch((e) => ($('#plans').innerHTML = `<p class="err">${esc(e.message)}</p>`))

let poll
const dlg = $('#pay'), body = $('#paybody')
$('#payclose').onclick = () => { clearInterval(poll); dlg.close() }
const view = (o) => {
  if (o.status === 'paid') {
    body.innerHTML = `<h3>Pembayaran berhasil</h3><p class="sub">${esc(o.name)} sudah aktif di akunmu.</p><a class="btn" href="/profile.html">Buka profil</a>`
    clearInterval(poll); return
  }
  if (o.status !== 'pending') { body.innerHTML = '<h3>Order tidak aktif</h3><p class="sub">Silakan buat order baru.</p>'; clearInterval(poll); return }
  body.innerHTML = `<h3>${esc(o.name)}${o.days ? ` · ${o.days} hari` : ' · permanen'}</h3>
    <img alt="QRIS" src="${o.qris.image}"><div class="big">${rp(o.total)}</div>
    <p class="sub">Bayar <b>persis</b> sesuai nominal (kode unik ikut dihitung). Halaman ini otomatis berubah setelah terkonfirmasi. ID order: <span class="mono">${o.id}</span></p>`
}
async function buy(plan, days, permanent) {
  if (!session.user) { location.href = '/login.html?next=' + encodeURIComponent('/#paket'); return }
  body.textContent = 'Membuat order…'; dlg.showModal()
  try {
    const o = await put('/billing/orders', { plan, days, permanent }, 'POST')
    view(o); clearInterval(poll)
    poll = setInterval(async () => { try { view(await api('/billing/orders/' + o.id)) } catch {} }, 4000)
  } catch (e) { body.innerHTML = `<p class="err">${esc(e.message)}</p>` }
}

/* muncul halus saat scroll untuk bagian di bawah hero */
document.querySelectorAll('main > section:not(.hero) > h2, main > section > .sub, .steps li, #cara .code, details').forEach((e) => e.classList.add('rv'))
reveal()
