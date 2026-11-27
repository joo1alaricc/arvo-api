/* Tambahan dashboard admin: Pembayaran (QRIS), Media, Update web (ZIP -> GitHub), Tim admin, dan endpoint kode nyata. */
Object.assign(MENU, { pembayaran: ['Pembayaran', 'bag'], media: ['Media', 'image'], deploy: ['Update web', 'download'], tim: ['Tim admin', 'user'] })

const SC = {}
const loadScript = (src) => (SC[src] ||= new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Gagal memuat pustaka: ' + src)); document.head.append(s) }))
const fileB64 = (file) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => no(r.error); r.readAsDataURL(file) })
const u8B64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s) }
const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n > 1024 ? Math.round(n / 1024) + ' KB' : n + ' B')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const note = (t, bad) => `<p class="msg ${bad ? 'err' : ''}" style="margin:6px 0">${t}</p>`
const sensible = (e) => (e.status === 503 && /GitHub belum/.test(e.message) ? `${esc(e.message)}<br><span class="sub" style="margin:0">Lihat bagian GITHUB_API di wrangler.toml.</span>` : esc(e.message))

/* ===================== PEMBAYARAN / QRIS ===================== */
async function decodeQr(file) {
  const url = URL.createObjectURL(file)
  const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Gambar tidak bisa dibuka.')); i.src = url })
  try {
    let jsqrOk = true
    try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js') } catch { jsqrOk = false }
    if (jsqrOk) for (const maxW of [1400, 900, 2000, 600]) {
      const k = Math.min(1, maxW / im.naturalWidth), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k)
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h)
      const r = jsQR(x.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' }); if (r && r.data) return r.data
    }
    if ('BarcodeDetector' in window) { try { const r = await new BarcodeDetector({ formats: ['qr_code'] }).detect(im); if (r[0]) return r[0].rawValue } catch {} }
  } finally { URL.revokeObjectURL(url) }
  throw new Error('QR tidak terbaca. Pakai gambar yang tajam dan hanya berisi QR, atau tempel teks QRIS manual di kolom bawah.')
}

