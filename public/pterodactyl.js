/* Tools › Panel Pterodactyl: beli panel (QRIS BTZ, dibuat otomatis) dan kelola server langsung di sini:
 * konsol live, power, file manager, startup. Semua lewat server Arvo; browser tidak pernah memegang kunci panel. */
const el = $('#app'); el.classList.add('pt')
{ const st = document.createElement('style')
  st.textContent = `.pt [hidden]{display:none!important}.pt{max-width:920px}.pt h1{font-size:19px;margin:0 0 2px}.pt>.sub{font-size:12.5px;line-height:1.45;margin:0 0 12px}
.pt .card{margin-bottom:10px}.pt .card-h{padding:10px 12px;font-size:13px}.pt .card-b{padding:11px 12px;display:grid;gap:8px}
.pt input,.pt textarea,.pt select{width:100%;padding:9px 11px}.pt .btn{padding:9px 14px}.pt .btn.sm{padding:6px 12px;font-size:12.5px}
.pt .msg{margin:0;font-size:12.5px;white-space:pre-wrap;overflow-wrap:anywhere}.pt .msg:empty{display:none}.pt .hint{font-size:12px;color:var(--mut);line-height:1.45;margin:0}
.pt-st{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11.5px;font-weight:700;border:1px solid;white-space:nowrap}
.pt-st.ok{color:var(--g,#4ade80);background:color-mix(in srgb,var(--g,#4ade80) 13%,transparent)}.pt-st.wait{color:#f5a524;background:color-mix(in srgb,#f5a524 13%,transparent)}
.pt-st.bad{color:var(--bad,#ef4444);background:color-mix(in srgb,#ef4444 13%,transparent)}.pt-st.off{color:var(--mut);background:color-mix(in srgb,var(--mut) 12%,transparent)}
.pt-srv{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--line);border-radius:12px;padding:10px 12px}.pt-srv>div{flex:1;min-width:150px}
.pt-srv b{display:block;font-size:14px;overflow-wrap:anywhere}.pt-srv small{color:var(--mut);font-size:12px}
.pt-plans{display:grid;grid-template-columns:repeat(auto-fill,minmax(152px,1fr));gap:8px}
.pt-pl{border:1px solid var(--line);border-radius:12px;padding:10px 12px;cursor:pointer;display:grid;gap:2px;background:none;color:var(--tx);font:inherit;text-align:left}
.pt-pl.on{border-color:var(--ac);background:color-mix(in srgb,var(--ac) 11%,transparent)}.pt-pl{padding:9px 10px}.pt-pl b{font-size:13.5px}.pt-pl .pr{font-size:14.5px;font-weight:800;margin-top:4px}.pt-pl small{color:var(--mut);font-size:12px}
.pt-chips{display:flex;gap:6px;flex-wrap:wrap}.pt-chips button{border:1px solid var(--line);background:none;color:var(--tx);border-radius:99px;padding:5px 12px;font:600 12px inherit;font-family:inherit;cursor:pointer}
.pt-chips button.on{border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent)}.pt-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.pt-row>input{flex:1;min-width:120px}
.pt-qr{display:grid;gap:8px;justify-items:center;border:1px solid var(--line);border-radius:12px;padding:12px}.pt-qr img{width:100%;max-width:230px;background:#fff;border-radius:10px;padding:6px}
.pt-tabs{display:flex;gap:4px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin-bottom:2px}.pt-tabs button{border:0;background:none;color:var(--mut);font:600 13px inherit;font-family:inherit;padding:8px 12px;cursor:pointer;border-bottom:2px solid transparent}
.pt-tabs button.on{color:var(--tx);border-bottom-color:var(--ac)}
.pt-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}.pt-stats div{border:1px solid var(--line);border-radius:10px;padding:7px 10px}.pt-stats small{display:block;color:var(--mut);font-size:11px}.pt-stats b{font-size:13px}
.pt-term{background:#0b0e13;color:#d6dbe4;border:1px solid var(--line);border-radius:10px;padding:10px;height:380px;overflow:auto;font:12px/1.5 'JetBrains Mono',ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.pt-term div{min-height:1.5em}.pt-files{border:1px solid var(--line);border-radius:10px;overflow:auto;max-height:430px}
.pt-f{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--line);font-size:13px}.pt-f:last-child{border-bottom:0}
.pt-f .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:none;border:0;color:var(--tx);font:inherit;text-align:left;cursor:pointer;padding:3px 0}
.pt-f .s{color:var(--mut);font-size:11.5px;white-space:nowrap}.pt-f button.i{border:0;background:none;color:var(--mut);cursor:pointer;font:600 11.5px inherit;font-family:inherit;padding:3px 6px;border-radius:6px}
.pt-f button.i:hover{color:var(--tx);background:color-mix(in srgb,var(--mut) 14%,transparent)}.pt-f input[type=checkbox]{width:auto;padding:0}
.pt-ed{min-height:340px;font:12.5px/1.5 'JetBrains Mono',ui-monospace,monospace;white-space:pre;resize:vertical}.pt-crumb{font-size:12.5px;color:var(--mut);overflow-wrap:anywhere}.pt-crumb a{color:var(--ac);cursor:pointer}
.pt-var{display:grid;gap:4px;border:1px solid var(--line);border-radius:10px;padding:9px 10px}.pt-var b{font-size:13px}.pt-var small{color:var(--mut);font-size:11.5px}`
  document.head.append(st) }

