let me
const el = $('#app')
const msgs = (id) => $('#' + id)

async function render() {
  me = await api('/auth/me')
  const lim = me.daily_limit === null ? (me.active ? 'Unlimited' : 'Limit IP gratis') : me.daily_limit.toLocaleString('id-ID') + ' / hari'
  el.innerHTML = `
  <div class="row" style="justify-content:space-between"><div><h1>Halo, ${esc(me.username)}</h1>
    <span class="badge ${me.role}">${me.role}</span> ${me.email ? `<span class="sub">${esc(me.email)}</span>` : ''}</div>
    <button class="btn ghost" id="out">Keluar</button></div>
  <div class="kv panel" style="margin-top:20px">
    <div><b>${esc(me.plan_name || 'Member')}${me.expired ? ' (habis)' : ''}</b><span>Paket</span></div>
    <div><b>${me.active ? fmtDate(me.expires_at) : '–'}</b><span>Masa aktif</span></div>
    <div><b>${me.used_today.toLocaleString('id-ID')}</b><span>Request hari ini · ${lim}</span></div>
    <div><b>${me.total_requests.toLocaleString('id-ID')}</b><span>Total request</span></div></div>
  <div class="grid2">
    <section class="panel"><h3>API key</h3><div class="keybox" id="k">${esc(me.api_key)}</div>
      <div class="row"><button class="btn ghost" id="ck">Salin</button><a class="btn ghost" href="/playground.html">Coba di Playground</a></div>
      <label>Custom API key ${me.custom_key ? '' : '(Premium 2 ke atas)'}</label>
      <div class="row"><input id="nk" placeholder="10-40 karakter" ${me.custom_key ? '' : 'disabled'}><button class="btn" id="sk" ${me.custom_key ? '' : 'disabled'}>Ganti</button></div><p class="msg" id="mk"></p></section>
    <section class="panel"><h3>Whitelist IP</h3>
      <p class="sub">${me.active ? `Maks ${me.max_ips} IP. Kosong = key bisa dipakai dari IP mana saja.` : 'Aktif setelah kamu punya paket Premium/VIP.'}</p>
      <textarea id="ips" ${me.active ? '' : 'disabled'}>${esc(me.ips.join('\n'))}</textarea>
      <div class="row"><button class="btn" id="sv" ${me.active ? '' : 'disabled'}>Simpan</button><button class="btn ghost" id="myip" ${me.active ? '' : 'disabled'}>Tambah IP saya</button></div><p class="msg" id="mi"></p></section>
    <section class="panel"><h3>Akun</h3>
      <label>Username</label><div class="row"><input id="nu" value="${esc(me.username)}"><button class="btn" id="su">Simpan</button></div><p class="msg" id="mu"></p>
      <label>${me.has_password ? 'Ganti password' : 'Buat password (akun Google)'}</label>
      ${me.has_password ? '<input id="cp" type="password" placeholder="Password lama" style="width:100%;margin-bottom:8px" autocomplete="current-password">' : ''}
      <div class="row"><input id="np" type="password" placeholder="Password baru (min. 8)" autocomplete="new-password"><button class="btn" id="sp">Simpan</button></div><p class="msg" id="mp"></p></section>
    <section class="panel"><h3>Paket &amp; pembelian</h3><p class="sub">Beli atau perpanjang paket kapan saja.</p>
      <a class="btn" href="/#paket">Lihat paket</a><div class="tw" id="ord" style="margin-top:14px"></div></section>
  </div>
  <section class="panel"><h3>Riwayat pemakaian (14 hari)</h3><div id="use"><p class="sub">Memuat…</p></div></section>`

  $('#out').onclick = async () => { await put('/auth/logout', {}, 'POST'); location.href = '/' }
  $('#ck').onclick = (e) => copy(me.api_key, e.target)
  $('#sk').onclick = async () => { try { await put('/auth/me/key', { new_key: $('#nk').value.trim() }); await render() } catch (e) { say(msgs('mk'), e.message, 1) } }
  $('#sv').onclick = async () => { try { await put('/auth/me/ips', { ips: $('#ips').value.split('\n') }); say(msgs('mi'), 'Whitelist tersimpan.') } catch (e) { say(msgs('mi'), e.message, 1) } }
  $('#myip').onclick = async () => { const w = await api('/billing/whoami'); $('#ips').value = [...new Set([...$('#ips').value.split('\n').filter(Boolean), w.ip])].join('\n') }
  $('#su').onclick = async () => { try { await put('/auth/me/username', { username: $('#nu').value }); await render() } catch (e) { say(msgs('mu'), e.message, 1) } }
  $('#sp').onclick = async () => {
    try { await put('/auth/me/password', { current_password: $('#cp')?.value, new_password: $('#np').value }); $('#np').value = ''; say(msgs('mp'), 'Password diperbarui.') }
    catch (e) { say(msgs('mp'), e.message, 1) }
  }
  api('/auth/me/orders').then(({ orders }) => {
    $('#ord').innerHTML = orders.length ? `<table><tr><th>Tanggal</th><th>Paket</th><th>Total</th><th>Status</th></tr>${orders.map((o) =>
      `<tr><td>${fmtDate(o.created_at)}</td><td>${esc(o.plan)} ${o.days ? o.days + ' hr' : '∞'}</td><td>${rp(o.total)}</td><td>${esc(o.status)}</td></tr>`).join('')}</table>` : ''
  })
  api('/auth/me/usage').then(({ days, paths }) => {
    if (!days.length) { $('#use').innerHTML = '<p class="sub">Belum ada request dengan API key ini.</p>'; return }
    const max = Math.max(...days.map((d) => d.n)), list = [...days].reverse()
    $('#use').innerHTML = `<div class="bars">${list.map((d) => `<div style="height:${Math.max(3, (d.n / max) * 100)}%" title="${d.day}: ${d.n}"></div>`).join('')}</div>
      <div class="tw"><table><tr><th>Endpoint</th><th>Request</th></tr>${paths.map((p) => `<tr><td class="mono">${esc(p.path)}</td><td>${p.n.toLocaleString('id-ID')}</td></tr>`).join('')}</table></div>`
  })
}
ready.then(({ user }) => (user ? render() : (location.href = '/login.html?next=/profile.html')))