/* ---- BTZPay: pengaturan deposit + Sandbox ---- */
const SECRET_DOC = { apikey: ['BTZPAY_APIKEY', 'API key Payment Method (live) dari dashboard BTZPay. Dipakai membuat, mengecek, dan membatalkan transaksi deposit user.'], sandbox_apikey: ['BTZPAY_SANDBOX_APIKEY', 'API key Payment Method khusus uji (opsional). Hanya dipakai panel Sandbox ini.'], callback_token: ['BTZPAY_CALLBACK_TOKEN', 'Token acak buatanmu sendiri (mis. 32+ karakter). Ditempel di callback URL supaya hanya BTZPay yang bisa memanggil Arvo.'] }
const stIc = (s) => ({ sukses: 'ok', success: 'ok' }[String(s).toLowerCase()] ? '✅' : /gagal|expired|cancel|canceled|review/.test(String(s).toLowerCase()) ? '⚠️' : '⏳')
function btzHtml(p) {
  const c = p.config, sup = LEVEL === 'super', dis = sup ? '' : 'disabled'
  const sec = Object.entries(SECRET_DOC).map(([k, [n, d]]) => `<div style="margin:6px 0;font-size:12.5px">${p.secrets[k] ? '✅' : '❌'} <code>${n}</code> <span class="sub" style="margin:0">— ${d}</span></div>`).join('')
  const opt = (v, t) => `<option value="${v}" ${c.payment_method === v ? 'selected' : ''}>${t}</option>`
  const cb = p.last_callback
  return `<div class="panel"><h3>Deposit via BTZPay</h3>
    <p class="sub" style="font-size:12.5px">Saat aktif, deposit saldo user dibuat lewat BTZPay (QRIS/e-wallet) dan dikredit otomatis begitu pembayaran terdeteksi. Saat nonaktif, deposit memakai panel lama. Uji dulu di Sandbox sebelum mengaktifkan.</p>
    <div style="margin:8px 0">${sec}</div>
    <label style="display:flex;gap:8px;align-items:center;margin:10px 0"><input type="checkbox" id="bz-en" ${c.enabled ? 'checked' : ''} ${dis}> Aktifkan deposit via BTZPay</label>
    <div class="row" style="flex-wrap:wrap;gap:10px">
      <div><label>Metode</label><select id="bz-pm" ${dis}>${opt('', 'Otomatis (default akun)')}${opt('qrisdana', 'QRIS DANA')}${opt('qrisgopay', 'QRIS GoPay')}${opt('qrisorkut', 'QRIS OrKut')}${opt('qrisshopeepay', 'QRIS ShopeePay')}</select></div>
      <div><label>Timeout (menit, 1-60)</label><input id="bz-to" type="number" min="1" max="60" value="${c.timeout_min}" ${dis}></div>
      <div><label>Fee tetap (Rp)</label><input id="bz-fee" type="number" min="0" value="${c.fee}" ${dis}></div>
      <div><label>Deposit minimal</label><input id="bz-min" type="number" min="1" value="${c.min_amount}" ${dis}></div>
      <div><label>Deposit maksimal</label><input id="bz-max" type="number" min="1" value="${c.max_amount}" ${dis}></div>
      <div><label>Maks. deposit tertunda / user</label><input id="bz-mp" type="number" min="1" max="10" value="${c.max_pending}" ${dis}></div>
    </div>
    <label style="margin-top:8px;display:block">Return URL (opsional, kosong = halaman /smm)</label>
    <input id="bz-ru" value="${esc(c.return_url)}" placeholder="https://…" ${dis}>
    <p class="sub" style="font-size:12px;margin-top:8px">Callback URL (otomatis dikirim tiap transaksi, tidak perlu diisi di BTZPay):<br><code style="overflow-wrap:anywhere">${esc(p.callback_url)}</code></p>
    <p class="sub" style="font-size:12px">Callback terakhir: ${cb ? `${esc(fmtExp(cb.at))} · ${esc(cb.pay_id || '-')} · status ${esc(cb.status || '-')} · ${cb.matched ? 'cocok deposit' : 'bukan deposit (uji)'}${cb.result ? ' → ' + esc(cb.result) : ''}` : 'belum ada'}</p>
    <p class="msg" id="bz-m"></p>
    <div class="row"><button class="btn" id="bz-save" ${dis}>Simpan pengaturan</button></div>
    ${sup ? '' : '<p class="sub" style="font-size:12px">Hanya super admin yang bisa mengubah pengaturan dan memakai Sandbox.</p>'}
  </div>
  <div class="panel"><h3>Sandbox (uji pembayaran)</h3>
    <p class="sub" style="font-size:12.5px">Membuat transaksi uji dengan <code>BTZPAY_SANDBOX_APIKEY</code>; tidak mengubah saldo user mana pun. Tombol “Simulasikan bayar” meniru notifikasi dari aplikasi listener sehingga transaksi menjadi sukses dan callback ke Arvo bisa diuji.</p>
    <div class="row"><input id="sb-amt" type="number" min="1" max="100000" value="1000" style="max-width:140px" ${dis}><button class="btn" id="sb-new" ${dis}>Buat transaksi uji</button></div>
    <p class="msg" id="sb-m"></p><div id="sb-v"></div>
  </div>
  <div class="panel"><h3>Deposit terbaru</h3>
    <p class="sub" style="font-size:12.5px">Berhasil: <b>${p.credited_count}</b> (${rp(p.credited_sum)}) · Tertunda: <b>${p.pending}</b> · Perlu diperiksa: <b>${p.review}</b></p>
    <div style="overflow-x:auto"><table><thead><tr><th>Waktu</th><th>User</th><th>Nominal</th><th>Total bayar</th><th>Via</th><th>Status</th></tr></thead><tbody>${p.items.map((d) => `<tr><td>${esc(fmtExp(d.created_at))}</td><td>${esc(d.username || '-')}</td><td>${rp(d.amount)}</td><td>${rp(d.total)}</td><td>${d.provider === 'btzpay' ? 'BTZPay' : 'Panel lama'}</td><td>${stIc(d.status)} ${esc(d.status)}${d.credited ? '' : ''}</td></tr>`).join('') || '<tr><td colspan="6">Belum ada deposit.</td></tr>'}</tbody></table></div>
  </div>`
}
const fmtExp = (x) => { const d = new Date(x); return Number.isNaN(+d) ? String(x) : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }
function btzWire(reload) {
  const m = $('#bz-m'), sm = $('#sb-m'), sv = $('#sb-v'); let sb = null, timer = null
  $('#bz-save').onclick = async () => {
    try {
      await put('/admin/pay', { enabled: $('#bz-en').checked, payment_method: $('#bz-pm').value, timeout_min: +$('#bz-to').value, fee: +$('#bz-fee').value, min_amount: +$('#bz-min').value, max_amount: +$('#bz-max').value, max_pending: +$('#bz-mp').value, return_url: $('#bz-ru').value.trim() })
      say(m, 'Pengaturan tersimpan.'); toast('Tersimpan')
    } catch (e) { say(m, e.message, 1) }
  }
  const draw = (extra = '') => {
    if (!sb) { sv.innerHTML = ''; return }
    sv.innerHTML = `<div style="display:grid;gap:8px;justify-items:center;margin-top:10px">${sb.qr_url ? `<img alt="QR uji" src="${esc(sb.qr_url)}" style="width:220px;max-width:100%;background:#fff;border-radius:12px;padding:8px">` : '<p class="sub">Tidak ada QR (metode e-wallet): pakai link bayar.</p>'}
      <div class="sub" style="font-size:12.5px;text-align:center">ID <code>${esc(sb.id)}</code><br>Nominal ${rp(sb.amount)} · fee ${rp(sb.fee)} · total <b>${rp(sb.total)}</b><br>Status: <b id="sb-st">${esc(sb.status)}</b>${sb.callback_set ? '' : '<br>⚠️ BTZPAY_CALLBACK_TOKEN belum diisi: callback tidak diuji.'}${extra}</div>
      <div class="row">${sb.payment_url ? `<a class="btn ghost" target="_blank" rel="noopener noreferrer" href="${esc(sb.payment_url)}">Buka halaman bayar</a>` : ''}<button class="btn ghost" id="sb-chk">Cek status</button><button class="btn" id="sb-sim">Simulasikan bayar</button><button class="btn ghost" id="sb-x">Batalkan</button></div></div>`
    $('#sb-chk').onclick = check; $('#sb-sim').onclick = simulate; $('#sb-x').onclick = cancel
  }
  const check = async () => {
    if (!sb) return
    try { const r = await api(`/admin/pay/sandbox/status?id=${encodeURIComponent(sb.id)}&key=${encodeURIComponent(sb.key)}`); sb.status = r.status; const lc = r.last_callback
      draw(lc ? `<br>Callback terakhir: ${esc(fmtExp(lc.at))} · ${esc(lc.pay_id || '-')} · ${esc(lc.status || '-')}` : ''); if (/sukses|success|gagal|expired|cancel/i.test(r.status)) clearInterval(timer) } catch (e) { say(sm, e.message, 1) }
  }
  const simulate = async () => { try { say(sm, 'Mengirim notifikasi simulasi…'); await put('/admin/pay/sandbox/simulate', { id: sb.id, key: sb.key }, 'POST'); say(sm, 'Simulasi terkirim. Mengecek status…'); setTimeout(check, 1500) } catch (e) { say(sm, e.message, 1) } }
  const cancel = async () => { try { await put('/admin/pay/sandbox/cancel', { id: sb.id }, 'POST'); clearInterval(timer); sb.status = 'cancel'; draw(); say(sm, 'Transaksi uji dibatalkan.') } catch (e) { say(sm, e.message, 1) } }
  $('#sb-new').onclick = async () => {
    say(sm, 'Membuat transaksi uji…'); clearInterval(timer)
    try { sb = await put('/admin/pay/sandbox/create', { amount: +$('#sb-amt').value }, 'POST'); say(sm, 'Transaksi uji dibuat.'); draw(); timer = setInterval(() => { if (!document.hidden && $('#sb-st')) check(); else if (!$('#sb-st')) clearInterval(timer) }, 6000) }
    catch (e) { say(sm, e.message, 1) }
  }
}