/* toast lokal (ui.js hanya dimuat di halaman admin) */
const toast = (t) => { const d = document.createElement('div'); d.textContent = t; d.setAttribute('role', 'status'); d.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 16px;border-radius:12px;font-size:13px;z-index:9999;box-shadow:0 8px 30px #0006;max-width:90vw;text-align:center'; document.body.append(d); setTimeout(() => d.remove(), 3200) }
const nf = (n) => Number(n || 0).toLocaleString('id-ID')
const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)) } catch {} return null }
const note = (e, t, bad) => { if (!e) return; e.textContent = t; e.className = 'msg' + (bad ? ' err' : ''); e.style.cssText = bad || !t ? '' : 'color:var(--g)' }
const fdt = (x) => { const d = new Date(x); return Number.isNaN(+d) ? '–' : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
const bytes = (n) => { n = Number(n) || 0; const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (n >= 1024 && i < 4) { n /= 1024; i++ } return (i ? (n >= 100 ? Math.round(n) : n.toFixed(n < 10 ? 2 : 1)) : Math.round(n)) + ' ' + u[i] }
const mb = (n) => (n ? nf(n) + ' MB' : 'Unlimited')
const upt = (ms) => { let s = Math.floor((Number(ms) || 0) / 1000); const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; return (d ? d + 'h ' : '') + h + 'j ' + Math.floor(s / 60) + 'm' }
const chip = (t, k) => `<span class="pt-st ${k}">${esc(t)}</span>`
const API = '/tools/ptero'
const DEPK = 'arvo_ptero_ord'
const S = { plans: [], ready: false, plan: 'p1', days: 30, poll: null, servers: [], orders: [], tick: null, ws: null, wsTimer: null, ping: null }
const priceOf = (p, d) => Math.max(1000, Math.ceil((p.price * d) / 30 / 100) * 100)
const planOf = (id) => S.plans.find((p) => p.id === id)
const stOf = (s) => (s.status === 'suspended' ? chip('Ditangguhkan', 'bad') : s.expired ? chip('Kedaluwarsa', 'bad') : chip('Aktif', 'ok'))
const left = (t) => { const ms = t - Date.now(); if (ms <= 0) return 'sudah habis'; const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5); return d ? `${d} hari ${h} jam lagi` : `${h} jam lagi` }

