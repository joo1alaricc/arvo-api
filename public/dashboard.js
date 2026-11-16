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

const load = () => api('/dashboard').then((d) => {
  count('req', d.requests); count('ep', d.endpoints); count('usr', d.users)
  base = { uptime_ms: d.uptime_ms, at: Date.now() }; tickUptime()
  drawMetrics(d.days)
}).catch((e) => { if (!base) $('#rm').innerHTML = `<p class="empty">${esc(e.message)}</p>` })

load()
setInterval(() => { if (!document.hidden) load() }, 30000)
setInterval(tickUptime, 15000)