V.pembayaran = async function () {
  const q = await api('/admin/qris'), pay = await api('/admin/pay')
  const src = { secret: 'secret QRIS_STATIC', dashboard: 'tersimpan dari dashboard (aktif)', image_url: 'gambar QRIS_IMAGE_URL (dibaca server)' }[q.source]
  out().innerHTML = `<h1>Pembayaran</h1>
    ${btzHtml(pay)}
    <div class="panel"><h3>QRIS statis (pembelian paket)</h3>
      <p class="sub">Sumber saat ini: <b>${src}</b>${q.info?.merchant ? ` · merchant <b>${esc(q.info.merchant)}</b>` : ''}</p>
      <p class="sub" style="font-size:12.5px">Unggah foto QRIS-mu. Gambar dibaca <b>di browser</b> (bukan di server), jadi JPG/JPEG/PNG apa pun aman. Teks QRIS-nya lalu disimpan dan dipakai untuk membuat QR dinamis tiap order.</p>
      <div class="row"><input type="file" id="qf" accept="image/*"></div>
      <label style="margin-top:10px;display:block">Teks QRIS (hasil baca, bisa ditempel manual)</label>
      <textarea id="qp" rows="4" spellcheck="false" class="mono" placeholder="00020101021126…6304XXXX"></textarea>
      <p class="msg" id="qm"></p>
      <div class="row"><button class="btn" id="qs">Simpan QRIS</button><button class="btn ghost" id="qt">Tes buat QR Rp1.000</button></div>
      <div id="qr" style="margin-top:12px"></div></div>`
  btzWire()
  const m = $('#qm'), pl = $('#qp')
  $('#qf').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return
    say(m, 'Membaca gambar…')
    try { pl.value = await decodeQr(f); say(m, 'Terbaca. Periksa lalu klik Simpan QRIS.') } catch (er) { say(m, er.message, 1) }
  }
  $('#qs').onclick = async () => {
    try { const r = await put('/admin/qris', { payload: pl.value.trim() }); say(m, `Tersimpan. Merchant: ${r.info.merchant || '-'} (${r.info.city || '-'}). Klik "Tes" untuk mencoba.`); toast('QRIS disimpan') } catch (er) { say(m, er.message, 1) }
  }
  $('#qt').onclick = async () => {
    say(m, 'Membuat QR tes…')
    try { const r = await put('/admin/qris/test', {}, 'POST'); say(m, `Berhasil. Merchant ${r.qris.merchant || '-'}. Coba scan dengan e-wallet (jangan dibayar).`); $('#qr').innerHTML = `<img alt="QRIS tes" src="${r.qris.image}" style="width:220px;max-width:100%;border-radius:12px;background:#fff;padding:8px">` }
    catch (er) { say(m, 'Gagal: ' + er.message, 1) }
  }
}

/* ===================== MEDIA ===================== */
V.media = async function () {
  const { files } = await api('/admin/media'), isSuper = LEVEL === 'super'
  const isVid = (n) => /\.(mp4|webm)$/i.test(n), isImg = (n) => /\.(jpe?g|png|webp|gif|ico)$/i.test(n)
  out().innerHTML = `<div class="bar"><h1>Media</h1><label class="btn" style="cursor:pointer">${ico('plus')} Unggah<input id="mf" type="file" multiple accept="image/*,video/mp4,video/webm,audio/*" hidden></label></div>
    <p class="sub">Isi folder <span class="mono">public/media</span> di repo. Unggah/hapus = commit ke GitHub, tampil di web setelah deploy selesai.</p>
    <p class="msg" id="mm"></p>
    <div class="panel tw" style="padding:6px 10px"><table><tr><th>File</th><th>Nama</th><th>Ukuran</th><th>Aksi</th></tr>${files.map((f) => `<tr>
      <td style="width:84px">${isImg(f.name) ? `<img loading="lazy" src="/media/${encodeURIComponent(f.name)}" alt="" style="width:72px;height:48px;object-fit:cover;border-radius:8px;background:var(--bg)">` : isVid(f.name) ? `<video muted preload="metadata" src="/media/${encodeURIComponent(f.name)}#t=0.5" style="width:72px;height:48px;object-fit:cover;border-radius:8px;background:var(--bg)"></video>` : '♪'}</td>
      <td class="mono" style="font-size:12px">/media/${esc(f.name)}</td><td>${fmtSize(f.size)}</td>
      <td><div class="acts">${isSuper && isVid(f.name) ? `<button class="btn ghost sm" data-hv="${esc(f.name)}">Jadi hero video</button>` : ''}${isSuper && isImg(f.name) ? `<button class="btn ghost sm" data-hp="${esc(f.name)}">Jadi poster hero</button>` : ''}<button class="btn ghost red sm" data-dm="${esc(f.name)}">Hapus</button></div></td></tr>`).join('') || '<tr><td colspan="4" class="sub">Belum ada media.</td></tr>'}</table></div>`
  const m = $('#mm')
  $('#mf').onchange = async (e) => {
    for (const f of e.target.files) {
      if (f.size > 12 * 1024 * 1024) { say(m, `${f.name}: maksimal 12 MB.`, 1); continue }
      say(m, `Mengunggah ${f.name}…`)
      try { await put('/admin/media', { name: f.name, data: await fileB64(f) }); toast(f.name + ' terunggah') } catch (er) { say(m, `${f.name}: ${er.message}`, 1); return }
    }
    V.media()
  }
  out().querySelectorAll('[data-dm]').forEach((b) => (b.onclick = async () => { if (confirm('Hapus /media/' + b.dataset.dm + ' dari repo?')) { try { await api('/admin/media/' + encodeURIComponent(b.dataset.dm), { method: 'DELETE' }); toast('Dihapus'); V.media() } catch (er) { say(m, er.message, 1) } } }))
  const hero = async (k, name) => { try { await put('/admin/media/hero', { [k]: '/media/' + name }, 'PUT'); toast('wrangler.toml diperbarui, menunggu deploy') } catch (er) { say(m, er.message, 1) } }
  out().querySelectorAll('[data-hv]').forEach((b) => (b.onclick = () => hero('video', b.dataset.hv)))
  out().querySelectorAll('[data-hp]').forEach((b) => (b.onclick = () => hero('poster', b.dataset.hp)))
}

