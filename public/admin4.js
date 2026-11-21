/* Admin: Panel Pterodactyl. Domain, Application API key, dan Client API key diisi DI SINI (disimpan di database server, bukan di kode).
 * Kunci yang sudah tersimpan tidak pernah dikirim balik ke browser: kolom dikosongkan dan hanya tampil petunjuk 5 huruf awal + 4 akhir. */
Object.assign(MENU, { ptero: ['Pterodactyl', 'server'] })
SUPER_ONLY.push('ptero')
V.ptero = async function () {
  const d = await api('/admin/ptero'), c = d.config
  const T = { nests: [], locations: [] }
  const stChip = (s) => ({ active: '✅', pending: '⏳', provisioning: '⏳', failed: '⚠️', review: '⚠️', expired: '⌛', canceled: '✖️', suspended: '⏸️', deleted: '🗑️' }[s] || '') + ' ' + esc(s)
  const pn = (id) => esc((d.plans.find((p) => p.id === id) || {}).name || id)
  const secOk = (ok, t) => `<span style="margin-right:12px">${ok ? '✅' : '❌'} ${t}</span>`
  const opts = (list, cur, label) => (list.some((x) => x.id === cur) || !cur ? '' : `<option value="${cur}" selected>ID ${cur} (tersimpan)</option>`) + list.map((x) => `<option value="${x.id}" ${x.id === cur ? 'selected' : ''}>${esc(x.name)} (ID ${x.id})</option>`).join('')
  const draw = () => {
    out().innerHTML = `<h1>Panel Pterodactyl</h1>
    <p class="sub">Layanan baru tampil di sidebar setelah dinyalakan di menu <b>Layanan</b> (default mati). Isi dan tes koneksi di sini dulu.</p>
    <div class="panel"><div class="row" style="flex-wrap:wrap;gap:18px"><div><b>${d.active}</b><div class="sub" style="margin:0">server aktif</div></div><div><b>${rp(d.paid_sum)}</b><div class="sub" style="margin:0">pembayaran masuk (${d.paid_count})</div></div><div><b>${d.failed}</b><div class="sub" style="margin:0">order gagal dibuat</div></div></div>
      <p style="margin:10px 0 0;font-size:12.5px">${secOk(d.btz.apikey, '<code>BTZPAY_APIKEY</code>')}${secOk(d.btz.callback_token, '<code>BTZPAY_CALLBACK_TOKEN</code>')}<span class="sub" style="margin:0">(pembayaran QRIS memakai pengaturan BTZPay di menu Pembayaran)</span></p></div>

    <div class="panel"><h3>Koneksi panel</h3>
      <label>Domain panel</label><input id="pt-dom" value="${esc(c.domain)}" placeholder="https://panel.domainmu.com" autocomplete="off">
      <label style="margin-top:8px">Application API key (<code>ptla_…</code>) ${c.apikey_set ? `<span class="sub" style="margin:0">tersimpan: <code>${esc(c.apikey_hint)}</code>. Kosongkan jika tidak diubah.</span>` : '<span class="sub" style="margin:0">belum diisi</span>'}</label>
      <input id="pt-ak" type="password" autocomplete="new-password" placeholder="${c.apikey_set ? '•••••••• (tidak diubah)' : 'ptla_…'}">
      <label style="margin-top:8px">Client API key (<code>ptlc_…</code>, WAJIB dari akun root admin) ${c.capikey_set ? `<span class="sub" style="margin:0">tersimpan: <code>${esc(c.capikey_hint)}</code>. Kosongkan jika tidak diubah.</span>` : '<span class="sub" style="margin:0">belum diisi</span>'}</label>
      <input id="pt-ck" type="password" autocomplete="new-password" placeholder="${c.capikey_set ? '•••••••• (tidak diubah)' : 'ptlc_…'}">
      <p class="sub" style="font-size:12px">Application key: Panel > Admin > Application API. Client key: klik foto akun admin > Account > API Credentials. Node (Wings) harus memakai SSL (wss) dan <code>allowed_origins</code> Wings berisi domain panel (bawaan sudah begitu).</p>
      <div class="row"><button class="btn ghost" id="pt-test">Tes koneksi & muat daftar egg/lokasi</button></div><p class="msg" id="pt-tm"></p></div>

    <div class="panel"><h3>Server yang dibuat otomatis</h3>
      <div class="row" style="flex-wrap:wrap;gap:10px">
        <div><label>Nest</label><select id="pt-nest"></select></div><div><label>Egg</label><select id="pt-egg"></select></div><div><label>Lokasi (deploy otomatis)</label><select id="pt-loc"></select></div>
        <div><label>Masa tenggang hapus (hari)</label><input id="pt-gr" type="number" min="0" max="60" value="${c.grace_days}"></div>
        <div><label>Batas database</label><input id="pt-db" type="number" min="0" max="50" value="${c.databases}"></div><div><label>Batas backup</label><input id="pt-bk" type="number" min="0" max="50" value="${c.backups}"></div></div>
      <label style="margin-top:8px">Docker image (opsional, kosong = bawaan egg)</label><input id="pt-img" value="${esc(c.docker_image)}">
      <label style="margin-top:8px">Startup command (opsional, kosong = bawaan egg)</label><input id="pt-su" value="${esc(c.startup)}">
      <label style="margin-top:8px">Variabel environment tambahan (JSON, opsional) <span class="sub" style="margin:0">mis. <code>{"CMD_RUN":"npm start"}</code>. Wajib bila egg punya variabel required tanpa nilai bawaan.</span></label>
      <textarea id="pt-env" rows="3" style="font-family:monospace">${esc(c.env_json)}</textarea>
      <p class="sub" style="font-size:12px">Server dibuat dengan batas RAM/Disk/CPU sesuai paket, memakai deploy otomatis di lokasi terpilih (lokasi harus punya node & alokasi port kosong). Server yang habis masa aktifnya otomatis ditangguhkan, lalu dihapus setelah masa tenggang (dicek tiap 15 menit).</p>
      <p class="msg" id="pt-m"></p><div class="row"><button class="btn" id="pt-save">Simpan pengaturan</button></div></div>

    <div class="panel"><h3>Server</h3><div style="overflow-x:auto"><table><thead><tr><th>ID</th><th>User</th><th>Nama</th><th>Paket</th><th>Status</th><th>Habis</th><th>Aksi</th></tr></thead><tbody>
      ${d.servers.map((s) => `<tr><td>${s.id}</td><td>${esc(s.username || '-')}</td><td>${esc(s.name)}</td><td>${pn(s.plan)}</td><td>${stChip(s.status)}</td><td>${esc(fmtExp(s.expires_at))}</td><td style="white-space:nowrap">${s.status === 'deleted' ? '' : `<button class="btn ghost sm" data-sa="extend" data-id="${s.id}">+Hari</button> <button class="btn ghost sm" data-sa="${s.status === 'suspended' ? 'unsuspend' : 'suspend'}" data-id="${s.id}">${s.status === 'suspended' ? 'Aktifkan' : 'Suspend'}</button> <button class="btn ghost sm" data-sa="delete" data-id="${s.id}">Hapus</button>`}</td></tr>`).join('') || '<tr><td colspan="7">Belum ada server.</td></tr>'}
    </tbody></table></div><p class="msg" id="pt-sm"></p></div>

    <div class="panel"><h3>Order terbaru</h3><div style="overflow-x:auto"><table><thead><tr><th>Waktu</th><th>User</th><th>Jenis</th><th>Paket</th><th>Hari</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>
      ${d.orders.map((o) => `<tr><td>${esc(fmtExp(o.created_at))}</td><td>${esc(o.username || '-')}</td><td>${o.kind === 'renew' ? 'Perpanjang' : 'Baru'}</td><td>${pn(o.plan)}</td><td>${o.days}</td><td>${rp(o.total)}</td><td>${stChip(o.status)}${o.error ? `<div class="sub" style="margin:0;font-size:11.5px;max-width:260px;overflow-wrap:anywhere">${esc(o.error)}</div>` : ''}</td><td>${['failed', 'provisioning'].includes(o.status) ? `<button class="btn ghost sm" data-ro="${esc(o.id)}">Ulangi</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="8">Belum ada order.</td></tr>'}
    </tbody></table></div><p class="msg" id="pt-om"></p></div>`
    fill(); wire()
  }
  const fill = () => {
    const nests = T.nests.map((n) => ({ id: n.id, name: n.name })), ne = $('#pt-nest'), ee = $('#pt-egg'), lo = $('#pt-loc')
    ne.innerHTML = '<option value="0">— pilih —</option>' + opts(nests, c.nest_id); lo.innerHTML = '<option value="0">— pilih —</option>' + opts(T.locations, c.location_id)
    const eggs = () => { const n = T.nests.find((x) => x.id === +ne.value); ee.innerHTML = '<option value="0">— pilih —</option>' + opts(n ? n.eggs : [], c.egg_id) }
    ne.onchange = () => { c.egg_id = 0; eggs() }; eggs()
  }
  const form = () => ({ domain: $('#pt-dom').value.trim(), apikey: $('#pt-ak').value.trim(), capikey: $('#pt-ck').value.trim(), nest_id: +$('#pt-nest').value || 0, egg_id: +$('#pt-egg').value || 0, location_id: +$('#pt-loc').value || 0,
    grace_days: +$('#pt-gr').value, databases: +$('#pt-db').value, backups: +$('#pt-bk').value, docker_image: $('#pt-img').value.trim(), startup: $('#pt-su').value.trim(), env_json: $('#pt-env').value.trim() })
  const wire = () => {
    $('#pt-test').onclick = async () => {
      const m = $('#pt-tm'); say(m, 'Menguji koneksi…')
      try {
        const r = await put('/admin/ptero/test', form(), 'POST'); T.nests = r.nests; T.locations = r.locations
        c.nest_id = +$('#pt-nest').value || c.nest_id; c.egg_id = +$('#pt-egg').value || c.egg_id; c.location_id = +$('#pt-loc').value || c.location_id; fill()
        say(m, `Application API: ${r.app_ok ? '✅ OK' : '❌ gagal'} · Client API: ${r.client_ok ? '✅ OK (root admin)' : '❌ gagal'}${r.messages.length ? '\n' + r.messages.join('\n') : ''}`, !(r.app_ok && r.client_ok))
      } catch (e) { say(m, e.message, 1) }
    }
    $('#pt-save').onclick = async () => {
      const m = $('#pt-m')
      try { const r = await put('/admin/ptero', form()); Object.assign(c, r.config); say(m, 'Pengaturan tersimpan.' + (r.config.ready ? '' : ' Lengkapi domain, kedua API key, nest, egg, dan lokasi agar layanan siap.')); toast('Tersimpan'); setTimeout(() => load(V.ptero), 600) }
      catch (e) { say(m, e.message, 1) }
    }
    out().querySelectorAll('[data-sa]').forEach((b) => (b.onclick = async () => {
      const a = b.dataset.sa, m = $('#pt-sm'); let body = {}
      if (a === 'extend') { const n = prompt('Tambah berapa hari?', '30'); if (!n) return; body = { days: +n } }
      if (a === 'delete' && !confirm('Hapus server ini dari panel? Data user hilang permanen.')) return
      if (a === 'suspend' && !confirm('Suspend server ini?')) return
      try { await put(`/admin/ptero/servers/${b.dataset.id}/${a}`, body, 'POST'); toast('Berhasil'); load(V.ptero) } catch (e) { say(m, e.message, 1) }
    }))
    out().querySelectorAll('[data-ro]').forEach((b) => (b.onclick = async () => {
      b.disabled = true; const m = $('#pt-om')
      try { const r = await put(`/admin/ptero/orders/${encodeURIComponent(b.dataset.ro)}/retry`, {}, 'POST'); say(m, r.ok ? 'Server berhasil dibuat.' : 'Masih gagal: ' + (r.error || r.status), !r.ok); setTimeout(() => load(V.ptero), 800) } catch (e) { say(m, e.message, 1); b.disabled = false }
    }))
  }
  draw()
}
