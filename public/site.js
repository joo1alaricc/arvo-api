const $ = (s) => document.querySelector(s)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const rp = (n) => 'Rp' + Number(n).toLocaleString('id-ID')
const api = async (path, opt = {}) => {
  const r = await fetch('/api/billing' + path, { ...opt, headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.message || 'Terjadi kesalahan')
  return j
}
const copy = (t, b) => navigator.clipboard.writeText(t).then(() => { const o = b.textContent; b.textContent = 'Tersalin'; setTimeout(() => (b.textContent = o), 1500) })

/* tema */
const root = document.documentElement
root.dataset.theme = localStorage.getItem('theme') || 'dark'
const syncTheme = () => ($('#theme').textContent = root.dataset.theme === 'dark' ? 'Terang' : 'Gelap')
$('#theme').onclick = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('theme', root.dataset.theme); syncTheme() }
syncTheme()

/* contoh kode */
const SN = {
  curl: `curl 'https://${location.host}/api/premium/ping' \\\n  --header 'x-api-key: KEY_KAMU'`,
  js: `const res = await fetch('https://${location.host}/api/premium/ping', {\n  headers: { 'x-api-key': 'KEY_KAMU' }\n})\nconsole.log(await res.json())`,
  py: `import requests\n\nr = requests.get('https://${location.host}/api/premium/ping',\n                 headers={'x-api-key': 'KEY_KAMU'})\nprint(r.json())`,
}
document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); $('#snip').textContent = SN[b.dataset.t]
}))
$('#snip').textContent = SN.curl

/* status & statistik */
fetch('/docs').then(async (r) => {
  const l = r.headers.get('x-ratelimit-limit'), m = r.headers.get('x-ratelimit-remaining')
  $('#s-rl').textContent = l === 'UNLIMITED' ? 'Unlimited' : m ? `${m}/${l}` : '–'
  const j = await r.json(); $('#s-ep').textContent = Object.keys(j.paths || {}).length
  $('#dot').className = 'dot up'; $('#status').textContent = 'Semua sistem berjalan'
}).catch(() => { $('#dot').className = 'dot down'; $('#status').textContent = 'Server tidak dapat dijangkau' })
let me = {}
api('/whoami').then((w) => { me = w; $('#s-ip').textContent = w.ip; if (w.is_owner) { $('#owner').hidden = false; loadOrders() } }).catch(() => {})

/* paket */
const price = (p, d, perm) => perm ? p.permanentPrice : Math.max(1000, Math.ceil(p.basePrice * d / p.baseDays / 100) * 100)
const feats = (p) => [
  p.daily === null ? 'Request unlimited' : `${p.daily.toLocaleString('id-ID')} request / hari`,
  'Akses API premium', `Whitelist IP hingga ${p.maxIps} IP`, p.customKey ? 'Custom API key' : null,
].filter(Boolean).map((f) => `<li>${f}</li>`).join('')