/* ===================== TIM ADMIN ===================== */
V.tim = async function () {
  const { admins } = await api('/admin/admins')
  out().innerHTML = `<h1>Tim admin</h1>
    <p class="sub">Admin tambahan bisa mengelola user, order, paket, kode, blokir IP, pembayaran, dan media. Mereka <b>tidak bisa</b> menambah admin lain, menambah/mengubah endpoint, atau mengubah kode web.</p>
    <div class="panel"><div class="row"><input id="an" placeholder="Username yang sudah terdaftar" style="flex:1"><button class="btn" id="aa">${ico('plus')} Jadikan admin</button></div><p class="msg" id="am"></p></div>
    <div class="panel tw" style="padding:6px 10px"><table><tr><th>User</th><th>Email</th><th>Ditambah</th><th></th></tr>${admins.map((a) => `<tr><td><b>${esc(a.username || '#' + a.id)}</b></td><td>${esc(a.email || '–')}</td><td>${fmtDT(a.added_at)}</td><td><button class="btn ghost red sm" data-ra="${a.id}">Cabut</button></td></tr>`).join('') || '<tr><td colspan="4" class="sub">Belum ada admin tambahan.</td></tr>'}</table></div>`
  $('#aa').onclick = async () => { try { const r = await put('/admin/admins', { username: $('#an').value }, 'POST'); toast(r.username + ' jadi admin'); V.tim() } catch (e) { say($('#am'), e.message, 1) } }
  out().querySelectorAll('[data-ra]').forEach((b) => (b.onclick = async () => { if (confirm('Cabut akses admin?')) { await api('/admin/admins/' + b.dataset.ra, { method: 'DELETE' }); V.tim() } }))
}

/* ===================== UPDATE WEB (ZIP -> GitHub) ===================== */
const TEXT_EXT = /\.(js|mjs|cjs|json|html|css|md|txt|toml|yml|yaml|svg|xml|sql|ts|jsx|tsx|env|gitignore)$|^(LICENSE|\.gitignore)$/i
const SKIP = /(^|\/)(node_modules|\.git|\.wrangler|__MACOSX)(\/|$)|(^|\/)\.DS_Store$/
const gitSha = async (u8) => {
  const head = new TextEncoder().encode(`blob ${u8.length}\0`), all = new Uint8Array(head.length + u8.length); all.set(head); all.set(u8, head.length)
  return [...new Uint8Array(await crypto.subtle.digest('SHA-1', all))].map((b) => b.toString(16).padStart(2, '0')).join('')
}
const isText = (path, u8) => TEXT_EXT.test(path.split('/').pop()) || !u8.subarray(0, 8000).includes(0)
const b64Bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
const dec = (u8) => new TextDecoder().decode(u8)

/* diff baris sederhana (LCS) dengan pemangkasan awal/akhir */
function lineDiff(a, b) {
  const A = a.split('\n'), B = b.split('\n'); let s = 0
  while (s < A.length && s < B.length && A[s] === B[s]) s++
  let ea = A.length, eb = B.length
  while (ea > s && eb > s && A[ea - 1] === B[eb - 1]) { ea--; eb-- }
  const x = A.slice(s, ea), y = B.slice(s, eb), n = x.length, m = y.length, ops = []
  for (let i = 0; i < s; i++) ops.push([' ', A[i]])
  if (n * m > 6e6) { x.forEach((l) => ops.push(['-', l])); y.forEach((l) => ops.push(['+', l])) }
  else {
    const W = m + 1, t = new Uint32Array((n + 1) * W)
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i * W + j] = x[i] === y[j] ? t[(i + 1) * W + j + 1] + 1 : Math.max(t[(i + 1) * W + j], t[i * W + j + 1])
    let i = 0, j = 0
    while (i < n && j < m) { if (x[i] === y[j]) { ops.push([' ', x[i]]); i++; j++ } else if (t[(i + 1) * W + j] >= t[i * W + j + 1]) ops.push(['-', x[i++]]); else ops.push(['+', y[j++]]) }
    while (i < n) ops.push(['-', x[i++]]); while (j < m) ops.push(['+', y[j++]])
  }
  for (let i = ea; i < A.length; i++) ops.push([' ', A[i]])
  return ops
}
const diffHtml = (ops) => {
  const keep = new Array(ops.length).fill(false)
  ops.forEach((o, i) => { if (o[0] !== ' ') for (let k = Math.max(0, i - 3); k <= Math.min(ops.length - 1, i + 3); k++) keep[k] = true })
  let h = '', gap = false
  ops.forEach((o, i) => {
    if (!keep[i]) { gap = true; return }
    if (gap) { h += '<div style="opacity:.5;padding:2px 8px">⋯</div>'; gap = false }
    const col = o[0] === '+' ? 'background:#1f6f3d33;color:#6fdc8c' : o[0] === '-' ? 'background:#a1262633;color:#ff8a8a' : 'opacity:.7'
    h += `<div style="${col};padding:0 8px;white-space:pre-wrap;word-break:break-all">${o[0]} ${esc(o[1])}</div>`
  })
  return h || '<div class="sub">Tidak ada perbedaan baris.</div>'
}
async function showDiff(item) {
  const d = modal(`<h3 class="mono" style="font-size:14px">${esc(item.path)}</h3><div class="sub">Memuat versi di GitHub…</div>`, 'lg')
  try {
    const cur = await api('/admin/deploy/file?path=' + encodeURIComponent(item.path))
    const oldT = dec(b64Bytes(cur.content || '')), ops = lineDiff(oldT, item.text)
    const plus = ops.filter((o) => o[0] === '+').length, minus = ops.filter((o) => o[0] === '-').length
    d.innerHTML = `<h3 class="mono" style="font-size:14px">${esc(item.path)}</h3><p class="sub"><b style="color:#6fdc8c">+${plus}</b> baris ditambah · <b style="color:#ff8a8a">−${minus}</b> baris dihapus</p>
      <div class="mono" style="font-size:12px;max-height:60vh;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:6px 0">${diffHtml(ops)}</div><div class="row" style="margin-top:10px"><button class="btn ghost" id="dc">Tutup</button></div>`
    $('#dc', d).onclick = () => d.close()
  } catch (e) { d.innerHTML = `<p class="err">${esc(e.message)}</p>` }
}

