/* Tools › Layanan SMM: saldo tiap user dicatat di Arvo; pesanan & deposit lewat panel SMM milik Arvo. */
const el = $('#app'); el.classList.add('sm')
{ const st = document.createElement('style')
  st.textContent = `.sm{max-width:560px}.sm h1{font-size:19px;margin:0 0 2px}.sm>.sub{font-size:12.5px;line-height:1.45;margin:0 0 12px}
.sm .card{margin-bottom:10px}.sm .card-h{padding:10px 12px;font-size:13px}.sm .card-b{padding:11px 12px;display:grid;gap:8px}
.sm input,.sm textarea{width:100%;padding:9px 11px}.sm .btn{padding:9px 14px}.sm .btn.sm{padding:6px 12px;font-size:12.5px}
.sm .msg{margin:0;font-size:12.5px;white-space:pre-wrap;overflow-wrap:anywhere}.sm .msg:empty{display:none}
.sm .hint{font-size:12px;color:var(--mut);line-height:1.45;margin:0}.sm .hint a{color:var(--ac)}
.sm-bal{display:flex;align-items:center;gap:10px}.sm-bal>div:first-child{flex:1;min-width:0}.sm-bal small{display:block;font-size:11.5px;color:var(--mut)}
.sm-bal b{font-size:22px;letter-spacing:-.02em}.sm-acc{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--mut);flex-wrap:wrap}.sm-acc .mono{color:var(--tx)}
.sm-link{border:0;background:none;color:var(--ac);font:inherit;font-size:12px;font-weight:600;cursor:pointer;padding:0}
.sm-list{max-height:250px;overflow:auto;border:1px solid var(--line);border-radius:11px;overscroll-behavior:contain;background:color-mix(in srgb,var(--bg) 60%,var(--card))}
.sm-r{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line);background:none;color:var(--tx);font:inherit;padding:8px 10px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.sm-r:last-child{border-bottom:0}.sm-r b{display:block;font-size:12.5px;font-weight:600;line-height:1.35;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sm-r span{display:block;margin-top:2px;font-size:11.5px;color:var(--mut)}.sm-r.on{background:color-mix(in srgb,var(--ac) 14%,transparent)}.sm-r:active{background:color-mix(in srgb,var(--mut) 14%,transparent)}
.sm-empty{padding:14px 10px;font-size:12.5px;color:var(--mut);text-align:center}
.sm-sel{border:1px solid color-mix(in srgb,var(--ac) 45%,var(--line));border-radius:11px;padding:9px 10px;font-size:12.5px;line-height:1.45;background:color-mix(in srgb,var(--ac) 8%,transparent)}
.sm-sel b{display:block;overflow-wrap:anywhere}.sm-sel span{color:var(--mut)}
.sm-chips{display:flex;gap:6px;flex-wrap:wrap}.sm-chips button{border:1px solid var(--line);background:none;color:var(--tx);border-radius:99px;padding:5px 12px;font:600 12px inherit;font-family:inherit;cursor:pointer}
.sm-chips button.on{border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent)}
.sm-qr{display:grid;gap:8px;justify-items:center;border:1px solid var(--line);border-radius:12px;padding:12px}.sm-qr img{width:100%;max-width:210px;background:#fff;border-radius:10px;padding:6px}
.sm-rows{width:100%;display:grid;gap:5px;font-size:12.5px}.sm-rows div{display:flex;justify-content:space-between;gap:10px}.sm-rows span{color:var(--mut)}.sm-rows b{text-align:right}
.sm-st{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11.5px;font-weight:700;border:1px solid;white-space:nowrap}
.sm-st.ok{color:var(--g,#4ade80);background:color-mix(in srgb,var(--g,#4ade80) 13%,transparent)}.sm-st.wait{color:#f5a524;background:color-mix(in srgb,#f5a524 13%,transparent)}
.sm-st.mid{color:#60a5fa;background:color-mix(in srgb,#60a5fa 13%,transparent)}.sm-st.bad{color:var(--bad,#ef4444);background:color-mix(in srgb,#ef4444 13%,transparent)}
.sm-h{border:1px solid var(--line);border-radius:11px;padding:8px 10px;display:grid;gap:4px;font-size:12.5px}.sm-h .t{display:flex;align-items:center;gap:8px}.sm-h .t b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.sm-h .d{color:var(--mut);font-size:11.5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.sm-row2{display:flex;gap:8px}.sm-row2 input{flex:1}`
  document.head.append(st) }

