/* Halaman Dashboard: statistik publik dari /api/dashboard */
const nf = (n) => Number(n || 0).toLocaleString('id-ID')
const upt = (ms) => { const m = Math.floor(ms / 60000); return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h ${m % 60}m` }
const CARDS = [   /* [id, label, keterangan, ikon, warna] */
  ['req', 'Total Request', 'All server', 'trend', 'var(--blue)'],
  ['ep', 'Total Endpoint', 'Available', 'grid', 'var(--g)'],
  ['up', 'Server Uptime', 'Since last restart', 'clock', '#2dbfae'],
  ['usr', 'Total User', 'Terdaftar', 'user', 'var(--amber)'],
]
$('#rmi').innerHTML = tile('activity')
$('#stats').innerHTML = CARDS.map(([id, label, note, icon, c]) =>
  `<div class="stat skel" id="s-${id}" style="--c:${c}"><div><small>${label}</small><b>0</b><small>${note}</small></div><span class="ico">${ico(icon)}</span></div>`).join('')

const setVal = (id, text) => { const el = $(`#s-${id}`); el.classList.remove('skel'); el.querySelector('b').textContent = text }
/* angka naik halus dari nilai lama ke nilai baru */
const shown = {}
const count = (id, to) => {
  const from = shown[id] || 0, t0 = performance.now(), dur = from ? 400 : 900
  shown[id] = to
  const step = (t) => { const k = Math.min(1, (t - t0) / dur); setVal(id, nf(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))))); if (k < 1) requestAnimationFrame(step) }
  requestAnimationFrame(step)
}

let base = null   /* { uptime_ms, at } supaya uptime terus berjalan tanpa menunggu refresh */
const tickUptime = () => { if (base) setVal('up', upt(base.uptime_ms + (Date.now() - base.at))) }

const dayKey = (off) => new Date(Date.now() + 7 * 3600e3 - off * 864e5).toISOString().slice(0, 10)
const drawMetrics = (days) => {
  const by = Object.fromEntries((days || []).map((d) => [d.day, d.n]))
  const series = Array.from({ length: 14 }, (_, i) => { const k = dayKey(13 - i); return { day: k, n: by[k] || 0 } })
  const max = Math.max(1, ...series.map((d) => d.n)), total = series.reduce((a, d) => a + d.n, 0), peak = Math.max(...series.map((d) => d.n))
  $('#rm').innerHTML = `<div class="chart">${series.map((d, i) => `<div class="cb ${i === 13 ? 'today' : ''}" title="${esc(d.day)}: ${nf(d.n)} request"><span class="cv">${d.n ? (d.n >= 1000 ? Math.round(d.n / 100) / 10 + 'k' : d.n) : ''}</span><div class="bw"><i style="height:${d.n ? Math.max(8, (d.n / max) * 100) : 2}%"></i></div><em>${d.day.slice(8)}</em></div>`).join('')}</div>
    <div class="tiles rm-sum">
      <div class="tile" style="--c:var(--g)"><div><small>Hari ini</small><b>${nf(series[13].n)}</b></div></div>
      <div class="tile" style="--c:var(--blue)"><div><small>Rata-rata / hari</small><b>${nf(Math.round(total / 14))}</b></div></div>
      <div class="tile" style="--c:var(--amber)"><div><small>Tertinggi</small><b>${nf(peak)}</b></div></div>
      <div class="tile" style="--c:var(--mut)"><div><small>Total 14 hari</small><b>${nf(total)}</b></div></div>
    </div>`
}

/* ---------- Status & Info API ---------- */
$('#sii').innerHTML = tile('activity'); $('#cki').innerHTML = tile('key')
const drawInfo = (d) => {
  $('#si').innerHTML = `
    <div class="kv"><span>Status</span><b><span class="badge online"><i class="dot up"></i>Online</span></b></div>
    <div class="kv"><span>Base URL</span><b><code>${esc(location.origin)}</code></b></div>
    <div class="kv"><span>Page Views</span><b>${nf(d.page_views)}</b></div>
    <div class="kv"><span>Blocked IP</span><b><span class="badge bad">${nf(d.blocked)}</span></b></div>`
}