V.deploy = async function () {
  const [gh, runs] = await Promise.all([api('/admin/github'), api('/admin/deploy/runs').catch(() => ({ runs: [] }))])
  const ok = gh.configured && gh.reachable
  out().innerHTML = `<h1>Update web</h1>
    <div class="panel"><h3>Koneksi GitHub</h3>
      <p class="sub">${ok ? `Terhubung ke <b>${esc(gh.repo)}</b> (branch <span class="mono">${esc(gh.branch)}</span>)${gh.can_push ? '' : ' · <b class="err">token tidak punya izin tulis</b>'}` : gh.configured ? `<span class="err">${esc(gh.message || 'Repo tidak terjangkau')}</span>` : 'Belum dikonfigurasi. Isi <span class="mono">GITHUB_REPO</span> di wrangler.toml, lalu jalankan <span class="mono">wrangler secret put GITHUB_API</span> (token GitHub dengan izin Contents: Read and write), lalu deploy sekali manual.'}</p>
      ${runs.runs?.length ? `<div class="tw"><table>${runs.runs.map((r) => `<tr><td>${esc(r.title || r.name)}</td><td><span class="badge ${r.conclusion === 'success' ? 'online' : r.conclusion === 'failure' ? 'offline' : ''}">${esc(r.conclusion || r.status)}</span></td><td class="sub">${fmtDT(r.at)}</td><td><a href="${esc(r.url)}" target="_blank" rel="noopener" style="color:var(--blue)">buka</a></td></tr>`).join('')}</table></div>` : ''}</div>
    <div class="panel"><h3>Unggah ZIP perubahan</h3>
      <p class="sub" style="font-size:12.5px">ZIP berisi struktur proyek (folder paling luar otomatis diabaikan). Dibandingkan dengan isi repo; kamu lihat dulu apa saja yang berubah. Eksekusi <b>satu file per commit</b>, dan file <b>main</b> (entry Worker) selalu terakhir supaya deploy hanya jalan setelah semua file siap.</p>
      <div class="row"><input type="file" id="zf" accept=".zip,application/zip" ${ok ? '' : 'disabled'}></div><p class="msg" id="zm"></p><div id="zp"></div></div>`
  if (!ok) return
  $('#zf').onchange = (e) => e.target.files[0] && planZip(e.target.files[0])
}