api('/plans').then(({ plans, min_days, max_days }) => {
  $('#plans').innerHTML = ''
  plans.forEach((p) => {
    const el = document.createElement('article'); el.className = 'plan ' + p.tier
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
}).catch((e) => ($('#plans').innerHTML = `<p class="err">${esc(e.message)}</p>`))

/* checkout */
let poll
const dlg = $('#pay'), body = $('#paybody')
$('#payclose').onclick = () => { clearInterval(poll); dlg.close() }
const view = (o) => {
  if (o.status === 'paid') {
    localStorage.setItem('arvo_key', o.api_key)
    body.innerHTML = `<h3>Pembayaran berhasil</h3><p class="sub">${esc(o.name)} aktif. Simpan key ini:</p><div class="keybox">${esc(o.api_key)}</div><button class="btn" id="ck">Salin key</button>`
    $('#ck').onclick = (e) => copy(o.api_key, e.target); $('#mkey').value = o.api_key; clearInterval(poll); return
  }
  if (o.status === 'expired') { body.innerHTML = '<h3>Order kedaluwarsa</h3><p class="sub">Silakan buat order baru.</p>'; clearInterval(poll); return }
  body.innerHTML = `<h3>${esc(o.name)}${o.days ? ` · ${o.days} hari` : ' · permanen'}</h3>
    <img alt="QRIS" src="${o.qris.image}"><div class="big">${rp(o.total)}</div>
    <p class="sub">Bayar <b>persis</b> sesuai nominal (kode unik ikut dihitung). Halaman ini otomatis berubah setelah pembayaran terkonfirmasi. ID order: <span class="mono">${o.id}</span></p>`
}
async function buy(plan, days, permanent) {
  body.textContent = 'Membuat order…'; dlg.showModal()
  try {
    const o = await api('/orders', { method: 'POST', body: JSON.stringify({ plan, days, permanent, renew_key: $('#renew').value.trim() || undefined }) })
    o.status = 'pending'; view(o)
    clearInterval(poll)
    poll = setInterval(async () => { try { view(await api('/orders/' + o.id)) } catch {} }, 4000)
  } catch (e) { body.innerHTML = `<p class="err">${esc(e.message)}</p>` }
}

/* kelola key */
$('#mkey').value = localStorage.getItem('arvo_key') || ''
const hdr = () => ({ 'x-api-key': $('#mkey').value.trim() })
async function loadMe() {
  const box = $('#minfo')
  try {
    const m = await api('/me', { headers: hdr() })
    localStorage.setItem('arvo_key', $('#mkey').value.trim())
    box.innerHTML = `<div class="kv">
      <div><b>${esc(m.name)}</b><span>Paket</span></div>
      <div><b>${m.expires_at ? new Date(m.expires_at).toLocaleDateString('id-ID') + (m.expired ? ' (habis)' : '') : 'Permanen'}</b><span>Masa aktif</span></div>
      <div><b>${m.used_today.toLocaleString('id-ID')} / ${m.daily_limit === null ? '∞' : m.daily_limit.toLocaleString('id-ID')}</b><span>Request hari ini</span></div>
      <div><b>${m.total_requests.toLocaleString('id-ID')}</b><span>Total request</span></div></div>
      <label>Whitelist IP (satu per baris, maks ${m.max_ips}; kosong = semua IP boleh)</label>
      <textarea id="ips">${esc(m.ips.join('\n'))}</textarea>
      <div class="row"><button class="btn" id="sv">Simpan whitelist</button><button class="btn ghost" id="myip">Tambah IP saya</button></div>
      ${m.custom_key ? '<div class="row" style="margin-top:16px"><input id="nk" placeholder="Custom API key baru (10-40 karakter)"><button class="btn ghost" id="sk">Ganti key</button></div>' : ''}
      <p class="msg" id="mm"></p>`
    const say = (t, bad) => { $('#mm').textContent = t; $('#mm').className = 'msg' + (bad ? ' err' : '') }
    $('#myip').onclick = () => { const t = $('#ips'); t.value = [...new Set([...t.value.split('\n').filter(Boolean), me.ip])].join('\n') }
    $('#sv').onclick = async () => {
      try { await api('/me/ips', { method: 'PUT', headers: hdr(), body: JSON.stringify({ ips: $('#ips').value.split('\n') }) }); say('Whitelist tersimpan.') } catch (e) { say(e.message, 1) }
    }
    if (m.custom_key) $('#sk').onclick = async () => {
      try { const r = await api('/me/key', { method: 'PUT', headers: hdr(), body: JSON.stringify({ new_key: $('#nk').value.trim() }) }); $('#mkey').value = r.api_key; localStorage.setItem('arvo_key', r.api_key); say('Key diganti: ' + r.api_key) } catch (e) { say(e.message, 1) }
    }
  } catch (e) { box.innerHTML = `<p class="msg err">${esc(e.message)}</p>` }
}
$('#mload').onclick = loadMe
if ($('#mkey').value) loadMe()

/* panel owner */
async function loadOrders() {
  try {
    const { orders } = await api('/admin/orders')
    $('#orders').innerHTML = orders.length ? orders.map((o) => `<div class="ord"><span><b>${esc(o.plan)}</b> ${rp(o.total)} · ${esc(o.status)} · ${esc(o.ip)}</span>${o.status === 'pending' ? `<button class="btn" data-id="${o.id}">Konfirmasi</button>` : ''}</div>`).join('') : '<p class="sub">Belum ada order.</p>'
    $('#orders').querySelectorAll('button').forEach((b) => (b.onclick = async () => { try { await api(`/admin/orders/${b.dataset.id}/confirm`, { method: 'POST' }); loadOrders() } catch (e) { alert(e.message) } }))
  } catch (e) { $('#orders').textContent = e.message }
}