/* ---------- Cek Apikey ---------- */
const KT = { apikey: ['API Key', 'arvo_xxxxxxxx'], accesskey: ['Access Key', 'acc_xxxxxxxxxxxx'] }
$('#ckt').onchange = () => { const [l, ph] = KT[$('#ckt').value]; $('#ckk').setAttribute('aria-label', l); $('#ckk').placeholder = ph; $('#ckr').innerHTML = ''; say($('#ckm'), '') }
const fmtLimit = (n) => (n === null || n === undefined ? 'Unlimited' : nf(n))
const fmtExp = (v) => (/^\d{4}-\d{2}-\d{2}T/.test(v) ? fmtDate(v) : v === 'Permanent' ? 'Permanen' : v === 'Expired' ? 'Kedaluwarsa' : v === 'No Subscription Found' ? 'Belum berlangganan' : v)
const drawKey = (r) => {
  const tiles = [['Limit harian', fmtLimit(r.limit), 'var(--blue)'], ['Hit hari ini', nf(r.todayHit), 'var(--g)'], ['Total hit', nf(r.totalHit), 'var(--amber)'], ['Berlaku sampai', fmtExp(r.expired), 'var(--mut)']]
  $('#ckr').innerHTML = `<div class="card ck-res"><div class="card-h"><span>${tile('user')}</span>Hasil Pengecekan</div><div class="card-b">
    <div class="ck-id"><span class="ico">${ico(r.admin ? 'shield' : 'user')}</span><div><b>${esc(r.username)}</b><small>${esc(r.email || 'Email belum diisi')}</small></div><span class="badge ${r.admin ? 'owner' : /free/i.test(r.role) ? '' : 'premium'}">${esc(r.role)}</span></div>
    <div class="ck-tiles">${tiles.map(([l, v, c]) => `<div class="tile" style="--c:${c}"><div><small>${l}</small><b class="sm">${esc(v)}</b></div></div>`).join('')}</div>
    <div class="kv"><span>Key</span><b><code>${esc(r.apikey)}</code></b></div>
    ${r.defaultapikey && r.defaultapikey !== r.apikey ? `<div class="kv"><span>API Key default</span><b><code>${esc(r.defaultapikey)}</code></b></div>` : ''}
    <div class="kv"><span>Nomor</span><b>${esc(r.nomor || '–')}</b></div>
    <div class="kv"><span>Role admin</span><b><span class="badge ${r.admin ? 'online' : ''}">${r.admin ? 'Ya' : 'Bukan'}</span></b></div>
    <div class="ck-h">IP yang pernah memakai (${r.dataIP.length})</div>
    ${r.dataIP.length ? `<div class="ck-ips">${r.dataIP.map((x) => `<div class="ck-ip"><div><code>${esc(x.ip)}</code><span class="badge ${x.whitelisted ? 'online' : 'warn'}">${x.whitelisted ? 'Whitelist' : 'Belum whitelist'}</span><span class="badge">${esc(x.accessType)}</span><small class="sp">${nf(x.count)} hit</small></div>
      <small>Pertama: ${esc(fmtDT(x.createdAt))} · Terakhir: ${esc(fmtDT(x.lastUsed))}</small></div>`).join('')}</div>` : '<p class="empty">Belum ada IP tercatat.</p>'}
  </div></div>`
}
const submitKey = async () => {
  const key = $('#ckk').value.trim(), b = $('#ckb')
  if (!key) return say($('#ckm'), 'Isi key dulu.', true)
  b.disabled = true; say($('#ckm'), 'Memeriksa…')
  try { const j = await put('/checkkey', { type: $('#ckt').value, key }, 'POST'); say($('#ckm'), ''); drawKey(j.result) }
  catch (e) { $('#ckr').innerHTML = ''; say($('#ckm'), e.message, true) }
  b.disabled = false
}
$('#ckb').onclick = submitKey
$('#ckk').onkeydown = (e) => { if (e.key === 'Enter') submitKey() }