const I = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${NI[n]}</svg>`
const nf = (n) => Number(n || 0).toLocaleString('id-ID')
const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)) } catch {} return null }
const note = (e, t, bad) => { if (!e) return; e.textContent = t; e.className = 'msg' + (bad ? ' err' : ''); e.style.cssText = bad || !t ? '' : 'color:var(--g)' }
const stChip = (s) => { const k = String(s || '').toLowerCase(); const c = /success|complete|selesai|done/.test(k) ? 'ok' : /cancel|fail|error|refund|pasti|kedaluwarsa/.test(k) ? 'bad' : /partial/.test(k) ? 'mid' : 'wait'; return `<span class="sm-st ${c}">${esc(s)}</span>` }
const DEPK = 'arvo_smm_dep'
const S = { bal: null, svcs: [], sel: null, poll: null }
const setBal = (n) => { if (n == null) return; S.bal = n; const b = $('#bv'); if (b) b.textContent = rp(n); est() }

const view = () => {
  el.innerHTML = `<h1>Layanan SMM</h1><p class="sub">Beli followers, likes, views, dan layanan sosmed lainnya. Biaya dipotong dari saldo SMM di akunmu; isi saldo lewat deposit QRIS.</p>
  <div class="card"><div class="card-b">
    <div class="sm-bal"><div><small>Saldo SMM</small><b id="bv">…</b></div><button class="btn sm" id="bdp" type="button">Deposit</button></div>
    <p class="msg" id="mb"></p></div></div>

  <div class="card" id="cd" hidden><div class="card-h">${I('bolt')}<span>Deposit saldo</span></div><div class="card-b">
    <div class="sm-chips" id="dc">${[10000, 20000, 50000, 100000].map((n) => `<button type="button" data-n="${n}">${nf(n)}</button>`).join('')}</div>
    <form id="fd" class="sm-row2"><input id="da" type="number" inputmode="numeric" min="1000" step="1" placeholder="Nominal (Rp)" required><button class="btn" id="bd">Buat deposit</button></form>
    <p class="msg" id="md"></p><div id="dv"></div></div></div>

  <div class="card"><div class="card-h">${I('bag')}<span>Buat pesanan</span></div><div class="card-b">
    <input id="sq" placeholder="Cari layanan (nama, kategori, atau ID)…" autocomplete="off">
    <select id="cat" aria-label="Kategori"><option value="">Semua kategori</option></select>
    <div class="sm-list" id="sl"><p class="sm-empty">Memuat layanan…</p></div>
    <div class="sm-sel" id="sd" hidden></div>
    <form id="fo" style="display:grid;gap:8px">
      <input id="lk" type="url" inputmode="url" placeholder="Link target (https://…)" autocomplete="off" autocapitalize="off" required>
      <input id="qt" type="number" inputmode="numeric" min="1" step="1" placeholder="Jumlah" required>
      <p class="hint" id="es"></p>
      <button class="btn block" id="bo">Pesan</button></form>
    <p class="msg" id="mo"></p></div></div>

  <div class="card"><div class="card-h">${I('list')}<span>Pesanan kamu</span></div><div class="card-b">
    <div id="hl" style="display:grid;gap:6px"><p class="hint">Memuat…</p></div></div></div>`

  $('#bdp').onclick = () => openDep()
  $('#dc').onclick = (e) => { const b = e.target.closest('button[data-n]'); if (b) { $('#da').value = b.dataset.n; chipSync() } }
  $('#da').oninput = chipSync
  $('#fd').onsubmit = mkDeposit
  $('#sq').oninput = drawList; $('#cat').onchange = drawList
  $('#sl').onclick = (e) => { const b = e.target.closest('.sm-r'); if (b) pick(b.dataset.id) }
  $('#qt').oninput = est
  $('#fo').onsubmit = placeOrder
  $('#hl').onclick = (e) => { const b = e.target.closest('button[data-o]'); if (b) checkOrder(b.dataset.o, b.closest('.sm-h').querySelector('.r')) }
  loadBal(); loadSvcs(); drawHist(); resumeDep()
}

const loadBal = async () => {
  try { const r = await api('/tools/smm/balance'); setBal(r.balance); note($('#mb'), '') }
  catch (e) { const b = $('#bv'); if (b && S.bal === null) b.textContent = '—'; note($('#mb'), e.message, 1) }
}

/* ---------- daftar layanan ---------- */
const loadSvcs = async () => {
  try {
    const r = await api('/tools/smm/services'); S.svcs = r.services || []
    const cats = [...new Set(S.svcs.map((s) => s.category))].sort((a, b) => a.localeCompare(b))
    $('#cat').innerHTML = '<option value="">Semua kategori (' + S.svcs.length + ')</option>' + cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')
    drawList()
  } catch (e) { const l = $('#sl'); if (l) l.innerHTML = `<p class="sm-empty err">${esc(e.message)}</p>` }
}
const drawList = () => {
  const q = $('#sq').value.trim().toLowerCase(), cat = $('#cat').value, MAX = 60
  const all = S.svcs.filter((s) => (!cat || s.category === cat) && (!q || (s.name + ' ' + s.category + ' ' + s.id).toLowerCase().includes(q)))
  const l = $('#sl')
  if (!all.length) { l.innerHTML = '<p class="sm-empty">Tidak ada layanan yang cocok.</p>'; return }
  l.innerHTML = all.slice(0, MAX).map((s) => `<button type="button" class="sm-r${S.sel && S.sel.id === s.id ? ' on' : ''}" data-id="${esc(s.id)}"><b>${esc(s.name)}</b><span>#${esc(s.id)} · ${rp(s.rate)}/1K · min ${nf(s.min)} · maks ${nf(s.max)}${s.refill ? ' · refill' : ''}</span></button>`).join('')
    + (all.length > MAX ? `<p class="sm-empty">Menampilkan ${MAX} dari ${nf(all.length)}. Persempit dengan kategori atau pencarian.</p>` : '')
}
const pick = (id) => {
  S.sel = S.svcs.find((s) => s.id === id) || null
  $('#sl').querySelectorAll('.sm-r').forEach((b) => b.classList.toggle('on', b.dataset.id === id))
  const d = $('#sd'), s = S.sel; d.hidden = !s
  if (s) {
    d.innerHTML = `<b>${esc(s.name)}</b><span>${rp(s.rate)} per 1.000 · jumlah ${nf(s.min)}–${nf(s.max)} · ${s.refill ? 'ada refill' : 'tanpa refill'}</span>`
    const q = $('#qt'); q.min = s.min; q.max = s.max; q.placeholder = `Jumlah (${nf(s.min)}–${nf(s.max)})`
  }
  est()
}
const qty = () => Math.floor(Number($('#qt').value))
const cost = () => (S.sel ? Math.max(1, Math.ceil((S.sel.rate * qty()) / 1000)) : 0)
function est() {
  const e = $('#es'); if (!e) return
  const q = qty(); if (!S.sel || !(q > 0)) { e.textContent = ''; return }
  const c = cost()
  e.innerHTML = `Biaya <b>${rp(c)}</b>` + (S.bal !== null && c > S.bal ? ` · <span class="err">saldo kurang ${rp(c - S.bal)}</span>` : '')
}

