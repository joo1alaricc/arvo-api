/* Tools › Layanan OTP: pilih negara → layanan → server → review, lalu nomor virtual muncul di daftar pesanan dan OTP-nya tampil otomatis.
 * Saldo memakai dompet yang sama dengan Layanan SMM (isi saldo lewat deposit di halaman SMM). */
const el = $('#app'); el.classList.add('ot')
{ const st = document.createElement('style')
  st.textContent = `.ot{max-width:560px}.ot h1{font-size:19px;margin:0 0 2px}.ot>.sub{font-size:12.5px;line-height:1.45;margin:0 0 12px}
.ot .card{margin-bottom:10px}.ot .card-h{padding:10px 12px;font-size:13px}.ot .card-b{padding:11px 12px;display:grid;gap:9px}
.ot input{width:100%;padding:9px 11px}.ot .btn{padding:9px 14px}.ot .btn.sm{padding:6px 12px;font-size:12.5px}.ot .btn[disabled]{opacity:.5;cursor:not-allowed}
.ot .msg{margin:0;font-size:12.5px;white-space:pre-wrap;overflow-wrap:anywhere}.ot .msg:empty{display:none}
.ot .hint{font-size:12px;color:var(--mut);line-height:1.45;margin:0}.ot .hint a,.ot .msg a{color:var(--ac)}
.ot-bal{display:flex;align-items:center;gap:10px}.ot-bal>div:first-child{flex:1;min-width:0}.ot-bal small{display:block;font-size:11.5px;color:var(--mut)}.ot-bal b{font-size:22px;letter-spacing:-.02em}
.ot-steps{display:flex;gap:6px;flex-wrap:wrap;font-size:12px;color:var(--mut)}.ot-steps span{display:flex;align-items:center;gap:5px;padding:3px 9px 3px 4px;border-radius:99px;border:1px solid var(--line)}
.ot-steps i{font-style:normal;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;border:1px solid var(--line)}
.ot-steps .on{color:var(--tx);border-color:var(--ac)}.ot-steps .on i{background:var(--ac);color:var(--bg);border-color:var(--ac)}.ot-steps .ok i{background:color-mix(in srgb,var(--g,#4ade80) 20%,transparent);color:var(--g,#4ade80);border-color:var(--g,#4ade80)}
.ot-chips{display:flex;gap:6px;flex-wrap:wrap}.ot-chips button{border:1px solid var(--line);background:none;color:var(--tx);border-radius:99px;padding:5px 12px;font:600 12px inherit;font-family:inherit;cursor:pointer}
.ot-pop{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ot-pop button{border:1px solid var(--line);background:none;color:var(--tx);border-radius:11px;padding:8px 10px;text-align:left;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ot-list{max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:11px;overscroll-behavior:contain;background:color-mix(in srgb,var(--bg) 60%,var(--card))}
.ot-r{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line);background:none;color:var(--tx);font:inherit;padding:9px 10px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.ot-r:last-child{border-bottom:0}.ot-r:active{background:color-mix(in srgb,var(--mut) 14%,transparent)}.ot-r.on{background:color-mix(in srgb,var(--ac) 20%,transparent);box-shadow:inset 3px 0 0 var(--ac)}.ot-r.on .ot-m b,.ot-r.on .ot-p{color:var(--ac)}.ot-r.on .ot-p::after{content:' ✓'}
.ot-r .ot-em{font-size:20px;line-height:1}.ot-r .ot-m{flex:1;min-width:0}.ot-r .ot-m b{display:block;font-size:13px;font-weight:600;overflow-wrap:anywhere}.ot-r .ot-m span{display:block;font-size:11.5px;color:var(--mut);margin-top:1px}.ot-r .ot-p{font-weight:700;font-size:13px;white-space:nowrap}
.ot-empty{padding:14px 10px;font-size:12.5px;color:var(--mut);text-align:center}
.ot-ctx{display:flex;align-items:center;gap:8px;font-size:13px}.ot-ctx b{flex:1;min-width:0;overflow-wrap:anywhere}.ot-ctx span{color:var(--mut)}
.ot-rows{display:grid;gap:7px;font-size:13px;border:1px solid var(--line);border-radius:11px;padding:10px}.ot-rows div{display:flex;justify-content:space-between;gap:10px}.ot-rows span{color:var(--mut)}.ot-rows b{text-align:right}
.ot-rows hr{border:0;border-top:1px solid var(--line);margin:2px 0;width:100%}.ot-rows .neg{color:var(--bad,#ef4444)}.ot-rows .pos{color:var(--g,#4ade80)}
.ot-qty{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:10px;overflow:hidden}.ot-qty button{border:0;background:none;color:var(--tx);width:34px;height:32px;font-size:16px;cursor:pointer}.ot-qty button:disabled{opacity:.35}.ot-qty b{min-width:30px;text-align:center}
.ot-row2{display:flex;gap:8px}.ot-row2>*{flex:1}
.ot-st{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11.5px;font-weight:700;border:1px solid;white-space:nowrap}
.ot-st.ok{color:var(--g,#4ade80);background:color-mix(in srgb,var(--g,#4ade80) 13%,transparent)}.ot-st.wait{color:#f5a524;background:color-mix(in srgb,#f5a524 13%,transparent)}.ot-st.bad{color:var(--bad,#ef4444);background:color-mix(in srgb,#ef4444 13%,transparent)}
.ot-o{border:1px solid var(--line);border-radius:12px;padding:11px;display:grid;gap:9px}.ot-o.live{border-color:color-mix(in srgb,var(--ac) 45%,var(--line))}
.ot-o .ot-t{display:flex;align-items:center;gap:8px}.ot-o .ot-t b{flex:1;min-width:0;font-size:13px;overflow-wrap:anywhere}.ot-o .ot-d{font-size:11.5px;color:var(--mut)}
.ot-ph{text-align:center;font:600 22px/1.2 'JetBrains Mono',monospace;letter-spacing:.02em;overflow-wrap:anywhere}
.ot-wait{text-align:center;display:grid;gap:4px;padding:6px 0}.ot-wait b{font-size:14px}.ot-wait span{font-size:12px;color:var(--mut)}
.ot-code{text-align:center;display:grid;gap:6px;padding:8px;border-radius:11px;background:color-mix(in srgb,var(--g,#4ade80) 10%,transparent)}.ot-code small{font-size:11.5px;color:var(--mut)}
.ot-code b{font:700 30px/1.1 'JetBrains Mono',monospace;letter-spacing:.14em;color:var(--g,#4ade80);overflow-wrap:anywhere}.ot-code p{margin:0;font-size:12px;color:var(--mut);overflow-wrap:anywhere}
.ot-cd{text-align:center;font-size:12px;color:var(--mut)}.ot-cd b{font-family:'JetBrains Mono',monospace;color:var(--tx)}`
  document.head.append(st) }

