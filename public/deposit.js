/* Deposit saldo (QRIS via BTZPay), dipakai halaman Layanan OTP. Memakai endpoint yang sama dengan halaman SMM (/tools/smm/deposit*),
 * jadi saldo OTP dan SMM tetap satu dompet. Butuh common.js ($, esc, rp, api, put).
 * Deposit yang sedang berjalan disimpan di localStorage dengan kunci yang sama seperti halaman SMM, jadi bisa dilanjutkan dari halaman mana pun. */
window.ArvoDeposit = (() => {
  const DEPK = 'arvo_smm_dep'
  const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)) } catch {} return null }
  const nf = (n) => Number(n || 0).toLocaleString('id-ID')
  const fmtExp = (x) => { const d = new Date(x); return Number.isNaN(+d) ? String(x) : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }
  const stChip = (s) => { const k = String(s || '').toLowerCase(); const c = /success|berhasil/.test(k) ? 'ok' : /cancel|fail|kedaluwarsa/.test(k) ? 'bad' : 'wait'; return `<span class="dp-st ${c}">${esc(s)}</span>` }
  const expired = (d) => { const t = Date.parse(String(d.exp || '').replace(' ', 'T')); return Number.isFinite(t) && t < Date.now() }

  if (!document.getElementById('dp-css')) {
    const st = document.createElement('style'); st.id = 'dp-css'
    st.textContent = `.dp .card{margin-bottom:10px}.dp .card-h{padding:10px 12px;font-size:13px}.dp .card-b{padding:11px 12px;display:grid;gap:8px}
.dp input{width:100%;padding:9px 11px}.dp .btn{padding:9px 14px}
.dp .msg{margin:0;font-size:12.5px;white-space:pre-wrap;overflow-wrap:anywhere}.dp .msg:empty{display:none}
.dp-chips{display:flex;gap:6px;flex-wrap:wrap}.dp-chips button{border:1px solid var(--line);background:none;color:var(--tx);border-radius:99px;padding:5px 12px;font:600 12px inherit;font-family:inherit;cursor:pointer}
.dp-chips button.on{border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent)}
.dp-row2{display:flex;gap:8px}.dp-row2 input{flex:1}
.dp-qr{display:grid;gap:8px;justify-items:center;border:1px solid var(--line);border-radius:12px;padding:12px}.dp-qr img{width:100%;max-width:210px;background:#fff;border-radius:10px;padding:6px}
.dp-rows{width:100%;display:grid;gap:5px;font-size:12.5px}.dp-rows div{display:flex;justify-content:space-between;gap:10px}.dp-rows span{color:var(--mut)}.dp-rows b{text-align:right}
.dp-st{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11.5px;font-weight:700;border:1px solid;white-space:nowrap}
.dp-st.ok{color:var(--g,#4ade80);background:color-mix(in srgb,var(--g,#4ade80) 13%,transparent)}.dp-st.wait{color:#f5a524;background:color-mix(in srgb,#f5a524 13%,transparent)}.dp-st.bad{color:var(--bad,#ef4444);background:color-mix(in srgb,#ef4444 13%,transparent)}`
    document.head.append(st)
  }

  /* host: elemen kosong tempat panel deposit digambar. opt: { onBalance(n), min, max } */
  const mount = (host, opt = {}) => {
    const S = { poll: null, min: opt.min || 1000, max: opt.max || 50000000 }
    const q = (s) => host.querySelector(s)
    const say = (t, bad) => { const m = q('#dp-m'); if (!m) return; m.textContent = t; m.className = 'msg' + (bad ? ' err' : ''); m.style.color = bad || !t ? '' : 'var(--g)' }
    host.classList.add('dp')
    host.innerHTML = `<div class="card" id="dp-card" hidden><div class="card-h"><span>Deposit saldo</span></div><div class="card-b">
      <div class="dp-chips" id="dp-c">${[10000, 20000, 50000, 100000].map((n) => `<button type="button" data-n="${n}">${nf(n)}</button>`).join('')}</div>
      <form id="dp-f" class="dp-row2"><input id="dp-a" type="number" inputmode="numeric" min="${S.min}" step="1" placeholder="Nominal (Rp)" required><button class="btn" id="dp-b">Buat deposit</button></form>
      <p class="msg" id="dp-m"></p><div id="dp-v"></div></div></div>`

    const chipSync = () => { const v = q('#dp-a').value; q('#dp-c').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.n === v)) }
    const open = (amount) => {
      q('#dp-card').hidden = false
      if (amount) { q('#dp-a').value = amount; chipSync() }
      q('#dp-card').scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    const setLimits = (min, max) => { if (min) { S.min = min; const a = q('#dp-a'); if (a) a.min = min } if (max) S.max = max }

    const show = () => {
      const d = LS(DEPK), v = q('#dp-v'); if (!v) return
      if (!d) { v.innerHTML = ''; return }
      q('#dp-card').hidden = false
      const ex = expired(d)
      v.innerHTML = `<div class="dp-qr">${ex ? '<p class="msg err" style="text-align:center">QR kedaluwarsa. Tutup lalu buat deposit baru.</p>' : d.qr ? `<img alt="QR pembayaran" src="${esc(d.qr)}">` : ''}
        <div class="dp-rows"><div><span>Nominal</span><b>${rp(d.amount)}</b></div><div><span>Total bayar</span><b>${rp(d.total)}</b></div>${d.exp ? `<div><span>Berlaku s/d</span><b>${esc(fmtExp(d.exp))}</b></div>` : ''}<div><span>Status</span><b id="dp-st">${stChip(ex ? 'Kedaluwarsa' : 'Menunggu pembayaran')}</b></div></div>
        <div class="dp-row2" style="width:100%"><button class="btn ghost" id="dp-chk" type="button" style="flex:1">Cek status</button></div>
        <button class="btn ghost" id="dp-x" type="button" style="width:100%">${ex ? 'Tutup' : 'Batalkan deposit'}</button></div>`
      const img = v.querySelector('img')
      if (img) img.onerror = () => img.replaceWith(Object.assign(document.createElement('p'), { className: 'msg err', textContent: 'QR gagal dimuat. Tutup lalu buat deposit baru, atau hubungi admin.' }))
      q('#dp-chk').onclick = () => poll(true)
      q('#dp-x').onclick = () => close(ex)
    }

    const make = async (ev) => {
      ev.preventDefault()
      const b = q('#dp-b'), amt = Math.floor(Number(q('#dp-a').value))
      if (!(amt >= S.min)) return say(`Minimal deposit ${rp(S.min)}.`, 1)
      if (amt > S.max) return say(`Maksimal deposit ${rp(S.max)}.`, 1)
      b.disabled = true; say('Membuat deposit…')
      try {
        const r = await put('/tools/smm/deposit', { amount: amt }, 'POST')
        LS(DEPK, { id: r.deposit, t: Date.now(), amount: r.amount, total: r.total_amount, qr: r.qr_url, pay: r.payment_url, exp: r.expired_at })
        say(''); show(); start()
      } catch (e) { say(e.message, 1) }
      b.disabled = false
    }

    async function close(isExpired) {
      const d = LS(DEPK), b = q('#dp-x'); if (!d || !b) return
      if (!isExpired && b.dataset.sure !== '1') {   /* ketuk dua kali: kalau sudah terlanjur bayar, jangan dibatalkan tanpa sengaja */
        b.dataset.sure = '1'; b.textContent = 'Ketuk lagi untuk batalkan'
        setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'Batalkan deposit' } }, 4000); return
      }
      b.disabled = true
      try {
        const r = await put('/tools/smm/deposit-cancel', { deposit: d.id }, 'POST')
        clearInterval(S.poll); LS(DEPK, null); show()
        if (r.paid) { opt.onBalance && opt.onBalance(r.balance); say(`Deposit ${rp(r.amount)} ternyata sudah dibayar, saldo sudah bertambah.`) }
        else say(isExpired ? '' : 'Deposit dibatalkan.')
      } catch (e) {
        if (isExpired || e.status === 404) { clearInterval(S.poll); LS(DEPK, null); show(); say('') }   /* QR kedaluwarsa selalu boleh ditutup di browser ini */
        else { say(e.message, 1); b.disabled = false }
      }
    }

    async function poll(manual) {
      const d = LS(DEPK); if (!d) return clearInterval(S.poll)
      const st = q('#dp-st'); if (!st) return clearInterval(S.poll)
      if (manual) st.innerHTML = stChip('Memeriksa…')
      try {
        const r = await api('/tools/smm/deposit-status?deposit=' + encodeURIComponent(d.id))
        if (r.status === 'success') {
          clearInterval(S.poll); LS(DEPK, null); show(); opt.onBalance && opt.onBalance(r.balance)
          say(`Deposit ${rp(r.amount)} berhasil. Saldo sudah bertambah.`)
        } else if (/expire|fail|cancel|reject/.test(r.status)) {
          clearInterval(S.poll); LS(DEPK, null); show(); say('Deposit kedaluwarsa atau dibatalkan. Buat deposit baru.', 1)
        } else if (expired(d)) show()
        else st.innerHTML = stChip('Menunggu pembayaran')
      } catch (e) {
        if (e.status === 404) { clearInterval(S.poll); LS(DEPK, null); show() }
        else if (manual) st.innerHTML = `<span class="err">${esc(e.message)}</span>`
      }
    }
    function start() { clearInterval(S.poll); S.poll = setInterval(() => { if (!document.hidden) poll(false) }, 6000) }

    q('#dp-c').onclick = (e) => { const b = e.target.closest('button[data-n]'); if (b) { q('#dp-a').value = b.dataset.n; chipSync() } }
    q('#dp-a').oninput = chipSync
    q('#dp-f').onsubmit = make
    const d0 = LS(DEPK)
    if (d0) { if (Date.now() - d0.t > 24 * 3600e3) LS(DEPK, null); else { show(); poll(false); start() } }
    return { open, setLimits }
  }
  return { mount }
})()