async function planZip(file) {
  const m = $('#zm'), box = $('#zp'); box.innerHTML = ''
  try {
    say(m, 'Membaca ZIP…'); await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')
    const zip = await JSZip.loadAsync(file)
    let names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).map((n) => n.replace(/\\/g, '/')).filter((n) => !SKIP.test(n))
    const firsts = new Set(names.map((n) => n.split('/')[0])), strip = firsts.size === 1 && names.every((n) => n.includes('/')) && !['src', 'public', '.github'].includes([...firsts][0]) ? [...firsts][0] + '/' : ''
    const zmap = {}
    for (const n of names) { const raw = n.slice(strip.length); if (!raw || raw.length > 300) continue; const u8 = await zip.files[Object.keys(zip.files).find((k) => k.replace(/\\/g, '/') === n)].async('uint8array'); if (u8.length > 22 * 1024 * 1024) throw new Error(raw + ' terlalu besar (maks 22 MB).'); zmap[raw] = u8 }
    if (!Object.keys(zmap).length) throw new Error('ZIP kosong.')
    say(m, 'Membandingkan dengan repo…')
    const tree = await api('/admin/deploy/tree'), items = []
    for (const [path, u8] of Object.entries(zmap)) {
      const sha = await gitSha(u8), cur = tree.files[path], text = isText(path, u8) ? dec(u8) : null
      items.push({ path, u8, sha, size: u8.length, text, kind: !cur ? 'new' : cur.sha === sha ? 'same' : 'changed', checked: !cur || cur.sha !== sha })
    }
    const tops = new Set(Object.keys(zmap).filter((p) => p.includes('/')).map((p) => p.split('/')[0]))
    for (const p of Object.keys(tree.files)) if (!(p in zmap) && tops.has(p.split('/')[0]) && !p.startsWith('public/media/') && !p.startsWith('.github/')) items.push({ path: p, kind: 'deleted', checked: false, size: tree.files[p].size })
    const toml = zmap['wrangler.toml'] ? dec(zmap['wrangler.toml']) : '', main = ((toml.match(/^\s*main\s*=\s*"([^"]+)"/m) || [])[1] || 'src/index.js').replace(/^\.\//, '')
    const order = { new: 0, changed: 1, deleted: 2, same: 3 }
    items.sort((a, b) => (a.path === main) - (b.path === main) || order[a.kind] - order[b.kind] || a.path.localeCompare(b.path))
    const cnt = (k) => items.filter((i) => i.kind === k).length
    if (tree.truncated) say(m, 'Peringatan: repo terlalu besar, daftar file GitHub terpotong.', 1)
    else say(m, `${cnt('new')} baru · ${cnt('changed')} berubah · ${cnt('deleted')} hilang dari ZIP · ${cnt('same')} sama (dilewati). File main: ${main}`)
    const KIND = { new: ['Baru', 'online'], changed: ['Berubah', 'premium'], deleted: ['Hapus', 'offline'] }
    const shown = items.filter((i) => i.kind !== 'same')
    box.innerHTML = shown.length ? `<div class="panel tw" style="padding:6px 10px;margin-top:10px"><table><tr><th></th><th>File</th><th>Status</th><th>Ukuran</th><th></th></tr>${shown.map((it, n) => `<tr>
      <td><input type="checkbox" data-i="${n}" ${it.checked ? 'checked' : ''}></td>
      <td class="mono" style="font-size:12px">${esc(it.path)}${it.path === main ? ' <span class="badge vip">main · terakhir</span>' : ''}</td>
      <td><span class="badge ${KIND[it.kind][1]}">${KIND[it.kind][0]}</span>${it.kind === 'deleted' ? '<span class="sub" style="margin:0;font-size:11px"> (tidak dicentang)</span>' : ''}</td>
      <td>${fmtSize(it.size)}</td><td>${it.kind === 'changed' && it.text !== null ? `<button class="btn ghost sm" data-df="${n}">Lihat perubahan</button>` : it.kind === 'new' && it.text !== null ? `<button class="btn ghost sm" data-df="${n}">Lihat isi</button>` : ''}</td></tr>`).join('')}</table></div>
      <div class="row" style="margin-top:10px"><button class="btn go" id="zgo">${ico('play')} Eksekusi satu per satu</button></div>` : '<p class="sub">Tidak ada perubahan: ZIP sama persis dengan repo.</p>'
    box.querySelectorAll('[data-i]').forEach((c) => (c.onchange = () => (shown[c.dataset.i].checked = c.checked)))
    box.querySelectorAll('[data-df]').forEach((b) => (b.onclick = () => { const it = shown[b.dataset.df]; it.kind === 'new' ? modalText(it) : showDiff(it) }))
    const go = $('#zgo'); if (go) go.onclick = () => runPlan(shown.filter((i) => i.checked), main)
  } catch (e) { say(m, e.message, 1) }
}
const modalText = (it) => { const d = modal(`<h3 class="mono" style="font-size:14px">${esc(it.path)}</h3><pre class="mono" style="font-size:12px;max-height:60vh;overflow:auto;white-space:pre-wrap">${esc(it.text.slice(0, 40000))}</pre><div class="row"><button class="btn ghost" id="dc">Tutup</button></div>`, 'lg'); $('#dc', d).onclick = () => d.close() }

async function runPlan(sel, main) {
  if (!sel.length) return toast('Tidak ada file yang dipilih')
  /* urutan: file biasa -> penghapusan -> main paling akhir */
  const steps = [...sel.filter((i) => i.kind !== 'deleted' && i.path !== main), ...sel.filter((i) => i.kind === 'deleted'), ...sel.filter((i) => i.path === main && i.kind !== 'deleted')]
  const d = modal(`<h3>Eksekusi ${steps.length} file</h3><div id="st" style="max-height:55vh;overflow:auto"></div><p class="msg" id="sm"></p><div class="row" style="margin-top:10px"><button class="btn" id="sx" hidden>Lanjutkan</button><button class="btn ghost" id="sc" hidden>Tutup</button></div>`, 'lg')
  d.addEventListener('cancel', (e) => e.preventDefault())
  const st = $('#st', d), sm = $('#sm', d)
  st.innerHTML = steps.map((s, i) => `<div data-s="${i}" style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--line)"><span data-ic style="width:18px">·</span><span class="mono" style="font-size:12px;flex:1">${esc(s.path)}${s.path === main ? ' (main)' : ''}</span><span class="sub" data-r style="margin:0;font-size:11.5px">${s.kind === 'deleted' ? 'hapus' : s.kind === 'new' ? 'baru' : 'ubah'}</span></div>`).join('')
  let at = 0
  const run = async () => {
    $('#sx', d).hidden = true
    for (; at < steps.length; at++) {
      const s = steps[at], row = st.children[at], ic = row.querySelector('[data-ic]'), r = row.querySelector('[data-r]')
      ic.textContent = '…'; row.scrollIntoView({ block: 'nearest' })
      try {
        const res = s.kind === 'deleted' ? await put('/admin/deploy/delete', { path: s.path }, 'POST') : await put('/admin/deploy/file', { path: s.path, content: u8B64(s.u8), message: (s.kind === 'new' ? 'tambah ' : 'ubah ') + s.path }, 'POST')
        ic.textContent = '✓'; ic.style.color = '#6fdc8c'; r.textContent = res.unchanged ? 'sudah sama' : res.commit ? 'commit ' + res.commit : 'ok'
      } catch (e) {
        ic.textContent = '✕'; ic.style.color = '#ff8a8a'; r.textContent = e.message; say(sm, `Berhenti di ${s.path}: ${e.message}`, 1)
        $('#sx', d).hidden = false; $('#sc', d).hidden = false; return
      }
      await sleep(250)
    }
    say(sm, `Selesai. ${steps.length} file masuk ke GitHub${steps.at(-1).path === main ? ', main terakhir' : ''}. Deploy berjalan otomatis (Actions / Workers Builds); cek status di halaman ini beberapa saat lagi.`)
    $('#sc', d).hidden = false
  }
  $('#sx', d).onclick = run; $('#sc', d).onclick = () => { d.close(); V.deploy() }
  run()
}

