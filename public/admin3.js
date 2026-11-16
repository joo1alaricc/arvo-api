/* Admin: kelola Contributor, Syarat & Ketentuan, dan Thanks To untuk halaman Dashboard. */
Object.assign(MENU, { konten: ['Konten Dashboard', 'image'] })
V.konten = async function () {
  const d = await api('/admin/site-content')
  const S = { c: d.contributors.map((x) => ({ ...x })), terms: [...d.terms], thanks: [...d.thanks] }
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
    ${list('thanks', 'Thanks To', 'Nama / ucapan')}${list('terms', 'Syarat &amp; Ketentuan', 'Isi poin')}
    <div class="row"><button class="btn" id="sv">Simpan</button></div><p class="msg" id="svm"></p>`
    const o = out()
    o.querySelectorAll('[data-c]').forEach((e) => (e.oninput = () => { const [k, i] = e.dataset.c.split(':'); S.c[+i][k] = e.value }))
    o.querySelectorAll('[data-l]').forEach((e) => (e.oninput = () => { const [k, i] = e.dataset.l.split(':'); S[k][+i] = e.value }))
    o.querySelectorAll('[data-up]').forEach((e) => (e.onchange = async () => { if (!e.files[0]) return; try { S.c[+e.dataset.up].avatar = await toAv(e.files[0]); draw() } catch (er) { toast(er.message) } }))
    o.querySelectorAll('[data-dc]').forEach((b) => (b.onclick = () => { S.c.splice(+b.dataset.dc, 1); draw() }))
    o.querySelectorAll('[data-dl]').forEach((b) => (b.onclick = () => { const [k, i] = b.dataset.dl.split(':'); S[k].splice(+i, 1); draw() }))
    o.querySelectorAll('[data-al]').forEach((b) => (b.onclick = () => { S[b.dataset.al].push(''); draw() }))
    $('#ac').onclick = () => { S.c.push({ name: '', role: '', website: '', avatar: '' }); draw() }
    $('#sv').onclick = async () => {
      try { await put('/admin/site-content', { contributors: S.c, terms: S.terms, thanks: S.thanks }); toast('Tersimpan'); V.konten() } catch (er) { say($('#svm'), er.message, 1) }
    }
  }
  draw()
}