/* =================== BERANDA: server saya + beli =================== */
const closeLive = () => { clearInterval(S.poll); clearInterval(S.tick); clearInterval(S.ping); clearTimeout(S.wsTimer); if (S.ws) { S.ws.onclose = null; try { S.ws.close() } catch {} S.ws = null } }
const home = async () => {
  closeLive()
  el.innerHTML = `<h1>Panel Pterodactyl</h1><p class="sub">Sewa panel server (bot WhatsApp, game, aplikasi) yang langsung jadi setelah bayar QRIS. Semua dikelola di sini: konsol live, file, start/stop. Tidak perlu membuka panel lain.</p>
  <div class="card"><div class="card-h"><span>Server saya</span></div><div class="card-b" id="sv"><p class="hint">Memuat…</p></div></div>
  <div class="card" id="pay" hidden></div>
  <div class="card"><div class="card-h"><span>Beli panel baru</span></div><div class="card-b" id="buy"><p class="hint">Memuat paket…</p></div></div>`
  loadServers(); await loadPlans(); drawBuy(); resumePay()
}
const loadPlans = async () => { try { const r = await api(API + '/plans'); S.plans = r.plans; S.ready = r.ready; S.min = r.min_days; S.max = r.max_days } catch (e) { const b = $('#buy'); if (b) b.innerHTML = `<p class="msg err">${esc(e.message)}</p>` } }
const loadServers = async () => {
  try {
    const r = await api(API + '/servers'); S.servers = r.servers; S.orders = r.orders
    const sv = $('#sv'); if (!sv) return
    const rows = r.servers.map((s) => `<div class="pt-srv"><div><b>${esc(s.name)}</b><small>${esc(s.plan_name)} · habis ${esc(fdt(s.expires_at))} (${esc(left(s.expires_at))})</small></div>${stOf(s)}
      <button class="btn sm" data-m="${s.id}" type="button"${s.status !== 'active' || s.expired ? ' disabled' : ''}>Kelola</button><button class="btn ghost sm" data-r="${s.id}" type="button">Perpanjang</button></div>`).join('')
    const pend = r.orders.filter((o) => o.status !== 'pending').map((o) => `<div class="pt-srv"><div><b>${o.kind === 'renew' ? 'Perpanjangan' : 'Server baru'} · ${esc((planOf(o.plan) || {}).name || o.plan)}</b><small>${o.status === 'failed' ? 'Pembayaran diterima. Panel sedang disiapkan ulang otomatis…' : 'Pembayaran diterima. Panel sedang dibuat…'}</small></div>${chip(o.status === 'failed' ? 'Mencoba ulang' : 'Diproses', 'wait')}</div>`).join('')
    sv.innerHTML = (rows || pend) ? rows + pend : '<p class="hint">Belum ada server. Pilih paket di bawah untuk memulai.</p>'
    sv.onclick = (e) => { const m = e.target.closest('[data-m]'), rn = e.target.closest('[data-r]'); if (m) location.hash = 's=' + m.dataset.m; if (rn) renew(+rn.dataset.r) }
    if (r.orders.some((o) => o.status !== 'pending')) setTimeout(() => { if ($('#sv')) loadServers() }, 6000)   /* masih diproses: segarkan otomatis */
  } catch (e) { const sv = $('#sv'); if (sv) sv.innerHTML = `<p class="msg err">${esc(e.message)}</p>` }
}
const drawBuy = () => {
  const b = $('#buy'); if (!b) return
  if (!S.ready) { b.innerHTML = '<p class="hint">Layanan belum tersedia. Admin masih menyiapkan panel.</p>'; return }
  const dur = [30, 60, 90, 180, 365].filter((d) => d >= S.min && d <= S.max)
  b.innerHTML = `<div class="pt-plans" id="pl">${S.plans.map((p) => `<button class="pt-pl${p.id === S.plan ? ' on' : ''}" data-p="${p.id}" type="button"><b>${esc(p.name)}</b>
      <small>RAM ${mb(p.memory)} · Disk ${mb(p.disk)}</small><small>CPU ${p.cpu ? p.cpu + '%' : 'Unlimited'}</small><span class="pr">${'Rp' + nf(p.price)}<small> /30 hari</small></span></button>`).join('')}</div>
    <div class="hint" style="margin-top:4px">Durasi (hari)</div>
    <div class="pt-chips" id="dc">${dur.map((d) => `<button type="button" data-d="${d}" class="${d === S.days ? 'on' : ''}">${d}</button>`).join('')}</div>
    <input id="dd" type="number" inputmode="numeric" min="${S.min}" max="${S.max}" step="1" value="${S.days}" aria-label="Durasi custom (hari)">
    <p class="hint" id="pp"></p><p class="msg" id="pm"></p>
    <button class="btn block" id="pb" type="button">Bayar dengan QRIS</button>`
  const upd = () => { const p = planOf(S.plan), d = S.days; const ok = Number.isInteger(d) && d >= S.min && d <= S.max; $('#pp').innerHTML = ok ? `${esc(p.name)} · ${d} hari → <b>${'Rp' + nf(priceOf(p, d))}</b> (belum termasuk kode unik QRIS)` : `Durasi ${S.min} sampai ${S.max} hari.`; $('#pb').disabled = !ok; document.querySelectorAll('#dc button').forEach((x) => x.classList.toggle('on', +x.dataset.d === d)) }
  $('#pl').onclick = (e) => { const x = e.target.closest('[data-p]'); if (!x) return; S.plan = x.dataset.p; document.querySelectorAll('.pt-pl').forEach((y) => y.classList.toggle('on', y === x)); upd() }
  $('#dc').onclick = (e) => { const x = e.target.closest('[data-d]'); if (!x) return; S.days = +x.dataset.d; $('#dd').value = S.days; upd() }
  $('#dd').oninput = (e) => { S.days = Math.floor(Number(e.target.value)); upd() }
  $('#pb').onclick = () => startOrder('/order', { plan: S.plan, days: S.days }, $('#pb'), $('#pm'))
  upd()
}
const renew = async (id) => {
  const s = S.servers.find((x) => x.id === id), p = s && planOf(s.plan); if (!p) return
  const raw = prompt(`Perpanjang ${s.name} (${p.name}) berapa hari? (${S.min}-${S.max})\n30 hari = Rp${nf(priceOf(p, 30))}`, '30'); if (raw === null) return
  const d = Math.floor(Number(raw)); if (!(d >= S.min && d <= S.max)) return toast(`Durasi ${S.min} sampai ${S.max} hari.`)
  await startOrder('/renew', { server: id, days: d }, null, $('#pm'))
}