/* Admin yang sedang login: tampilkan Access Key miliknya (user biasa dapat 403/401, diabaikan) */
const showMyKey = (k) => {
  const box = $('#mykey'); box.hidden = false
  box.innerHTML = `<small>Access Key kamu (admin)</small><div class="kline"><code>${esc(k)}</code><button class="btn sm ib2" type="button" id="mkc" data-txt="1" title="Salin" aria-label="Salin">${ico('copy')}<span>Salin</span></button><button class="btn sm ib2 ghost" type="button" id="mkr" title="Buat key baru" aria-label="Buat key baru">${ico('refresh')}</button></div>`
  $('#mkc').onclick = (e) => copy(k, e.currentTarget)
  $('#mkr').onclick = async () => { if (!confirm('Buat Access Key baru? Key lama langsung tidak berlaku.')) return; try { showMyKey((await put('/auth/me/accesskey/reset', {}, 'POST')).access_key) } catch (e) { toast(e.message) } }
}
api('/auth/me/accesskey').then((j) => showMyKey(j.access_key)).catch(() => {})

const load = () => api('/dashboard').then((d) => {
  count('req', d.requests); count('ep', d.endpoints); count('usr', d.users)
  base = { uptime_ms: d.uptime_ms, at: Date.now() }; tickUptime()
  drawInfo(d); drawMetrics(d.days)
}).catch((e) => { if (!base) { $('#si').innerHTML = `<p class="empty">${esc(e.message)}</p>`; $('#rm').innerHTML = `<p class="empty">${esc(e.message)}</p>` } })

load()
setInterval(() => { if (!document.hidden) load() }, 30000)
setInterval(tickUptime, 15000)

/* ---------- Contributor, Syarat & Ketentuan, Thanks To (dikelola admin) ---------- */
const initial = (n) => esc(String(n || '?').trim().charAt(0).toUpperCase())
const drawSite = (d) => {
  const box = $('#site'), parts = []
  const card = (title, body) => `<div class="card"><div class="card-h">${title}</div><div class="card-b">${body}</div></div>`
  if (d.contributors.length) parts.push(card('Contributor', `<div class="ctb">${d.contributors.map((x) => {
    const av = x.avatar ? `<img src="${esc(x.avatar)}" alt="" loading="lazy">` : `<span>${initial(x.name)}</span>`
    const nm = x.website ? `<a href="${esc(x.website)}" target="_blank" rel="noopener noreferrer"><b>${esc(x.name)}</b></a>` : `<b>${esc(x.name)}</b>`
    return `<div class="ctb-i"><div class="ctb-a">${av}</div><div>${nm}<small>${esc(x.role)}</small></div></div>`
  }).join('')}</div>`))
  if (d.thanks.length) parts.push(card('Thanks To', `<ul class="sk-l">${d.thanks.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`))
    const CV = '<svg class="tnc-cv" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
  const wrap = (inner) => `<div class="tnc-c"><div class="tnc-ci">${inner}</div></div>`
  const point = (p, k, i) => {
    const head = `<span>${i + 1}.${k + 1}</span>`
    if (!p.desc) return `<div class="tnc-p">${head}<div><b>${esc(p.title)}</b></div></div>`
    return `<div class="tnc-p tnc-x">${head}<div class="tnc-pw"><button type="button" class="tnc-tg tnc-pt" aria-expanded="false"><b>${esc(p.title)}</b>${CV}</button>${wrap(`<p class="tnc-d">${esc(p.desc)}</p>`)}</div></div>`
  }
  const term = (t, i) => {
    const num = `<span>${i + 1}.</span> ${esc(t.title)}`
    const pts = t.points || []
    if (!t.desc && !pts.length) return `<div class="tnc-i"><div class="tnc-t">${num}</div></div>`
    const inner = `${t.desc ? `<p class="tnc-d">${esc(t.desc)}</p>` : ''}${pts.map((p, k) => point(p, k, i)).join('')}`
    return `<div class="tnc-i tnc-x"><button type="button" class="tnc-tg tnc-t" aria-expanded="false"><span class="tnc-tt">${num}</span>${CV}</button>${wrap(inner)}</div>`
  }
  if (d.terms.length) parts.push(card('Syarat dan Ketentuan', `<div class="tnc">${d.terms.map(term).join('')}</div>`))
  box.innerHTML = parts.join('')
  box.querySelectorAll('.tnc-tg').forEach((b) => (b.onclick = () => {
    const x = b.closest('.tnc-x'), o = !x.classList.contains('open')
    x.classList.toggle('open', o); b.setAttribute('aria-expanded', o)
  }))
}
api('/site-content').then(drawSite).catch(() => {})