const nf = (n) => Number(n || 0).toLocaleString('id-ID')
const note = (e, t, bad) => { if (!e) return; e.textContent = t; e.className = 'msg' + (bad ? ' err' : ''); e.style.cssText = bad || !t ? '' : 'color:var(--g)' }
const I = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${NI[n]}</svg>`
const POP_C = ['ID', 'US', 'MY', 'SG', 'GB']
const POP_S = [['WhatsApp', /whatsapp/i], ['Telegram', /telegram/i], ['Shopee', /shopee/i], ['TikTok', /tiktok/i], ['Instagram', /instagram/i], ['Facebook', /facebook/i], ['Tinder', /tinder/i], ['Discord', /discord/i], ['Netflix', /netflix/i], ['DANA', /^dana$/i]]
const LIVE = new Set(['ACTIVE', 'OTP_RECEIVED'])
const LBL = { ACTIVE: 'Menunggu SMS', OTP_RECEIVED: 'SMS diterima', COMPLETED: 'Selesai', CANCELED: 'Dibatalkan', EXPIRED: 'Kedaluwarsa' }
const chip = (s) => `<span class="ot-st ${s === 'COMPLETED' || s === 'OTP_RECEIVED' ? 'ok' : s === 'CANCELED' || s === 'EXPIRED' ? 'bad' : 'wait'}">${esc(LBL[s] || s)}</span>`
const S = { step: 1, countries: [], country: null, services: [], service: null, servers: [], server: null, qty: 1, bal: null, orders: [], busy: new Set(), poll: null, tick: null }
const setBal = (n) => { if (n == null) return; S.bal = n; const b = $('#bv'); if (b) b.textContent = rp(n); if (S.step === 4) draw() }
const mmss = (t) => { const s = Math.max(0, Math.ceil((t - Date.now()) / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') }
const noDial = (o) => { const d = String(o.dial || '').replace(/\D/g, ''), p = String(o.phone || '').replace(/\D/g, ''); return d && p.startsWith(d) ? p.slice(d.length) : p }

const view = () => {
  el.innerHTML = `<h1>Layanan OTP</h1><p class="sub">Nomor virtual untuk menerima SMS verifikasi (WhatsApp, Telegram, dll). Biaya dipotong dari saldo akunmu; nomor yang tidak menerima SMS dikembalikan otomatis.</p>
  <div class="card"><div class="card-b"><div class="ot-bal"><div><small>Saldo</small><b id="bv">…</b></div><button class="btn sm" id="bdp" type="button">Deposit</button></div>
    <p class="hint">Saldo OTP sama dengan saldo Layanan SMM. Isi saldo lewat deposit QRIS di sini.</p></div></div>
  <div id="dpm"></div>
  <div class="card"><div class="card-h">${I('bolt')}<span>Pesan nomor</span></div><div class="card-b"><div class="ot-steps" id="ss"></div><div id="wz"></div><p class="msg" id="mw"></p></div></div>
  <div class="card"><div class="card-h">${I('list')}<span>Pesanan kamu</span></div><div class="card-b" id="ol"><p class="hint">Memuat…</p></div></div>`
  $('#wz').onclick = wzClick; $('#wz').oninput = (e) => { if (e.target.id === 'sq') drawList() }
  $('#ol').onclick = olClick
  S.dep = ArvoDeposit.mount($('#dpm'), { onBalance: setBal }); $('#bdp').onclick = () => S.dep.open()
  loadBal(); loadCountries(); loadOrders()
  clearInterval(S.poll); clearInterval(S.tick)
  S.poll = setInterval(() => { if (!document.hidden) pollLive() }, 5000)
  S.tick = setInterval(tick, 1000)
  draw()
}
const loadBal = async () => { try { const r = await api('/tools/smm/balance'); setBal(r.balance); if (S.dep) S.dep.setLimits(r.deposit_min, r.deposit_max) } catch (e) { const b = $('#bv'); if (b && S.bal === null) b.textContent = '—' } }

/* ---------- wizard ---------- */
const draw = () => {
  const names = ['Negara', 'Layanan', 'Server', 'Konfirmasi']
  $('#ss').innerHTML = names.map((n, i) => `<span class="${S.step === i + 1 ? 'on' : S.step > i + 1 ? 'ok' : ''}"><i>${S.step > i + 1 ? '✓' : i + 1}</i>${n}</span>`).join('')
  const w = $('#wz'), c = S.country, sv = S.service, sr = S.server
  if (S.step === 1) {
    w.innerHTML = `<input id="sq" placeholder="Cari negara…" autocomplete="off"><div class="ot-chips" id="pc"></div><div class="ot-list" id="sl"><p class="ot-empty">Memuat negara…</p></div>`
    drawList()
  } else if (S.step === 2) {
    w.innerHTML = `<div class="ot-ctx"><b>${esc(c.emoji)} <span>Negara:</span> ${esc(c.name)}</b><button class="btn ghost sm" data-a="to1" type="button">Ubah</button></div><div class="ot-pop" id="pp"></div><input id="sq" placeholder="Cari layanan…" autocomplete="off"><div class="ot-list" id="sl"><p class="ot-empty">Memuat layanan…</p></div>`
    drawList()
  } else if (S.step === 3) {
    w.innerHTML = `<div class="ot-ctx"><b>${esc(c.emoji)} ${esc(c.name)}, ${esc(sv.name)}</b><button class="btn ghost sm" data-a="to2" type="button">Ubah</button></div><div class="hint">Pilih server (Server 1 = termurah):</div><div class="ot-list" id="sl"><p class="ot-empty">Memuat server…</p></div><p class="hint" id="sel"></p>
      <div class="ot-row2"><button class="btn ghost" data-a="to2" type="button">Kembali</button><button class="btn" data-a="to4" type="button" id="nx" disabled>Review Order</button></div>`
    drawList()
  } else {
    const total = sr.price * S.qty, after = S.bal === null ? null : S.bal - total
    w.innerHTML = `<div class="ot-rows"><div><span>Negara</span><b>${esc(c.emoji)} ${esc(c.name)}</b></div><div><span>Layanan</span><b>${esc(sv.name)}</b></div><div><span>Server</span><b>Server ${sr.server}</b></div><hr>
      <div><span>Jumlah nomor<br><small class="hint">Maks. ${MAXQ} nomor sekaligus</small></span><span class="ot-qty"><button data-a="qm" type="button" ${S.qty <= 1 ? 'disabled' : ''}>−</button><b>${S.qty}</b><button data-a="qp" type="button" ${S.qty >= MAXQ ? 'disabled' : ''}>+</button></span></div></div>
      <div class="ot-rows"><div><span>Total biaya</span><b style="font-size:17px">${rp(total)}</b></div><hr><div><span>Saldo saat ini</span><b>${S.bal === null ? '…' : rp(S.bal)}</b></div>
      <div><span>Saldo setelah order</span><b class="${after !== null && after < 0 ? 'neg' : 'pos'}">${after === null ? '…' : after < 0 ? 'kurang ' + rp(-after) : rp(after)}</b></div></div>
      ${after !== null && after < 0 ? '<p class="msg err">Saldo tidak cukup. <a href="#" data-a="dep">Deposit dulu</a>.</p>' : ''}
      <div class="ot-row2"><button class="btn ghost" data-a="to3" type="button">Kembali</button><button class="btn" data-a="go" type="button" id="go" ${after !== null && after < 0 ? 'disabled' : ''}>Konfirmasi Order</button></div>`
  }
}
const MAXQ = 3
const az = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' })   /* urutan A-Z */
const drawList = () => {
  const l = $('#sl'); if (!l) return
  const q = ($('#sq')?.value || '').trim().toLowerCase(), MAX = 60
  if (S.step === 1) {
    const pc = $('#pc'); if (pc) pc.innerHTML = POP_C.map((k) => S.countries.find((x) => x.code === k)).filter(Boolean).map((x) => `<button type="button" data-a="pc" data-id="${x.id}">${esc(x.emoji)} ${esc(x.name)}</button>`).join('')
    if (!S.countries.length) return
    const all = S.countries.filter((x) => !q || (x.name + ' ' + x.dial + ' ' + x.code).toLowerCase().includes(q))
    l.innerHTML = all.length ? all.slice(0, MAX).map((x) => `<button type="button" class="ot-r" data-a="pc" data-id="${x.id}"><span class="ot-em">${esc(x.emoji)}</span><span class="ot-m"><b>${esc(x.name)}</b><span>Kode dial ${esc(x.dial)}</span></span></button>`).join('') + (all.length > MAX ? `<p class="ot-empty">Menampilkan ${MAX} dari ${nf(all.length)}. Gunakan pencarian.</p>` : '') : '<p class="ot-empty">Negara tidak ditemukan.</p>'
  } else if (S.step === 2) {
    if (!S.services.length) return
    const pp = $('#pp'); if (pp) pp.innerHTML = POP_S.map(([n, re]) => [n, S.services.find((x) => re.test(x.name))]).filter(([, x]) => x).map(([n, x]) => `<button type="button" data-a="ps" data-id="${x.id}">${esc(n)}</button>`).join('')
    const all = S.services.filter((x) => !q || (x.name + ' ' + x.code).toLowerCase().includes(q))
    l.innerHTML = all.length ? all.slice(0, MAX).map((x) => `<button type="button" class="ot-r" data-a="ps" data-id="${x.id}"><span class="ot-m"><b>${esc(x.name)}</b><span>Nomor virtual di ${esc(S.country.name)}</span></span></button>`).join('') + (all.length > MAX ? `<p class="ot-empty">Menampilkan ${MAX} dari ${nf(all.length)}. Gunakan pencarian.</p>` : '') : '<p class="ot-empty">Layanan tidak ditemukan.</p>'
  } else if (S.step === 3) {
    if (!S.servers.length) return
    l.innerHTML = S.servers.map((x) => `<button type="button" class="ot-r${S.server && S.server.id === x.id ? ' on' : ''}" data-a="pv" data-id="${x.id}"><span class="ot-m"><b>Server ${x.server}</b><span>${nf(x.available)} SIM tersedia</span></span><span class="ot-p">${rp(x.price)}</span></button>`).join('')
    const nx = $('#nx'); if (nx) nx.disabled = !S.server
    const sl = $('#sel'); if (sl) sl.innerHTML = S.server ? `Dipilih: <b>Server ${S.server.server}</b> · ${rp(S.server.price)}` : 'Pilih salah satu server.'
  }
}
const go = (n) => { S.step = n; note($('#mw'), ''); draw() }
const wzClick = (e) => {
  const b = e.target.closest('[data-a]'); if (!b) return
  const a = b.dataset.a, id = Number(b.dataset.id)
  if (a === 'dep') { e.preventDefault(); return S.dep && S.dep.open() }
  if (a === 'to1') { S.country = S.service = S.server = null; go(1) }
  else if (a === 'to2') { S.service = S.server = null; go(2); drawList() }
  else if (a === 'to3') go(3)
  else if (a === 'to4') { if (S.server) go(4) }
  else if (a === 'pc') { S.country = S.countries.find((x) => x.id === id); S.services = []; S.service = S.server = null; go(2); loadServices() }
  else if (a === 'ps') { S.service = S.services.find((x) => x.id === id); S.servers = []; S.server = null; go(3); loadServers() }
  else if (a === 'pv') { S.server = S.servers.find((x) => x.id === id) || null; drawList() }
  else if (a === 'qm') { S.qty = Math.max(1, S.qty - 1); draw() }
  else if (a === 'qp') { S.qty = Math.min(MAXQ, S.qty + 1); draw() }
  else if (a === 'go') placeOrder(b)
}
const fail = (e, step) => { const l = $('#sl'); if (l && S.step === step) l.innerHTML = `<p class="ot-empty err">${esc(e.message)}</p>` }
const loadCountries = async () => { try { S.countries = ((await api('/tools/otp/countries')).countries || []).sort((a, b) => az(a.name, b.name)); if (S.step === 1) drawList() } catch (e) { fail(e, 1) } }
const loadServices = async () => {
  const id = S.country.id
  try { const r = await api('/tools/otp/services?country_id=' + id); if (S.country?.id !== id) return; S.services = (r.services || []).sort((a, b) => az(a.name, b.name)); if (S.step === 2) drawList() } catch (e) { fail(e, 2) }
}
const loadServers = async () => {
  const c = S.country.id, s = S.service.id
  try {
    const r = await api(`/tools/otp/servers?country_id=${c}&platform_id=${s}`); if (S.service?.id !== s) return
    S.servers = r.servers || []; S.server = S.servers[0] || null
    if (S.step === 3) { if (!S.servers.length) { const l = $('#sl'); if (l) l.innerHTML = '<p class="ot-empty">Belum ada nomor tersedia untuk layanan ini. Coba layanan atau negara lain.</p>' } else drawList() }
  } catch (e) { fail(e, 3) }
}

async function placeOrder(b) {
  const m = $('#mw'); b.disabled = true; b.textContent = 'Memproses…'; note(m, '')
  try {
    const r = await put('/tools/otp/order', { country_id: S.country.id, platform_id: S.service.id, product_id: S.server.id, quantity: S.qty }, 'POST')
    setBal(r.balance); S.step = 1; S.country = S.service = S.server = null; S.qty = 1; draw()
    note($('#mw'), `${r.orders.length} nomor dibuat.` + (r.refunded ? ` ${rp(r.refunded)} dikembalikan karena sebagian nomor kosong.` : '') + ' Kirim SMS verifikasi ke nomor di bawah.')
    await loadOrders(); $('#ol').scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (e) {
    note(m, e.message, 1); b.disabled = false; b.textContent = 'Konfirmasi Order'
    if (e.status === 402 || e.status === 409) loadBal()
    if (e.status === 504) loadOrders()
  }
}

/* ---------- pesanan ---------- */
const upsert = (o) => { const i = S.orders.findIndex((x) => x.order_id === o.order_id); i < 0 ? S.orders.unshift(o) : (S.orders[i] = o) }
const loadOrders = async () => {
  try { const r = await api('/tools/otp/orders'); S.orders = r.orders || []; setBal(r.balance); drawOrders() }
  catch (e) { const l = $('#ol'); if (l && !S.orders.length) l.innerHTML = `<p class="msg err">${esc(e.message)}</p>` }
}
const fmtT = (t) => new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const card = (o) => {
  const live = LIVE.has(o.status), head = `<div class="ot-t"><b>${esc(o.service)} · ${esc(o.country)}</b>${chip(o.status)}</div>`
  if (!live) {
    return `<div class="ot-o" data-o="${esc(o.order_id)}">${head}<div class="ot-d">${esc(o.phone)} · Server ${o.server_no} · ${rp(o.cost)} · ${esc(fmtT(o.created_at))}</div>
      ${o.otp_code ? `<div class="ot-code"><small>Kode OTP</small><b>${esc(o.otp_code)}</b></div>` : o.otp_message ? `<div class="ot-code"><p>${esc(o.otp_message)}</p></div>` : ''}
      ${o.refunded ? '<div class="ot-d">Biaya sudah dikembalikan ke saldo.</div>' : ''}
      ${o.status === 'COMPLETED' ? `<div class="ot-row2"><button class="btn ghost sm" data-act="react" type="button">Aktifkan ulang nomor</button></div>` : ''}</div>`
  }
  const ca = o.status === 'ACTIVE' && o.cancel_available_at && o.cancel_available_at > Date.now()
  return `<div class="ot-o live" data-o="${esc(o.order_id)}">${head}<div class="ot-d">Server ${o.server_no} · ${rp(o.cost)} · ${esc(fmtT(o.created_at))}</div>
    <div class="ot-d" style="text-align:center">Nomor telepon virtual</div><div class="ot-ph">${esc(o.phone)}</div>
    <div class="ot-row2"><button class="btn ghost sm" data-act="cp" data-v="${esc(o.phone)}" type="button">Salin nomor</button><button class="btn ghost sm" data-act="cp" data-v="${esc(noDial(o))}" type="button">Salin tanpa ${esc(o.dial)}</button></div>
    ${o.otp_code ? `<div class="ot-code"><small>Kode OTP</small><b>${esc(o.otp_code)}</b><button class="btn sm" data-act="cp" data-v="${esc(o.otp_code)}" type="button">Salin kode</button>${o.otp_message ? `<p>${esc(o.otp_message)}</p>` : ''}</div>`
      : o.otp_message ? `<div class="ot-code"><small>Pesan masuk</small><p>${esc(o.otp_message)}</p></div>`
      : `<div class="ot-wait"><b>Menunggu SMS masuk…</b><span>Kirim SMS verifikasi dari aplikasi target (${esc(o.service)}), kode akan otomatis muncul di sini.</span></div>`}
    ${o.expires_at ? `<div class="ot-cd">Masa aktif nomor: <b class="ot-cdv" data-t="${o.expires_at}">${mmss(o.expires_at)}</b></div>` : ''}
    <div class="ot-row2"><button class="btn ghost sm" data-act="chk" type="button">Cek status</button><button class="btn ghost sm" data-act="rs" type="button" ${o.can_resend ? '' : 'disabled'}>Resend OTP</button></div>
    <div class="ot-row2">${o.can_finish ? '<button class="btn sm" data-act="fin" type="button">Selesai</button>' : ''}<button class="btn ghost sm" data-act="cx" type="button" ${o.can_cancel && !ca ? '' : 'disabled'} ${o.cancel_available_at ? `data-ca="${o.cancel_available_at}"` : ''}>${ca ? 'Batal tersedia ' + mmss(o.cancel_available_at) : 'Batalkan & refund'}</button></div>
    <p class="msg" data-m></p></div>`
}
const drawOrders = () => {
  const l = $('#ol'); if (!l) return
  const keep = {}; l.querySelectorAll('.ot-o[data-o]').forEach((c) => { const m = c.querySelector('[data-m]'); if (m && m.textContent) keep[c.dataset.o] = [m.textContent, m.className, m.style.cssText] })
  l.innerHTML = S.orders.length ? S.orders.map(card).join('') : '<p class="hint">Belum ada pesanan.</p>'
  for (const [id, [t, cl, st]] of Object.entries(keep)) { const m = l.querySelector(`.ot-o[data-o="${id}"] [data-m]`); if (m) { m.textContent = t; m.className = cl; m.style.cssText = st } }
}
const tick = () => {
  document.querySelectorAll('.ot-cdv[data-t]').forEach((n) => { n.textContent = mmss(+n.dataset.t) })
  document.querySelectorAll('button[data-ca]').forEach((b) => {
    const t = +b.dataset.ca
    if (t > Date.now()) b.textContent = 'Batal tersedia ' + mmss(t)
    else { b.textContent = 'Batalkan & refund'; b.disabled = false; delete b.dataset.ca }
  })
}
const refresh = async (id, manual) => {
  if (S.busy.has(id)) return; S.busy.add(id)
  const msg = () => $(`.ot-o[data-o="${id}"] [data-m]`)
  try {
    const r = await api('/tools/otp/status?order=' + encodeURIComponent(id)), prev = S.orders.find((x) => x.order_id === id)
    const same = prev && JSON.stringify(prev) === JSON.stringify(r.order)
    upsert(r.order); setBal(r.balance); if (!same) drawOrders()   /* jangan gambar ulang kalau tidak ada perubahan (menjaga tombol konfirmasi batal) */
    if (r.order.refunded_now) note(msg(), `Nomor kedaluwarsa tanpa SMS. ${rp(r.order.refunded_now)} dikembalikan ke saldo.`)
    else if (manual) note(msg(), 'Status diperbarui.')
    if (prev && !prev.otp_code && r.order.otp_code && navigator.vibrate) navigator.vibrate(120)
  } catch (e) { if (manual) note(msg(), e.message, 1) }
  S.busy.delete(id)
}
const pollLive = () => { for (const o of S.orders) if (LIVE.has(o.status)) refresh(o.order_id, false) }

async function act(kind, id, btn) {
  const m = () => $(`.ot-o[data-o="${id}"] [data-m]`), old = btn.textContent
  if (kind === 'cx' && btn.dataset.sure !== '1') {   /* ketuk dua kali untuk membatalkan */
    btn.dataset.sure = '1'; btn.textContent = 'Ketuk lagi untuk batalkan'
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.sure; btn.textContent = old } }, 4000); return
  }
  btn.disabled = true
  try {
    if (kind === 'cx') {
      const r = await put('/tools/otp/cancel', { order: id }, 'POST'); setBal(r.balance); await refresh(id, false)
      note(m(), r.refunded ? `Dibatalkan. ${rp(r.refunded)} dikembalikan ke saldo.` : 'Pesanan dibatalkan.')
    } else if (kind === 'fin') { await put('/tools/otp/finish', { order: id }, 'POST'); await refresh(id, false) }
    else if (kind === 'rs') { const r = await put('/tools/otp/resend', { order: id }, 'POST'); note(m(), r.message, !r.resent) }
    else if (kind === 'react') {
      const r = await put('/tools/otp/reactivate', { order: id }, 'POST'); setBal(r.balance); upsert(r.order); drawOrders()
    }
  } catch (e) { note(m(), e.message, 1); if (e.status === 409) refresh(id, false) }
  if (btn.isConnected) { btn.disabled = false; if (kind !== 'cx') btn.textContent = old; else if (btn.dataset.sure) { delete btn.dataset.sure; btn.textContent = old } }
}
const olClick = (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return
  const id = b.closest('.ot-o')?.dataset.o, k = b.dataset.act
  if (k === 'cp') copy(b.dataset.v, b)
  else if (k === 'chk') refresh(id, true)
  else act(k, id, b)
}

ready.then(({ user }) => { if (!user) return (location.href = '/login.html?next=/otp'); view() })