/* ---------- pesan ---------- */
async function placeOrder(ev) {
  ev.preventDefault()
  const m = $('#mo'), b = $('#bo'), s = S.sel, q = qty()
  if (!s) return note(m, 'Pilih layanan dulu.', 1)
  if (!(q >= s.min && q <= s.max)) return note(m, `Jumlah harus ${nf(s.min)}–${nf(s.max)}.`, 1)
  const c = cost()
  if (S.bal !== null && (S.bal <= 0 || c > S.bal)) {
    note(m, S.bal <= 0 ? 'Saldo kamu Rp0. Deposit dulu untuk memesan.' : `Saldo tidak cukup, kurang ${rp(c - S.bal)}. Deposit dulu.`, 1)
    return openDep(Math.max(10000, Math.ceil((c - Math.max(0, S.bal)) / 1000) * 1000))
  }
  if (b.dataset.sure !== '1') {   /* ketuk dua kali: pesanan tidak bisa dibatalkan */
    b.dataset.sure = '1'; b.textContent = `Konfirmasi · ${rp(c)}`
    setTimeout(() => { if (b.isConnected && !b.disabled) { delete b.dataset.sure; b.textContent = 'Pesan' } }, 4000); return
  }
  delete b.dataset.sure; b.disabled = true; b.textContent = 'Memproses…'; note(m, '')
  try {
    const r = await put('/tools/smm/order', { service: s.id, link: $('#lk').value.trim(), quantity: q }, 'POST')
    note(m, `Pesanan #${r.order} dibuat. Saldo terpotong ${rp(r.cost)}.`); $('#qt').value = ''; setBal(r.balance); drawHist()
  } catch (e) {
    note(m, e.message, 1)
    if (e.status === 402) { loadBal(); openDep() }
    else if (e.status === 504) drawHist()
  }
  b.disabled = false; b.textContent = 'Pesan'
}

