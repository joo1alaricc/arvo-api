/* Admin: kelola Contributor, Syarat & Ketentuan, dan Thanks To untuk halaman Dashboard. */
Object.assign(MENU, { konten: ['Konten Dashboard', 'image'] })
V.konten = async function () {
  const d = await api('/admin/site-content')
  const S = { c: d.contributors.map((x) => ({ ...x })), terms: d.terms.map((t) => ({ title: t.title || '', desc: t.desc || '', points: (t.points || []).map((p) => ({ ...p })) })), thanks: [...d.thanks],
    f: { desc: d.footer?.desc || '', social: (d.footer?.social || []).map((x) => ({ ...x })), groups: (d.footer?.groups || []).map((g) => ({ title: g.title, links: (g.links || []).map((x) => ({ ...x })) })) } }
  const toAv = (file) => new Promise((ok, no) => {
    const im = new Image(), u = URL.createObjectURL(file)
    im.onload = () => { const s = Math.min(im.naturalWidth, im.naturalHeight), c = document.createElement('canvas'); c.width = c.height = 160
      c.getContext('2d').drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, 0, 0, 160, 160); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.82)) }
    im.onerror = () => no(new Error('File harus gambar JPG, PNG, atau WebP.')); im.src = u
  })
  const list = (key, label, ph) => `<div class="panel"><h3>${label}</h3>${S[key].map((t, i) => `<div class="cx-r"><input data-l="${key}:${i}" value="${esc(t)}" placeholder="${ph}"><button class="btn ghost red sm" data-dl="${key}:${i}">${ico('trash')}</button></div>`).join('') || '<p class="sub">Belum ada.</p>'}
    <button class="btn sm" data-al="${key}">${ico('plus')} Tambah</button></div>`
  const draw = () => {
    out().innerHTML = `<h1>Konten Dashboard</h1><p class="sub">Tampil di halaman Dashboard publik. Klik Simpan setelah selesai mengubah.</p>
    <div class="panel"><h3>Contributor</h3>${S.c.map((x, i) => `<div class="cx-r">
      ${x.avatar ? `<img class="ctb-a" src="${esc(x.avatar)}" alt="">` : `<span class="ctb-a">${esc((x.name || '?').charAt(0).toUpperCase())}</span>`}
      <input data-c="name:${i}" value="${esc(x.name)}" placeholder="Nama"><input data-c="role:${i}" value="${esc(x.role)}" placeholder="Jabatan / peran">
      <input data-c="website:${i}" value="${esc(x.website)}" placeholder="Website (https://…)">
      <input data-c="avatar:${i}" value="${x.avatar && x.avatar.startsWith('data:') ? '' : esc(x.avatar)}" placeholder="URL foto (atau unggah)">
      <input type="file" accept="image/jpeg,image/png,image/webp" data-up="${i}" style="max-width:190px">
      <button class="btn ghost red sm" data-dc="${i}">${ico('trash')}</button></div>`).join('') || '<p class="sub">Belum ada contributor.</p>'}
      <button class="btn sm" id="ac">${ico('plus')} Tambah contributor</button></div>
    ${list('thanks', 'Thanks To', 'Nama / ucapan')}
    <div class="panel"><h3>Footer</h3><p class="sub" style="font-size:12px;margin:0 0 8px">Tampil di bagian bawah semua halaman. <b>Nama</b> = teks yang terlihat, <b>Value</b> = link tujuan (https://…, /halaman, atau #anchor).</p>
      <textarea rows="3" data-fd placeholder="Deskripsi singkat di bawah logo">${esc(S.f.desc)}</textarea>
      <h3 style="font-size:14px;margin:14px 0 6px">Ikon sosial</h3>
      ${S.f.social.map((x, i) => `<div class="cx-r"><input data-fs="name:${i}" value="${esc(x.name)}" placeholder="Nama (mis. WhatsApp, Instagram, Telegram)"><input data-fs="value:${i}" value="${esc(x.value)}" placeholder="Value (link tujuan)"><button class="btn ghost red sm" data-dfs="${i}">${ico('trash')}</button></div>`).join('') || '<p class="sub">Belum ada.</p>'}
      <button class="btn sm" id="afs">${ico('plus')} Tambah ikon sosial</button>
      ${S.f.groups.map((g, i) => `<div class="tnc-a" style="margin-top:14px"><div class="cx-r"><input data-fg="${i}" value="${esc(g.title)}" placeholder="Judul kolom, mis. Layanan"><button class="btn ghost red sm" data-dfg="${i}" title="Hapus kolom">${ico('trash')}</button></div>
        <div class="tnc-sub">${g.links.map((x, k) => `<div class="cx-r"><input data-fl="name:${i}:${k}" value="${esc(x.name)}" placeholder="Nama"><input data-fl="value:${i}:${k}" value="${esc(x.value)}" placeholder="Value (link tujuan)"><button class="btn ghost red sm" data-dfl="${i}:${k}">${ico('trash')}</button></div>`).join('')}
          <button class="btn sm" data-afl="${i}">${ico('plus')} Tambah tautan</button></div></div>`).join('')}
      <div style="margin-top:12px"><button class="btn sm" id="afg">${ico('plus')} Tambah kolom</button></div></div>
    <div class="panel"><h3>Syarat dan Ketentuan</h3><p class="sub" style="font-size:12px;margin:0 0 8px">Setiap ketentuan bernomor otomatis (1, 2, …), punya definisi, dan bisa punya poin (1.1, 1.2, …).</p>
      ${S.terms.map((t, i) => `<div class="tnc-a"><div class="cx-r"><span class="mt">${i + 1}</span><input data-t="title:${i}" value="${esc(t.title)}" placeholder="Judul ketentuan, mis. Ketentuan umum">
        <button class="btn ghost sm" data-mv="${i}:-1" title="Naik">↑</button><button class="btn ghost sm" data-mv="${i}:1" title="Turun">↓</button><button class="btn ghost red sm" data-dt="${i}">${ico('trash')}</button></div>
        <textarea rows="2" data-t="desc:${i}" placeholder="Definisi / penjelasan (opsional)">${esc(t.desc)}</textarea>
        <div class="tnc-sub">${t.points.map((p, k) => `<div class="cx-r"><span class="mt">${i + 1}.${k + 1}</span><div style="flex:1;min-width:140px"><input data-p="title:${i}:${k}" value="${esc(p.title)}" placeholder="Judul poin, mis. Apa itu Arvo API" style="width:100%"><textarea rows="2" data-p="desc:${i}:${k}" placeholder="Definisi poin (opsional)">${esc(p.desc)}</textarea></div><button class="btn ghost red sm" data-dp="${i}:${k}">${ico('trash')}</button></div>`).join('')}
          <button class="btn sm" data-ap="${i}">${ico('plus')} Tambah poin</button></div></div>`).join('') || '<p class="sub">Belum ada ketentuan.</p>'}
      <button class="btn sm" id="at">${ico('plus')} Tambah ketentuan</button></div>
    <div class="row"><button class="btn" id="sv">Simpan</button></div><p class="msg" id="svm"></p>`
    const o = out()
    o.querySelectorAll('[data-c]').forEach((e) => (e.oninput = () => { const [k, i] = e.dataset.c.split(':'); S.c[+i][k] = e.value }))
    o.querySelectorAll('[data-l]').forEach((e) => (e.oninput = () => { const [k, i] = e.dataset.l.split(':'); S[k][+i] = e.value }))
    o.querySelectorAll('[data-up]').forEach((e) => (e.onchange = async () => { if (!e.files[0]) return; try { S.c[+e.dataset.up].avatar = await toAv(e.files[0]); draw() } catch (er) { toast(er.message) } }))
    o.querySelectorAll('[data-dc]').forEach((b) => (b.onclick = () => { S.c.splice(+b.dataset.dc, 1); draw() }))
    o.querySelectorAll('[data-dl]').forEach((b) => (b.onclick = () => { const [k, i] = b.dataset.dl.split(':'); S[k].splice(+i, 1); draw() }))
    o.querySelectorAll('[data-al]').forEach((b) => (b.onclick = () => { S[b.dataset.al].push(''); draw() }))
    o.querySelectorAll('[data-t]').forEach((e) => (e.oninput = () => { const [k, i] = e.dataset.t.split(':'); S.terms[+i][k] = e.value }))
    o.querySelectorAll('[data-p]').forEach((e) => (e.oninput = () => { const [k, i, j] = e.dataset.p.split(':'); S.terms[+i].points[+j][k] = e.value }))
    o.querySelectorAll('[data-dt]').forEach((b) => (b.onclick = () => { S.terms.splice(+b.dataset.dt, 1); draw() }))
    o.querySelectorAll('[data-dp]').forEach((b) => (b.onclick = () => { const [i, j] = b.dataset.dp.split(':'); S.terms[+i].points.splice(+j, 1); draw() }))
    o.querySelectorAll('[data-ap]').forEach((b) => (b.onclick = () => { S.terms[+b.dataset.ap].points.push({ title: '', desc: '' }); draw() }))
    o.querySelectorAll('[data-mv]').forEach((b) => (b.onclick = () => { const [i, d] = b.dataset.mv.split(':').map(Number), j = i + d; if (j < 0 || j >= S.terms.length) return; [S.terms[i], S.terms[j]] = [S.terms[j], S.terms[i]]; draw() }))
    o.querySelectorAll('[data-fd]').forEach((e) => (e.oninput = () => { S.f.desc = e.value }))
    o.querySelectorAll('[data-fs]').forEach((e) => (e.oninput = () => { const [k, i] = e.dataset.fs.split(':'); S.f.social[+i][k] = e.value }))
    o.querySelectorAll('[data-fg]').forEach((e) => (e.oninput = () => { S.f.groups[+e.dataset.fg].title = e.value }))
    o.querySelectorAll('[data-fl]').forEach((e) => (e.oninput = () => { const [k, i, j] = e.dataset.fl.split(':'); S.f.groups[+i].links[+j][k] = e.value }))
    o.querySelectorAll('[data-dfs]').forEach((b) => (b.onclick = () => { S.f.social.splice(+b.dataset.dfs, 1); draw() }))
    o.querySelectorAll('[data-dfg]').forEach((b) => (b.onclick = () => { S.f.groups.splice(+b.dataset.dfg, 1); draw() }))
    o.querySelectorAll('[data-dfl]').forEach((b) => (b.onclick = () => { const [i, j] = b.dataset.dfl.split(':'); S.f.groups[+i].links.splice(+j, 1); draw() }))
    o.querySelectorAll('[data-afl]').forEach((b) => (b.onclick = () => { S.f.groups[+b.dataset.afl].links.push({ name: '', value: '' }); draw() }))
    $('#afs').onclick = () => { S.f.social.push({ name: '', value: '' }); draw() }
    $('#afg').onclick = () => { S.f.groups.push({ title: '', links: [{ name: '', value: '' }] }); draw() }
    $('#at').onclick = () => { S.terms.push({ title: '', desc: '', points: [] }); draw() }
    $('#ac').onclick = () => { S.c.push({ name: '', role: '', website: '', avatar: '' }); draw() }
    $('#sv').onclick = async () => {
      try { await put('/admin/site-content', { contributors: S.c, terms: S.terms, thanks: S.thanks, footer: S.f }); toast('Tersimpan'); V.konten() } catch (er) { say($('#svm'), er.message, 1) }
    }
  }
  draw()
}

