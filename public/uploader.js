/* Tools › Uploader (KV): unggah gambar/video/audio/PDF/dokumen, atur masa berlaku, lihat daftar + preview kecil, salin ulang link. Premium 1 ke atas. */
const el = $('#app'); el.classList.add('up')
const st = document.createElement('style')
st.textContent = `.up{max-width:600px}.up h1{font-size:19px;margin:0 0 2px}.up>.sub{font-size:12.5px;line-height:1.45;margin:0 0 12px}.up .card{margin-bottom:10px}.up .card-h{padding:10px 12px;font-size:13px}.up .card-b{padding:11px 12px}.up .drop{display:block;border:2px dashed rgba(127,127,127,.5);border-radius:12px;padding:24px 12px;text-align:center;cursor:pointer;font-size:13px;color:var(--mut)}.up .drop.on{border-color:var(--g);color:var(--tx)}.up .opt{display:flex;gap:8px;align-items:center;margin:0 0 10px;font-size:12.5px}.up select{padding:7px 9px;max-width:100%}.up .msg{margin:8px 0 0;font-size:12.5px;white-space:pre-wrap;overflow-wrap:anywhere}.up .msg:empty{display:none}.up .bar{height:6px;border-radius:4px;background:rgba(127,127,127,.25);overflow:hidden;margin-top:8px;display:none}.up .bar i{display:block;height:100%;width:0;background:var(--g);transition:width .15s}.up .row{display:flex;gap:10px;align-items:center;padding:10px 0;border-top:1px solid rgba(127,127,127,.18)}.up .row:first-child{border-top:0}.up .th{width:52px;height:52px;border-radius:9px;background:rgba(127,127,127,.18);object-fit:cover;flex:none;display:grid;place-items:center;font-size:11px;font-weight:700;color:var(--mut);text-decoration:none;overflow:hidden}.up .inf{min-width:0;flex:1}.up .inf b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.up .inf small{display:block;color:var(--mut);font-size:11.5px;margin-top:1px}.up .inf select{font-size:11.5px;padding:3px 6px;margin-top:4px}.up .acts{display:flex;flex-direction:column;gap:5px}.up .btn.sm{padding:6px 10px;font-size:12px}.up .url{font-family:'JetBrains Mono',monospace;font-size:11.5px}`
document.head.append(st)