/* ---------- daftar & status pesanan ---------- */
const fmtT = (t) => new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const drawHist = async () => {
  const box = $('#hl'); if (!box) return
  try {
    const { orders } = await api('/tools/smm/orders')
    box.innerHTML = orders.length ? orders.map((o) => `<div class="sm-h"><div class="t"><b>${esc(o.name)}</b>${String(o.order_id).startsWith('unk_') ? '' : `<button class="btn ghost sm" data-o="${esc(o.order_id)}" type="button">Cek</button>`}</div>
      <div class="d"><span>${String(o.order_id).startsWith('unk_') ? 'Tidak ada ID' : '#' + esc(o.order_id)} · ${nf(o.qty)} · ${rp(o.cost)} · ${esc(fmtT(o.created_at))}</span></div><div class="d"><span class="r">${stChip(o.status)}${o.refunded ? ' <span>dikembalikan ke saldo</span>' : ''}</span></div></div>`).join('')
      : '<p class="hint">Belum ada pesanan.</p>'
  } catch (e) { box.innerHTML = `<p class="msg err">${esc(e.message)}</p>` }
}
async function checkOrder(id, target) {
  target.innerHTML = '<span class="hint">Memeriksa…</span>'
  try {
    const r = await api('/tools/smm/status?order=' + encodeURIComponent(id))
    const parts = [r.remains != null && `sisa ${nf(r.remains)}`, r.start_count != null && `awal ${nf(r.start_count)}`, r.refunded > 0 && `${rp(r.refunded)} dikembalikan ke saldo`].filter(Boolean).join(' · ')
    target.innerHTML = `${stChip(r.status)} <span>${esc(parts)}</span>`
    if (r.refunded > 0) setBal(r.balance)
  } catch (e) { target.innerHTML = `<span class="msg err">${esc(e.message)}</span>` }
}