/* ===================== ENDPOINT KODE NYATA (GitHub) ===================== */
const origEndpoint = V.endpoint
V.endpoint = async function () {
  await origEndpoint()
  const host = document.createElement('div'); out().append(host)
  try { await codePanel(host) } catch (e) { host.innerHTML = `<div class="panel"><h3>Endpoint kode (GitHub)</h3>${note(sensible(e), 1)}</div>` }
}
async function codePanel(host) {
  const { files } = await api('/admin/code-endpoints')
  host.innerHTML = `<div class="bar" style="margin-top:18px"><h2 style="margin:0">Endpoint kode (di GitHub)</h2><button class="btn ghost" id="csync" title="Cocokkan src/api/index.js dengan file di src/api/&lt;kategori&gt;/">Sinkronisasi endpoint</button></div>
    <p class="sub">Dibuat dari tombol <b>Tambah endpoint</b> di atas: kode JavaScript disimpan sebagai file di <span class="mono">src/api/&lt;kategori&gt;/&lt;slug&gt;.js</span>, didaftarkan otomatis, lalu di-deploy. Aktif setelah deploy selesai.</p>
    <div class="panel tw" style="padding:6px 10px"><table><tr><th>Fitur</th><th>Path</th><th>Akses</th><th>Status</th><th>Aksi</th></tr>${[...files].sort((a, b) => (a.category + '/' + a.slug).localeCompare(b.category + '/' + b.slug, 'en', { numeric: true, sensitivity: 'base' })).map((f) => { const b = BI['/api/' + f.category + '/' + f.slug]; return `<tr>
      <td><b>${esc(b ? b.name : f.slug)}</b></td><td class="mono" style="font-size:12px">${esc(b ? b.method + ' ' : '')}/api/${esc(f.category)}/${esc(f.slug)}</td>
      <td>${b ? accessBadge(b.access) : '–'}</td><td>${b ? '<span class="badge online">Live</span>' : '<span class="badge">Menunggu deploy</span>'}</td>
      <td><div class="acts">${b ? `<button class="btn go sm" data-ct="${esc(f.category)}/${esc(f.slug)}">Tes</button>` : ''}<button class="btn ghost sm" data-ce="${esc(f.category)}/${esc(f.slug)}">Edit</button><button class="btn ghost red sm" data-cx="${esc(f.category)}/${esc(f.slug)}">Hapus</button></div></td></tr>` }).join('') || '<tr><td colspan="5" class="sub">Belum ada endpoint kode buatan dashboard.</td></tr>'}</table></div>`
  $('#csync', host).onclick = (ev) => syncEndpoints(ev.currentTarget)
  host.querySelectorAll('[data-ct]').forEach((b) => (b.onclick = () => epTest(BI['/api/' + b.dataset.ct])))
  host.querySelectorAll('[data-ce]').forEach((b) => (b.onclick = async () => { const [c, s] = b.dataset.ce.split('/'); try { const bi = BI['/api/' + c + '/' + s], f = await api(`/admin/code-endpoints/file?category=${c}&slug=${s}`); codeForm({ ...f, name: f.info?.name || bi?.name || '', category: c, slug: s, edit: true }) } catch (e) { toast(e.message) } }))
  host.querySelectorAll('[data-cx]').forEach((b) => (b.onclick = async () => { if (confirm(`Hapus endpoint ${b.dataset.cx} dari repo? (commit, lalu deploy)`)) { try { await api('/admin/code-endpoints/' + b.dataset.cx, { method: 'DELETE' }); toast('Dihapus dari repo, menunggu deploy'); V.endpoint() } catch (e) { toast(e.message) } } }))
}