const EXP = [['1 jam', 3600], ['1 hari', 86400], ['7 hari', 604800], ['30 hari', 2592000], ['90 hari', 7776000], ['1 tahun', 31536000], ['Permanen', 0]]
const LS = 'arvo_up_ttl'
const getTtl = () => { try { const v = localStorage.getItem(LS); return v == null ? '2592000' : v } catch { return '2592000' } }
const sz = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB')
const left = (e) => {
  if (!e) return 'Permanen'
  const s = Math.floor((e - Date.now()) / 1000)
  if (s <= 0) return 'Kedaluwarsa'
  return 'Sisa ' + (s < 3600 ? Math.max(1, Math.round(s / 60)) + ' menit' : s < 86400 ? Math.round(s / 3600) + ' jam' : Math.round(s / 86400) + ' hari')
}
const opts = (cur) => EXP.map(([l, v]) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${l}</option>`).join('')
let max = 25

const locked = (user, requiredName = 'Premium 1') => {
  el.innerHTML = `<h1>Uploader</h1><p class="sub">Unggah file dan dapatkan link CDN.</p><div class="card"><div class="card-b">
    <p style="margin:0 0 6px;font-weight:700">Khusus ${esc(requiredName)} ke atas.</p>
    <p class="sub" style="margin:0 0 12px">${user.expired ? 'Paketmu sudah berakhir. Perpanjang' : 'Upgrade paketmu'} untuk memakai fitur ini.</p>
    <a class="btn" href="/#paket">Lihat paket</a></div></div>`
}

const upload = (file, ttl, onP) => new Promise((ok, no) => {
  const x = new XMLHttpRequest()
  x.open('POST', `/api/tools/upload?name=${encodeURIComponent(file.name)}&ttl=${ttl}`); x.withCredentials = true
  x.upload.onprogress = (e) => e.lengthComputable && onP(e.loaded / e.total)
  x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText) } catch {} x.status < 300 ? ok(j) : no(new Error(j.message || 'Upload gagal.')) }
  x.onerror = () => no(new Error('Tidak bisa menghubungi server.'))
  x.send(file)
})

const thumb = (f) => {
  const u = esc(f.url), ext = esc(f.key.split('.').pop().toUpperCase())
  const inner = f.mime.startsWith('image/') ? `<img class="th" loading="lazy" src="${u}" alt="">`
    : f.mime.startsWith('video/') ? `<video class="th" src="${u}#t=0.1" preload="metadata" muted playsinline></video>`
    : f.mime.startsWith('audio/') ? `<span class="th">♪ ${ext}</span>` : `<span class="th">${ext}</span>`
  return `<a class="th" href="${u}" target="_blank" rel="noopener" title="Buka">${inner}</a>`
}
const rowHtml = (f) => `<div class="row" data-id="${f.id}">${thumb(f)}
  <div class="inf"><b title="${esc(f.name)}">${esc(f.name)}</b><small>${sz(f.size)} · ${esc(left(f.expires_at))}</small>
  <select data-x="${f.id}" aria-label="Ubah masa berlaku"><option value="" disabled selected>Ubah expired…</option>${opts('__')}</select></div>
  <div class="acts"><button class="btn sm" data-c="${esc(f.url)}">Salin</button><button class="btn sm" data-d="${f.id}">Hapus</button></div></div>`

const loadList = async () => {
  const box = $('#list')
  try {
    const r = await api('/tools/upload/list'); max = r.max_mb || max
    const used = r.files.reduce((a, f) => a + f.size, 0)
    $('#lim').textContent = `Maks ${max} MB per file · ${r.files.length}/${r.max_files} file · ${sz(used)}/${r.max_total_mb} MB terpakai`
    box.innerHTML = r.files.length ? r.files.map(rowHtml).join('') : '<p class="sub" style="margin:0">Belum ada file.</p>'
  } catch (e) { box.innerHTML = `<p class="msg err">${esc(e.message)}</p>` }
}

const render = () => {
  el.innerHTML = `<h1>Uploader</h1><p class="sub" id="lim">Gambar, video, audio, PDF, Word/Excel/PowerPoint, zip, dan teks.</p>
  <div class="card"><div class="card-h"><span>Unggah file</span></div><div class="card-b">
    <div class="opt"><span>Masa berlaku</span><select id="ttl">${opts(getTtl())}</select></div>
    <label class="drop" id="dz">Ketuk atau seret file ke sini<input id="fi" type="file" multiple hidden></label>
    <div class="bar" id="bar"><i></i></div><p class="msg" id="m"></p><div id="res"></div>
  </div></div>
  <div class="card"><div class="card-h"><span>File saya</span></div><div class="card-b" id="list"><p class="sub" style="margin:0">Memuat…</p></div></div>`
  const dz = $('#dz'), fi = $('#fi'), bar = $('#bar'), m = $('#m')
  $('#ttl').onchange = (e) => { try { localStorage.setItem(LS, e.target.value) } catch {} }
  const run = async (files) => {
    $('#res').innerHTML = ''
    for (const f of files) {
      if (f.size > max * 1048576) { say(m, `${f.name}: terlalu besar (maks ${max} MB).`, 1); continue }
      bar.style.display = 'block'; say(m, `Mengunggah ${f.name}…`)
      try {
        const r = await upload(f, $('#ttl').value, (p) => (bar.firstElementChild.style.width = Math.round(p * 100) + '%'))
        say(m, 'Selesai.')
        $('#res').insertAdjacentHTML('beforeend', `<div class="row"><div class="inf"><b class="url">${esc(r.url)}</b><small>${esc(f.name)} · ${sz(r.size)} · ${esc(left(r.expires_at))}</small></div><button class="btn sm" data-c="${esc(r.url)}">Salin</button></div>`)
      } catch (e) { say(m, `${f.name}: ${e.message}`, 1) }
    }
    bar.style.display = 'none'; bar.firstElementChild.style.width = '0'; fi.value = ''; loadList()
  }
  fi.onchange = () => run([...fi.files])
  dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('on') }
  dz.ondragleave = () => dz.classList.remove('on')
  dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('on'); run([...e.dataTransfer.files]) }
  el.onclick = async (e) => {
    const c = e.target.closest('[data-c]'), d = e.target.closest('[data-d]')
    if (c) return copy(c.dataset.c, c)
    if (d && confirm('Hapus file ini? Link-nya akan mati.')) {
      d.disabled = true
      try { await api('/tools/upload/' + d.dataset.d, { method: 'DELETE' }); loadList() } catch (er) { say(m, er.message, 1); d.disabled = false }
    }
  }
  el.onchange = async (e) => {
    const x = e.target.closest('[data-x]'); if (!x) return
    x.disabled = true
    try { await put('/tools/upload/' + x.dataset.x, { ttl: Number(x.value) }, 'PATCH'); say(m, 'Masa berlaku diubah.'); loadList() } catch (er) { say(m, er.message, 1); x.disabled = false; x.selectedIndex = 0 }
  }
  loadList()
}

Promise.all([
  api('/auth/me').catch((error) => ({ __error: error })),
  api('/billing/whoami').catch(() => ({ is_admin: false })),
  api('/billing/plans').catch(() => ({ plans: [] })),
]).then(([user, who, catalog]) => {
  if (user?.__error) {
    if (user.__error.status === 401) return (location.href = '/login.html?next=/uploader')
    el.innerHTML = `<p class="msg err">${esc(user.__error.message || 'Gagal memuat data akun.')}</p>`; return
  }
  if (!user) return (location.href = '/login.html?next=/uploader')
  const allowed = (user.active && ['premium1','premium2','premium3','vip1','vip2','vip3'].includes(user.plan)) || (who && who.is_admin)
  allowed ? render() : locked(user, catalog?.plans?.find((p) => p.id === 'premium1')?.name || 'Premium 1')
}).catch((e) => { el.innerHTML = `<p class="msg err">${esc(e?.message || 'Gagal memuat data akun.')}</p>` })