/* ---------- deposit ---------- */
function chipSync() { const v = $('#da').value; $('#dc').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.n === v)) }
function openDep(amount) {
  const c = $('#cd'); c.hidden = false
  if (amount) { $('#da').value = amount; chipSync() }
  c.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
const fmtExp = (x) => { const d = new Date(x); return Number.isNaN(+d) ? String(x) : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }
async function mkDeposit(ev) {
  ev.preventDefault()
  const m = $('#md'), b = $('#bd'), amt = Math.floor(Number($('#da').value))
  if (!(amt >= 1000)) return note(m, 'Minimal deposit Rp1.000.', 1)
  b.disabled = true; note(m, 'Membuat deposit…')
  try {
    const r = await put('/tools/smm/deposit', { amount: amt }, 'POST')
    LS(DEPK, { id: r.deposit, t: Date.now(), amount: r.amount, total: r.total_amount, qr: r.qr_url, pay: r.payment_url, exp: r.expired_at })
    note(m, ''); showDep(); startPoll()
  } catch (e) { note(m, e.message, 1) }
  b.disabled = false
}
const depExp = (d) => { const t = Date.parse(String(d.exp || '').replace(' ', 'T')); return Number.isFinite(t) && t < Date.now() }
function showDep() {
  const d = LS(DEPK), v = $('#dv'); if (!v) return
  if (!d) { v.innerHTML = ''; return }
  $('#cd').hidden = false
  const ex = depExp(d)
  v.innerHTML = `<div class="sm-qr">${ex ? '<p class="msg err" style="text-align:center">QR kedaluwarsa. Tutup lalu buat deposit baru.</p>' : d.qr ? `<img alt="QR pembayaran" src="${esc(d.qr)}">` : ''}
    <div class="sm-rows"><div><span>Nominal</span><b>${rp(d.amount)}</b></div><div><span>Total bayar</span><b>${rp(d.total)}</b></div>${d.exp ? `<div><span>Berlaku s/d</span><b>${esc(fmtExp(d.exp))}</b></div>` : ''}<div><span>Status</span><b id="dst">${stChip(ex ? 'Kedaluwarsa' : 'Menunggu pembayaran')}</b></div></div>
    <div class="sm-row2" style="width:100%">${!ex && d.pay ? `<a class="btn go" style="flex:1" href="${esc(d.pay)}" target="_blank" rel="noopener noreferrer">Buka halaman bayar</a>` : ''}<button class="btn ghost" id="bdc" type="button" style="flex:1">Cek status</button></div>
    <button class="btn ghost block" id="bdx" type="button" style="width:100%">${ex ? 'Tutup' : 'Batalkan deposit'}</button></div>`
  $('#bdc').onclick = () => pollDep(true)
  $('#bdx').onclick = () => closeDep(ex)
}
async function closeDep(expired) {
  const d = LS(DEPK), b = $('#bdx'), m = $('#md'); if (!d) return
  if (!expired && b.dataset.sure !== '1') {   /* ketuk dua kali: kalau sudah terlanjur bayar, jangan dibatalkan tanpa sengaja */
    b.dataset.sure = '1'; b.textContent = 'Ketuk lagi untuk batalkan'
    setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'Batalkan deposit' } }, 4000); return
  }
  b.disabled = true
  try {
    const r = await put('/tools/smm/deposit-cancel', { deposit: d.id }, 'POST')
    clearInterval(S.poll); LS(DEPK, null); showDep()
    if (r.paid) { setBal(r.balance); note(m, `Deposit ${rp(r.amount)} ternyata sudah dibayar, saldo sudah bertambah.`) }
    else note(m, expired ? '' : 'Deposit dibatalkan.')
  } catch (e) {
    if (expired || e.status === 404) { clearInterval(S.poll); LS(DEPK, null); showDep(); note(m, '') }   /* QR kedaluwarsa selalu boleh ditutup di browser ini */
    else { note(m, e.message, 1); b.disabled = false }
  }
}
async function pollDep(manual) {
  const d = LS(DEPK); if (!d) return clearInterval(S.poll)
  const st = $('#dst'); if (!st) return clearInterval(S.poll)
  if (manual) st.innerHTML = stChip('Memeriksa…')
  try {
    const r = await api('/tools/smm/deposit-status?deposit=' + encodeURIComponent(d.id))
    if (r.status === 'success') {
      clearInterval(S.poll); LS(DEPK, null); showDep(); setBal(r.balance)
      note($('#md'), `Deposit ${rp(r.amount)}${r.bonus ? ` (+bonus ${rp(r.bonus)})` : ''} berhasil. Saldo sudah bertambah.`)
    } else if (/expire|fail|cancel|reject/.test(r.status)) {
      clearInterval(S.poll); LS(DEPK, null); showDep(); note($('#md'), 'Deposit kedaluwarsa atau dibatalkan. Buat deposit baru.', 1)
    } else if (depExp(d)) showDep()
    else st.innerHTML = stChip('Menunggu pembayaran')
  } catch (e) {
    if (e.status === 404) { clearInterval(S.poll); LS(DEPK, null); showDep() }
    else if (manual) st.innerHTML = `<span class="err">${esc(e.message)}</span>`
  }
}
function startPoll() { clearInterval(S.poll); S.poll = setInterval(() => { if (!document.hidden) pollDep(false) }, 6000) }
function resumeDep() {
  const d = LS(DEPK); if (!d) return
  if (Date.now() - d.t > 24 * 3600e3) return LS(DEPK, null)
  showDep(); pollDep(false); startPoll()
}

/* ---------- mulai ---------- */
ready.then(({ user }) => { if (!user) return (location.href = '/login.html?next=/smm'); view() })