/* Sinkronisasi src/api/index.js <-> file di src/api/<kategori>/ : cek dulu (tanpa commit), tampilkan rencana, baru commit setelah dikonfirmasi. */
const syncCall = (apply) => api('/admin/code-endpoints/sync', { method: 'POST', body: JSON.stringify({ apply }), signal: AbortSignal.timeout(60000) })
async function syncEndpoints(btn) {
  const label = btn.textContent
  btn.disabled = true; btn.textContent = 'Memeriksa…'
  try {
    const r = await syncCall(false)
    if (!r.changed && !r.skipped.length) { toast(`Sudah sinkron: ${r.total} file endpoint cocok dengan src/api/index.js.`); return }
    syncDialog(r)
  } catch (e) { toast(e.message) } finally { btn.disabled = false; btn.textContent = label }
}
function syncDialog(r) {
  const list = (title, items, cls = '') => items.length ? `<div style="margin:10px 0 0"><b${cls ? ` class="${cls}"` : ''}>${title} (${items.length})</b><ul class="sub mono" style="font-size:12px;margin:4px 0 0 16px">${items.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : ''
  const d = modal(`<h3>Sinkronisasi endpoint</h3>
    <p class="sub">${r.changed ? 'src/api/index.js tidak cocok dengan isi folder src/api/. Perubahan di bawah akan di-commit ke GitHub sebagai satu commit (file endpoint tidak disentuh).' : 'src/api/index.js sudah cocok, tetapi ada file yang dilewati:'}</p>
    ${list('Didaftarkan (file ada, import hilang)', r.added.map(esc))}
    ${list('Didaftarkan ulang (import ada, entri BUILTIN hilang)', r.repaired.filter((x) => x.type === 'unregistered').map((x) => esc(x.file)))}
    ${list('Dibuang (file sudah tidak ada)', r.removed.map(esc), 'err')}
    ${list('Dibuang (entri BUILTIN tanpa import)', r.repaired.filter((x) => x.type === 'dangling').map((x) => esc(x.name)), 'err')}
    ${list('Dilewati', r.skipped.map((x) => `${esc(x.file)}: ${esc(x.reason)}`))}
    ${r.truncated ? '<p class="sub err">Daftar file GitHub terpotong, jadi pembuangan import otomatis dimatikan.</p>' : ''}
    <p class="msg" id="smsg"></p>
    <div class="row" style="margin-top:10px">${r.changed ? '<button class="btn go" id="sgo">Terapkan &amp; commit</button>' : ''}<button class="btn ghost" id="scl">${r.changed ? 'Batal' : 'Tutup'}</button></div>`, 'lg')
  $('#scl', d).onclick = () => d.close()
  const go = $('#sgo', d); if (!go) return
  go.onclick = async () => {
    go.disabled = true; say($('#smsg', d), 'Commit src/api/index.js ke GitHub…')
    try {
      const x = await syncCall(true)
      d.close(); toast(x.applied ? `index.js disinkronkan${x.commit ? ' (commit ' + x.commit + ')' : ''}. Aktif setelah deploy.` : 'Sudah sinkron, tidak ada yang perlu di-commit.'); V.endpoint()
    } catch (e) { say($('#smsg', d), e.message, 1); go.disabled = false }
  }
}

async function codeForm(e) {
  const edit = !!e?.edit, info = e?.info || {}
  e = { path: '', category: '', name: info.name || '', access: e?.access || 'free', status: e?.status || 'online', code: e?.code || '', ...(e || {}) }
  if (edit) e.path = `/api/${e.category}/${e.slug}`
  const help = await api('/admin/code-endpoints/help').catch(() => ({ example: '', structure: [] }))
  const d = modal(`<h3>${edit ? 'Edit' : 'Tambah'} endpoint</h3><div class="frm">
    <div class="full"><label>Nama endpoint</label><input id="cn" value="${esc(e.name)}" placeholder="TikTok Downloader"></div>
    <div><label>Path</label><input id="cp" value="${esc(e.path)}" ${edit ? 'disabled' : ''} placeholder="/api/downloader/tiktok" autocapitalize="off" spellcheck="false"></div>
    <div><label>Kategori</label><input id="cc" value="${esc(e.category)}" ${edit ? 'disabled' : ''} placeholder="downloader" autocapitalize="off" spellcheck="false"></div>
    <div class="full"><label>Akses</label><select id="ca">${[['free', 'Free'], ['premium', 'Premium'], ['vip', 'VIP'], ['owner', 'Admin / Owner']].map(([v, t]) => `<option value="${v}" ${e.access === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="full"><label>Kode</label>
      <textarea id="ck" rows="14" spellcheck="false" class="mono" style="font-size:12.5px" placeholder="Tempel kode JavaScript endpoint (seperti src/api/downloader/tiktok.js)">${esc(e.code)}</textarea>
      <details style="margin:6px 0 0"><summary class="sub" style="cursor:pointer;margin:0">Contoh &amp; catatan</summary>
        <ul class="sub" style="font-size:12.5px;margin:6px 0 6px 16px">${help.structure.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <button class="btn ghost sm" id="cex" type="button">Pakai contoh ini</button></details></div></div>
    <div id="cr"></div><p class="msg" id="cmsg"></p>
    <div class="row" style="margin-top:10px"><button class="btn ghost" id="cck">Periksa</button><button class="btn go" id="cpub" disabled>Terbitkan</button><button class="btn ghost" id="ccl">Batal</button></div>`, 'lg')
  const g = (id) => $('#' + id, d)
  g('cex').onclick = () => { g('ck').value = help.example; g('cpub').disabled = true }
  g('ccl').onclick = () => d.close()
  /* kategori otomatis dari path (/api/<kategori>/<nama>) selama belum diisi manual */
  let catAuto = !e.category
  g('cp').oninput = () => { if (catAuto) { const m = g('cp').value.trim().replace(/^\/?api\//, '').split('/').filter(Boolean); g('cc').value = m.length > 1 ? m[m.length - 2].toLowerCase() : '' } }
  g('cc').oninput = () => { catAuto = !g('cc').value }
  const payload = () => ({ name: g('cn').value, path: g('cp').value, category: g('cc').value, access: g('ca').value, status: e.status, code: g('ck').value })
  ;['cn', 'cp', 'cc', 'ca', 'ck'].forEach((id) => g(id).addEventListener('input', () => (g('cpub').disabled = true)))
  g('ca').onchange = () => (g('cpub').disabled = true)
  g('cck').onclick = async () => {
    g('cpub').disabled = true; g('cr').innerHTML = ''; say(g('cmsg'), 'Memeriksa…')
    try {
      const r = await put('/admin/code-endpoints/preview', payload(), 'POST'), issues = [...(r.issues || [])]
      if (r.valid && r.mode && r.mode !== 'full') { try { new (Object.getPrototypeOf(async function () {}).constructor)('c', 'env', 'ip', 'query', 'body', 'input', r.body) } catch (er) { issues.push('Kesalahan sintaks JavaScript: ' + er.message) } }
      const noteHtml = (r.notes || []).length ? `<div class="sub" style="font-size:12.5px"><b>Disesuaikan otomatis:</b><ul style="margin:4px 0 4px 16px">${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''
      if (issues.length) { g('cr').innerHTML = `<div class="panel"><b class="err">Perlu diperbaiki:</b><ul style="margin:4px 0 4px 16px">${issues.map((n) => `<li class="err">${esc(n)}</li>`).join('')}</ul>${noteHtml}</div>`; say(g('cmsg'), 'Belum bisa diterbitkan.', 1); return }
      g('cr').innerHTML = `<div class="panel">${noteHtml}<b>${esc(r.path)}</b> akan dibuat sebagai:${r.files.map((f) => `<div class="sub mono" style="margin:6px 0 2px">${esc(f.path)}</div><pre class="mono" style="font-size:11.5px;max-height:200px;overflow:auto;white-space:pre-wrap;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px">${esc(f.content)}</pre>`).join('')}</div>`
      g('cpub').disabled = false; say(g('cmsg'), 'Sesuai. Siap diterbitkan.')
    } catch (er) { say(g('cmsg'), er.message, 1) }
  }
  g('cpub').onclick = async () => {
    g('cpub').disabled = true; say(g('cmsg'), 'Commit ke GitHub (file endpoint dulu, lalu src/api/index.js)…')
    try { const r = await put('/admin/code-endpoints', payload(), 'POST'); d.close(); toast(`Endpoint ${r.path} di-commit. Aktif setelah deploy.`); V.endpoint() }
    catch (er) { say(g('cmsg'), er.message, 1); g('cpub').disabled = false }
  }
}