/* =================== pembayaran QRIS =================== */
const startOrder = async (path, body, btn, msg) => {
  if (btn) btn.disabled = true
  if (msg && msg.classList) note(msg, 'Membuat pembayaran…')
  try {
    const r = await put(API + path, body, 'POST')
    LS(DEPK, { id: r.order, t: Date.now(), amount: r.amount, total: r.total_amount, qr: r.qr_url, pay: r.payment_url, exp: r.expired_at, kind: r.kind, plan: r.plan, days: r.days })
    if (msg && msg.classList) note(msg, '')
    if (!$('#pay')) { if (location.hash) location.hash = ''; else home(); return }   /* dari halaman kelola: pindah ke beranda, QR tampil di sana */
    showPay(); startPoll(); pollPay(false)
    $('#pay').scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch (e) { if (msg && msg.classList) note(msg, e.message, 1); else toast(e.message) }
  if (btn) btn.disabled = false
}
const payExpired = (d) => d.exp && Date.parse(d.exp) < Date.now()
const showPay = () => {
  const box = $('#pay'); if (!box) return
  const d = LS(DEPK)
  if (!d) { box.hidden = true; box.innerHTML = ''; return }
  const ex = payExpired(d), p = planOf(d.plan)
  box.hidden = false
  box.innerHTML = `<div class="card-h"><span>Pembayaran ${d.kind === 'renew' ? 'perpanjangan' : 'server baru'}</span></div><div class="card-b"><div class="pt-qr">
    ${ex ? '<p class="msg err" style="text-align:center">QR kedaluwarsa. Tutup lalu buat pembayaran baru.</p>' : d.qr ? `<img alt="QR pembayaran" src="${esc(d.qr)}">` : '<p class="hint">QR tidak tersedia, pakai link bayar.</p>'}
    <div style="text-align:center;font-size:13px">${esc(p ? p.name : '')} · ${d.days} hari<br>Total bayar <b>${'Rp' + nf(d.total)}</b><br><span class="hint">Berlaku sampai ${esc(fdt(d.exp))}</span></div>
    <div id="ps">${chip('Menunggu pembayaran', 'wait')}</div>
    ${d.pay && !ex ? `<a class="btn ghost sm" href="${esc(d.pay)}" target="_blank" rel="noopener noreferrer">Buka halaman bayar</a>` : ''}
    <button class="btn ghost sm" id="px" type="button">${ex ? 'Tutup' : 'Batalkan pembayaran'}</button></div>
    <p class="hint">Server dibuat otomatis begitu pembayaran terdeteksi (biasanya beberapa detik). Jangan tutup halaman ini; kalau tertutup, buka lagi dan lanjutkan dari sini.</p></div>`
  $('#px').onclick = async (e) => {
    const b = e.currentTarget
    if (ex) { LS(DEPK, null); clearInterval(S.poll); return showPay() }
    if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Yakin batalkan?'; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'Batalkan pembayaran' } }, 4000); return }
    b.disabled = true
    try { const r = await put(API + '/order-cancel', { order: d.id }, 'POST'); if (r.status === 'active') { toast('Pembayaran ternyata sudah diterima. Server dibuat.'); done() } else { LS(DEPK, null); clearInterval(S.poll); showPay(); toast('Pembayaran dibatalkan.') } }
    catch (er) { b.disabled = false; toast(er.message) }
  }
}
const done = () => { clearInterval(S.poll); LS(DEPK, null); showPay(); loadServers(); toast('Pembayaran diterima. Panel kamu siap!') }
const pollPay = async (manual) => {
  const d = LS(DEPK); if (!d) return clearInterval(S.poll)
  const ps = $('#ps')
  try {
    const r = await api(API + '/order-status?order=' + encodeURIComponent(d.id))
    if (r.status === 'active') return done()
    if (r.status === 'expired' || r.status === 'canceled') { clearInterval(S.poll); LS(DEPK, null); showPay(); toast('Pembayaran kedaluwarsa atau dibatalkan.') }
    else if (r.status === 'review') { clearInterval(S.poll); if (ps) ps.innerHTML = chip('Perlu diperiksa admin', 'bad') + '<p class="hint">Nominal pembayaran tidak sesuai. Hubungi admin dengan menyebut ID: ' + esc(d.id) + '</p>' }
    else if (r.status === 'provisioning' || r.status === 'failed') { if (ps) ps.innerHTML = chip('Pembayaran diterima, panel sedang dibuat…', 'ok') ; loadServers() }
    else if (ps) ps.innerHTML = chip('Menunggu pembayaran', 'wait')
  } catch (e) { if (e.status === 404) { clearInterval(S.poll); LS(DEPK, null); showPay() } else if (manual && ps) ps.innerHTML = `<span class="err">${esc(e.message)}</span>` }
}
const startPoll = () => { clearInterval(S.poll); S.poll = setInterval(() => { if (!document.hidden) pollPay(false) }, 4000) }
const resumePay = () => { const d = LS(DEPK); if (!d) return; if (Date.now() - d.t > 24 * 3600e3) return LS(DEPK, null); showPay(); pollPay(false); startPoll() }

/* =================== KELOLA SERVER =================== */
const SRV = { id: 0, tab: 'console', dir: '/', files: [], sel: new Set(), edit: null, lines: [], state: 'offline' }
const manage = async (id) => {
  closeLive(); Object.assign(SRV, { id, tab: 'console', dir: '/', files: [], sel: new Set(), edit: null, lines: [], state: 'offline' })
  el.innerHTML = '<p class="sub">Memuat server…</p>'
  let r
  try { r = await api(`${API}/s/${id}`) } catch (e) { el.innerHTML = `<p class="msg err">${esc(e.message)}</p><a class="btn ghost" href="#">Kembali</a>`; return }
  const s = r.server
  if (r.expired) { el.innerHTML = `<p><a href="#" class="sm-link">← Semua server</a></p><h1>${esc(s.name)}</h1><div class="card"><div class="card-b"><p class="msg err">Masa aktif server ini ${s.status === 'suspended' ? 'sudah habis dan server ditangguhkan' : 'sudah habis'}. Perpanjang untuk menggunakannya lagi (data tetap tersimpan selama masa tenggang).</p><button class="btn" id="rn" type="button">Perpanjang</button></div></div>`
    await Promise.all([loadPlans(), loadServers()]); $('#rn').onclick = () => renew(id); return }
  el.innerHTML = `<p style="margin:0 0 6px"><a href="#" style="color:var(--ac);font-size:13px">← Semua server</a></p>
  <h1>${esc(s.name)}</h1><p class="sub">${esc(s.plan_name)} · aktif sampai ${esc(fdt(s.expires_at))} (${esc(left(s.expires_at))})${r.server.panel_status === 'installing' ? ' · <b>sedang instalasi, tunggu sebentar</b>' : ''}</p>
  <div class="pt-stats" id="stt"></div>
  <div class="card" style="margin-top:10px"><div class="card-b"><div class="pt-tabs" id="tabs">${[['console', 'Konsol'], ['files', 'File'], ['startup', 'Startup'], ['settings', 'Pengaturan']].map(([k, t]) => `<button data-t="${k}" type="button" class="${k === 'console' ? 'on' : ''}">${t}</button>`).join('')}</div><div id="tab"></div></div></div>`
  $('#tabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b)); SRV.tab = b.dataset.t; drawTab() }
  setStats(r.state, r.resources); drawTab(); connectWs()
  S.tick = setInterval(() => { if (!document.hidden && (!S.ws || S.ws.readyState !== 1)) api(`${API}/s/${id}`).then((x) => setStats(x.state, x.resources)).catch(() => {}) }, 8000)
}
const stateChip = (s) => ({ running: chip('Berjalan', 'ok'), starting: chip('Memulai', 'wait'), stopping: chip('Menghentikan', 'wait'), offline: chip('Mati', 'off') }[s] || chip(s || '–', 'off'))
const setStats = (state, r, lim) => {
  if (state) SRV.state = state
  const box = $('#stt'); if (!box) return
  const x = r || SRV.res || {}; if (r) SRV.res = r
  box.innerHTML = `<div><small>Status</small>${stateChip(SRV.state)}</div><div><small>CPU</small><b>${(x.cpu_absolute ?? 0).toFixed(1)}%</b></div><div><small>RAM</small><b>${bytes(x.memory_bytes)}</b></div>
    <div><small>Disk</small><b>${bytes(x.disk_bytes)}</b></div><div><small>Jaringan ↓/↑</small><b>${bytes(x.network_rx_bytes)} / ${bytes(x.network_tx_bytes)}</b></div><div><small>Uptime</small><b>${upt(x.uptime)}</b></div>`
}
const drawTab = () => { ({ console: tabConsole, files: tabFiles, startup: tabStartup, settings: tabSettings })[SRV.tab]() }

/* ---- konsol live ---- */
const ANSI = { 30: '#6b7280', 31: '#f87171', 32: '#4ade80', 33: '#facc15', 34: '#60a5fa', 35: '#c084fc', 36: '#22d3ee', 37: '#e5e7eb', 90: '#9ca3af', 91: '#fca5a5', 92: '#86efac', 93: '#fde047', 94: '#93c5fd', 95: '#d8b4fe', 96: '#67e8f9', 97: '#fff' }
const ansi = (t) => {   /* warna ANSI -> HTML aman (teks di-escape dulu) */
  let color = '', bold = false, out = ''
  t = String(t).replace(/\r/g, '').replace(/\x1b\[[0-9;?]*[A-HJKSTfhlnsu]/g, '')
  for (const part of t.split(/(\x1b\[[0-9;]*m)/)) {
    const m = /^\x1b\[([0-9;]*)m$/.exec(part)
    if (!m) { if (part) out += (color || bold) ? `<span style="${color ? 'color:' + color + ';' : ''}${bold ? 'font-weight:700' : ''}">${esc(part)}</span>` : esc(part); continue }
    for (const c of (m[1] || '0').split(';').map(Number)) { if (c === 0) { color = ''; bold = false } else if (c === 1) bold = true; else if (c === 22) bold = false; else if (c === 39) color = ''; else if (ANSI[c]) color = ANSI[c] }
  }
  return out
}
const addLine = (t) => {
  for (const ln of String(t).split('\n')) SRV.lines.push(ln)
  if (SRV.lines.length > 1000) SRV.lines.splice(0, SRV.lines.length - 1000)
  const term = $('#term'); if (!term) return
  const stick = term.scrollTop + term.clientHeight >= term.scrollHeight - 30
  term.innerHTML = SRV.lines.map((l) => `<div>${ansi(l) || '&nbsp;'}</div>`).join('')
  if (stick) term.scrollTop = term.scrollHeight
}
const wsSend = (event, ...args) => { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify({ event, args })); else toast('Konsol belum tersambung. Tunggu sebentar.') }
const tabConsole = () => {
  $('#tab').innerHTML = `<div class="pt-term" id="term" aria-live="polite" aria-label="Konsol server"></div>
    <form id="cf" class="pt-row"><input id="ci" placeholder="Ketik perintah lalu Enter…" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="2000"><button class="btn sm" type="submit">Kirim</button></form>
    <div class="pt-row"><button class="btn sm" data-pw="start" type="button">Start</button><button class="btn ghost sm" data-pw="restart" type="button">Restart</button><button class="btn ghost sm" data-pw="stop" type="button">Stop</button><button class="btn ghost sm" data-pw="kill" type="button">Kill</button><span class="hint" id="cs"></span></div>`
  const term = $('#term'); term.innerHTML = SRV.lines.map((l) => `<div>${ansi(l) || '&nbsp;'}</div>`).join(''); term.scrollTop = term.scrollHeight
  $('#cf').onsubmit = (e) => { e.preventDefault(); const i = $('#ci'), v = i.value; if (!v.trim()) return; wsSend('send command', v); i.value = '' }
  $('#tab').onclick = (e) => { const b = e.target.closest('[data-pw]'); if (!b) return; const sig = b.dataset.pw
    if (sig === 'kill' && !b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Yakin Kill?'; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'Kill' } }, 3000); return }
    wsSend('set state', sig); if (b.dataset.sure) { delete b.dataset.sure; b.textContent = 'Kill' } }
  connStatus()
}
const connStatus = () => { const c = $('#cs'); if (c) c.textContent = S.ws && S.ws.readyState === 1 ? 'Konsol tersambung' : 'Menyambungkan konsol…' }
const connectWs = () => {
  clearTimeout(S.wsTimer)
  const id = SRV.id; if (!id || !$('#stt')) return
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + `/api/tools/ptero/s/${id}/ws`)
  S.ws = ws; connStatus()
  ws.onopen = () => { S.wsFail = 0; connStatus(); clearInterval(S.ping); S.ping = setInterval(() => { if (ws.readyState === 1) ws.send('{"event":"send stats","args":[null]}') }, 25000) }
  ws.onmessage = (e) => {
    let m; try { m = JSON.parse(e.data) } catch { return }
    const a = m.args || []
    if (m.event === 'console output' || m.event === 'install output' || m.event === 'daemon message') addLine(a[0])
    else if (m.event === 'status') setStats(a[0])
    else if (m.event === 'stats') { try { const o = JSON.parse(a[0]); setStats(o.state, { cpu_absolute: o.cpu_absolute, memory_bytes: o.memory_bytes, disk_bytes: o.disk_bytes, network_rx_bytes: o.network && o.network.rx_bytes, network_tx_bytes: o.network && o.network.tx_bytes, uptime: o.uptime }) } catch {} }
    else if (m.event === 'auth success') { connStatus() }
  }
  ws.onclose = (e) => {
    clearInterval(S.ping); connStatus()
    if (!$('#stt') || SRV.id !== id) return
    S.wsFail = e.wasClean || e.code === 4002 ? 0 : (S.wsFail || 0) + 1
    if (S.wsFail >= 6) { const c = $('#cs'); if (c) c.textContent = 'Konsol tidak tersambung. Muat ulang halaman untuk mencoba lagi.'; return }   /* jangan mengulang tanpa henti */
    S.wsTimer = setTimeout(connectWs, e.code === 4002 ? 300 : Math.min(15000, 2000 * 2 ** (S.wsFail || 0)))
  }
}

/* ---- file manager ---- */
const join = (d, n) => (d === '/' ? '' : d.replace(/\/+$/, '')) + '/' + n
const act = async (path, data, method = 'POST') => put(`${API}/s/${SRV.id}${path}`, data, method)
const slow = (path, data) => api(`${API}/s/${SRV.id}${path}`, { method: 'POST', body: JSON.stringify(data), signal: AbortSignal.timeout(75000) })   /* kompres/ekstrak bisa lama */
const loadFiles = async () => {
  const box = $('#fl'); if (!box) return
  box.innerHTML = '<p class="hint" style="padding:10px">Memuat…</p>'
  try {
    const r = await api(`${API}/s/${SRV.id}/files?dir=${encodeURIComponent(SRV.dir)}`)
    SRV.files = r.files.sort((a, b) => (a.is_file - b.is_file) || a.name.localeCompare(b.name)); SRV.sel.clear(); drawFiles()
  } catch (e) { box.innerHTML = `<p class="msg err" style="padding:10px">${esc(e.message)}</p>` }
}
const crumbs = () => { const parts = SRV.dir.split('/').filter(Boolean); let acc = ''; return `<a data-dir="/">root</a>` + parts.map((p) => { acc += '/' + p; return ` / <a data-dir="${esc(acc)}">${esc(p)}</a>` }).join('') }
const ARCH = /\.(zip|tar|tar\.gz|tgz|rar|7z|gz)$/i
const drawFiles = () => {
  const box = $('#fl'); if (!box) return
  $('#cr').innerHTML = crumbs()
  box.innerHTML = (SRV.dir !== '/' ? '<div class="pt-f"><button class="n" data-up="1" type="button">⬆ ..</button></div>' : '') +
    (SRV.files.map((f, i) => `<div class="pt-f"><input type="checkbox" data-i="${i}" aria-label="Pilih ${esc(f.name)}"${SRV.sel.has(f.name) ? ' checked' : ''}><button class="n" data-open="${i}" type="button">${f.is_file ? '📄' : '📁'} ${esc(f.name)}</button>
      <span class="s">${f.is_file ? bytes(f.size) : ''}</span><button class="i" data-rn="${i}" type="button">Rename</button>${f.is_file ? `<button class="i" data-dl="${i}" type="button">Unduh</button>` : ''}${f.is_file && ARCH.test(f.name) ? `<button class="i" data-ex="${i}" type="button">Ekstrak</button>` : ''}<button class="i" data-rm="${i}" type="button">Hapus</button></div>`).join('') || '<p class="hint" style="padding:10px">Folder kosong.</p>')
  const n = SRV.sel.size; $('#bulk').hidden = !n; $('#bn').textContent = n
}
const tabFiles = () => {
  if (SRV.edit) return editor()
  $('#tab').innerHTML = `<div class="pt-crumb" id="cr"></div>
    <div class="pt-row"><button class="btn sm" id="up" type="button">Unggah</button><input type="file" id="uf" multiple hidden><button class="btn ghost sm" id="nf" type="button">File baru</button><button class="btn ghost sm" id="nd" type="button">Folder baru</button><button class="btn ghost sm" id="rf" type="button">Segarkan</button>
      <span id="bulk" hidden class="pt-row"><span class="hint"><b id="bn">0</b> dipilih</span><button class="btn ghost sm" id="bz" type="button">Kompres</button><button class="btn ghost sm" id="bd" type="button">Hapus</button></span></div>
    <p class="msg" id="fm"></p><div class="pt-files" id="fl"></div><p class="hint">Unggah maks 25 MB per file. File zip bisa langsung di-Ekstrak. Edit teks lewat klik nama file.</p>`
  const fm = $('#fm'), go = (d) => { SRV.dir = d; loadFiles() }, run = async (fn, ok) => { try { note(fm, 'Memproses…'); await fn(); note(fm, ok || ''); loadFiles() } catch (e) { note(fm, e.message, 1) } }
  $('#cr').onclick = (e) => { const a = e.target.closest('[data-dir]'); if (a) go(a.dataset.dir) }
  $('#rf').onclick = loadFiles
  $('#fl').onclick = (e) => {
    const t = e.target
    if (t.closest('[data-up]')) return go(SRV.dir.replace(/\/[^/]*\/?$/, '') || '/')
    const g = (k) => { const b = t.closest(`[data-${k}]`); return b ? SRV.files[+b.dataset[k]] : null }
    let f
    if ((f = g('open'))) return f.is_file ? openFile(f.name) : go(join(SRV.dir, f.name))
    if ((f = g('rn'))) { const n = prompt('Nama baru', f.name); if (n && n !== f.name) run(() => act('/rename', { root: SRV.dir, from: f.name, to: n }), 'Nama diubah.'); return }
    if ((f = g('rm'))) { if (confirm(`Hapus ${f.name}? Tidak bisa dibatalkan.`)) run(() => act('/delete', { root: SRV.dir, files: [f.name] }), 'Dihapus.'); return }
    if ((f = g('ex'))) { run(() => slow('/decompress', { root: SRV.dir, file: f.name }), 'Berhasil diekstrak.'); return }
    if ((f = g('dl'))) { api(`${API}/s/${SRV.id}/download?path=${encodeURIComponent(join(SRV.dir, f.name))}`).then((r) => { location.href = r.url }).catch((er) => note(fm, er.message, 1)); return }
  }
  $('#fl').onchange = (e) => { const c = e.target.closest('[data-i]'); if (!c) return; const f = SRV.files[+c.dataset.i]; c.checked ? SRV.sel.add(f.name) : SRV.sel.delete(f.name); $('#bulk').hidden = !SRV.sel.size; $('#bn').textContent = SRV.sel.size }
  $('#bd').onclick = () => { if (confirm(`Hapus ${SRV.sel.size} item? Tidak bisa dibatalkan.`)) run(() => act('/delete', { root: SRV.dir, files: [...SRV.sel] }), 'Dihapus.') }
  $('#bz').onclick = () => run(() => slow('/compress', { root: SRV.dir, files: [...SRV.sel] }), 'Arsip dibuat.')
  $('#nd').onclick = () => { const n = prompt('Nama folder baru'); if (n) run(() => act('/folder', { root: SRV.dir, name: n }), 'Folder dibuat.') }
  $('#nf').onclick = () => { const n = prompt('Nama file baru (mis. config.json)'); if (n) { SRV.edit = { path: join(SRV.dir, n), text: '', isNew: true }; tabFiles() } }
  $('#up').onclick = () => $('#uf').click()
  $('#uf').onchange = async (e) => {
    const list = [...e.target.files]; e.target.value = ''
    for (const f of list) {
      if (f.size > 25 * 1024 * 1024) { note(fm, `${f.name}: terlalu besar (maks 25 MB).`, 1); continue }
      note(fm, `Mengunggah ${f.name}…`)
      try {
        const fd = new FormData(); fd.append('files', f, f.name)
        const r = await fetch(`/api${API}/s/${SRV.id}/upload?dir=${encodeURIComponent(SRV.dir)}`, { method: 'POST', body: fd, credentials: 'same-origin', signal: AbortSignal.timeout(180000) })
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.message || 'Unggah gagal.')
        note(fm, `${f.name} terunggah.`)
      } catch (er) { note(fm, `${f.name}: ${er.name === 'TimeoutError' ? 'timeout' : er.message}`, 1) }
    }
    loadFiles()
  }
  loadFiles()
}
const openFile = async (name) => {
  const path = join(SRV.dir, name), fm = $('#fm')
  try { note(fm, 'Membuka…'); const r = await api(`${API}/s/${SRV.id}/file?path=${encodeURIComponent(path)}`); SRV.edit = { path, text: r.content }; tabFiles() }
  catch (e) { note(fm, e.message, 1) }
}
const editor = () => {
  const ed = SRV.edit
  $('#tab').innerHTML = `<div class="pt-crumb"><b>${esc(ed.path)}</b></div><textarea class="pt-ed" id="et" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
    <div class="pt-row"><button class="btn sm" id="es" type="button">Simpan</button><button class="btn ghost sm" id="ec" type="button">Tutup</button></div><p class="msg" id="em"></p>`
  const t = $('#et'); t.value = ed.text
  t.onkeydown = (e) => { if (e.key === 'Tab') { e.preventDefault(); const s = t.selectionStart; t.setRangeText('  ', s, t.selectionEnd, 'end') } if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); $('#es').click() } }
  $('#ec').onclick = () => { SRV.edit = null; tabFiles() }
  $('#es').onclick = async () => {
    const b = $('#es'); b.disabled = true; note($('#em'), 'Menyimpan…')
    try { await api(`${API}/s/${SRV.id}/file?path=${encodeURIComponent(ed.path)}`, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: t.value }); note($('#em'), 'Tersimpan.') }
    catch (e) { note($('#em'), e.message, 1) }
    b.disabled = false
  }
}

