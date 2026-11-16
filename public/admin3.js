/* Admin: kelola Contributor, Syarat & Ketentuan, dan Thanks To untuk halaman Dashboard. */
Object.assign(MENU, { konten: ['Konten Dashboard', 'image'] })
V.konten = async function () {
  const d = await api('/admin/site-content')
  const S = { c: d.contributors.map((x) => ({ ...x })), terms: d.terms.map((t) => ({ title: t.title || '', desc: t.desc || '', points: (t.points || []).map((p) => ({ ...p })) })), thanks: [...d.thanks] }
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
    <div class="panel"><h3>Syarat dan Ketentuan</h3><p class="sub" style="font-size:12px;margin:0 0 8px">Setiap ketentuan bernomor otomatis (01, 02, …), punya definisi, dan bisa punya poin (A, B, …).</p>
      ${S.terms.map((t, i) => `<div class="tnc-a"><div class="cx-r"><span class="mt">${String(i + 1).padStart(2, '0')}</span><input data-t="title:${i}" value="${esc(t.title)}" placeholder="Judul ketentuan, mis. Ketentuan umum">
        <button class="btn ghost sm" data-mv="${i}:-1" title="Naik">↑</button><button class="btn ghost sm" data-mv="${i}:1" title="Turun">↓</button><button class="btn ghost red sm" data-dt="${i}">${ico('trash')}</button></div>
        <textarea rows="2" data-t="desc:${i}" placeholder="Definisi / penjelasan (opsional)">${esc(t.desc)}</textarea>
        <div class="tnc-sub">${t.points.map((p, k) => `<div class="cx-r"><span class="mt">${String.fromCharCode(65 + (k % 26))}</span><div style="flex:1;min-width:140px"><input data-p="title:${i}:${k}" value="${esc(p.title)}" placeholder="Judul poin, mis. Apa itu Arvo API" style="width:100%"><textarea rows="2" data-p="desc:${i}:${k}" placeholder="Definisi poin (opsional)">${esc(p.desc)}</textarea></div><button class="btn ghost red sm" data-dp="${i}:${k}">${ico('trash')}</button></div>`).join('')}
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
    $('#at').onclick = () => { S.terms.push({ title: '', desc: '', points: [] }); draw() }
    $('#ac').onclick = () => { S.c.push({ name: '', role: '', website: '', avatar: '' }); draw() }
    $('#sv').onclick = async () => {
      try { await put('/admin/site-content', { contributors: S.c, terms: S.terms, thanks: S.thanks }); toast('Tersimpan'); V.konten() } catch (er) { say($('#svm'), er.message, 1) }
    }
  }
  draw()
}