/* Admin: aktif/nonaktifkan layanan (SMM, OTP, Aktivasi AM). Yang nonaktif hilang dari menu & sidebar, dan halamannya tampil 404. */
Object.assign(MENU, { layanan: ['Layanan', 'grid'] })
SUPER_ONLY.push('layanan')
V.layanan = async function () {
  const d = await api('/admin/services')
  const ROWS = [['smm', 'Layanan SMM', '/smm', 'Pesan layanan sosmed dan deposit saldo.'], ['otp', 'Layanan OTP', '/otp', 'Nomor virtual untuk menerima kode OTP.'], ['am', 'Aktivasi AM', '/am', 'Aktivasi Alight Motion (khusus Premium ke atas).']]
  out().innerHTML = `<h1>Layanan</h1><p class="sub">Matikan layanan untuk menyembunyikannya dari menu dan sidebar. Halamannya jadi 404 dan endpoint-nya ditolak. Transaksi yang sudah berjalan (cek deposit, batal atau refund OTP) tetap bisa diselesaikan supaya saldo user tidak tersangkut.</p>
  <div class="panel">${ROWS.map(([k, t, p, s]) => `<div class="cx-r" style="align-items:center"><div style="flex:1;min-width:0"><b>${t}</b> <code>${p}</code><div class="sub" style="font-size:12px;margin:2px 0 0">${s}</div></div>
    <label class="sw"><input type="checkbox" data-sv="${k}" ${d[k] !== false ? 'checked' : ''}><i></i></label></div>`).join('')}</div>`
  out().querySelectorAll('[data-sv]').forEach((cb) => (cb.onchange = async () => {
    cb.disabled = true
    try { await put('/admin/services', { [cb.dataset.sv]: cb.checked }); toast(cb.checked ? 'Layanan diaktifkan' : 'Layanan dinonaktifkan') }
    catch (er) { cb.checked = !cb.checked; toast(er.message) }
    cb.disabled = false
  }))
}