/* ---- startup & pengaturan ---- */
const tabStartup = async () => {
  $('#tab').innerHTML = '<p class="hint">Memuat…</p>'
  try {
    const r = await api(`${API}/s/${SRV.id}/startup`)
    $('#tab').innerHTML = `<p class="hint">Perintah startup: <code style="overflow-wrap:anywhere">${esc(r.command)}</code></p>` + (r.variables.map((v, i) => `<div class="pt-var"><b>${esc(v.name)}</b><small>${esc(v.description)} <code>${esc(v.key)}</code></small>
      <div class="pt-row"><input data-k="${esc(v.key)}" value="${esc(v.value)}"${v.editable ? '' : ' disabled'} maxlength="2000">${v.editable ? `<button class="btn sm" data-s="${i}" type="button">Simpan</button>` : ''}</div></div>`).join('') || '<p class="hint">Tidak ada variabel yang bisa diubah.</p>') + '<p class="msg" id="sm"></p><p class="hint">Setelah mengubah variabel, restart server agar berlaku.</p>'
    $('#tab').onclick = async (e) => { const b = e.target.closest('[data-s]'); if (!b) return; const inp = b.parentElement.querySelector('input'); b.disabled = true
      try { await put(`${API}/s/${SRV.id}/startup`, { key: inp.dataset.k, value: inp.value }); note($('#sm'), `${inp.dataset.k} disimpan.`) } catch (er) { note($('#sm'), er.message, 1) } b.disabled = false }
  } catch (e) { $('#tab').innerHTML = `<p class="msg err">${esc(e.message)}</p>` }
}
const tabSettings = () => {
  $('#tab').innerHTML = `<div class="pt-var"><b>Nama server</b><div class="pt-row"><input id="rnm" maxlength="60" placeholder="Nama baru"><button class="btn sm" id="rnb" type="button">Ubah</button></div></div>
    <div class="pt-var"><b>Perpanjang masa aktif</b><small>Tambah durasi sebelum habis supaya server tidak ditangguhkan.</small><div><button class="btn sm" id="rnw" type="button">Perpanjang</button></div></div>
    <div class="pt-var"><b>Instal ulang</b><small>Mengembalikan server ke kondisi awal. <b>Semua file akan terhapus.</b></small><div><button class="btn ghost sm" id="ri" type="button">Instal ulang</button></div></div><p class="msg" id="stm"></p>`
  $('#rnb').onclick = async () => { const n = $('#rnm').value.trim(); if (!n) return; try { await put(`${API}/s/${SRV.id}/rename-server`, { name: n }, 'POST'); note($('#stm'), 'Nama diubah.'); document.querySelector('.pt h1').textContent = n } catch (e) { note($('#stm'), e.message, 1) } }
  $('#rnw').onclick = async () => { await Promise.all([loadPlans(), loadServers()]); renew(SRV.id) }
  $('#ri').onclick = async (e) => { const b = e.currentTarget; if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Yakin? Semua file hilang'; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'Instal ulang' } }, 4000); return }
    b.disabled = true; try { await put(`${API}/s/${SRV.id}/reinstall`, {}, 'POST'); note($('#stm'), 'Instal ulang dimulai. Pantau di tab Konsol.') } catch (er) { note($('#stm'), er.message, 1) } b.disabled = false }
}

/* =================== mulai =================== */
const route = () => { const m = /^#s=(\d+)$/.exec(location.hash); m ? manage(+m[1]) : home() }
window.addEventListener('hashchange', route)
ready.then(({ user }) => { if (!user) return (location.href = '/login.html?next=/pterodactyl'); route() })
