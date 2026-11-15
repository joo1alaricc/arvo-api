const MENU = { ringkasan: 'Ringkasan', pengguna: 'Pengguna', order: 'Order', paket: 'Paket' }
const view = () => (location.hash.slice(1) in MENU ? location.hash.slice(1) : 'ringkasan')
const out = () => $('#v')
const load = async (fn) => { try { await fn() } catch (e) { out().innerHTML = `<p class="err">${esc(e.message)}</p>` } }

const V = {
  async ringkasan() {
    const s = await api('/admin/stats')
    out().innerHTML = `<h1>Ringkasan</h1><div class="kv panel">
      <div><b>${s.users}</b><span>Total user</span></div><div><b>${s.premium}</b><span>Premium aktif</span></div><div><b>${s.vip}</b><span>VIP aktif</span></div>
      <div><b>${s.requests_today.toLocaleString('id-ID')}</b><span>Request hari ini (key)</span></div>
      <div><b>${rp(s.revenue)}</b><span>Pendapatan (${s.paid_orders} order)</span></div><div><b>${s.pending_orders}</b><span>Order pending</span></div></div>
      <div class="panel"><h3>Endpoint teratas hari ini</h3><table>${s.top_paths.map((p) => `<tr><td class="mono">${esc(p.path)}</td><td>${p.n}</td></tr>`).join('') || '<tr><td class="sub">Belum ada data</td></tr>'}</table></div>`
  },
  async pengguna(q = '') {
    const { users } = await api('/admin/users?q=' + encodeURIComponent(q)), { plans } = await api('/billing/plans')
    out().innerHTML = `<h1>Pengguna</h1><div class="row" style="margin-bottom:12px"><input id="q" placeholder="Cari username/email" value="${esc(q)}" style="flex:1"><button class="btn" id="qs">Cari</button></div>
      <div class="panel tw"><table><tr><th>User</th><th>Role</th><th>Paket</th><th>Berakhir</th><th>Request</th><th>Aksi</th></tr>${users.map((u) => `<tr>
        <td>${esc(u.username)}<br><span class="sub">${esc(u.email || '')}</span></td><td><span class="badge ${u.role}">${u.role}</span></td><td>${esc(u.plan_name || '-')}</td>
        <td>${u.plan_name ? fmtDate(u.expires_at) : '-'}</td><td>${u.total_requests}</td>
        <td><div class="row"><select data-p="${u.id}">${plans.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
          <input data-d="${u.id}" type="number" value="30" min="1" style="width:70px" title="hari (0 = permanen)"><button class="btn" data-g="${u.id}">Beri</button>
          <button class="btn ghost" data-r="${u.id}">Cabut</button></div></td></tr>`).join('')}</table></div>`
    $('#qs').onclick = () => load(() => V.pengguna($('#q').value))
    out().querySelectorAll('[data-g]').forEach((b) => (b.onclick = async () => {
      const id = b.dataset.g, d = +$(`[data-d="${id}"]`).value
      try { await put(`/admin/users/${id}/grant`, { plan: $(`[data-p="${id}"]`).value, days: d, permanent: d === 0 }, 'POST'); V.pengguna(q) } catch (e) { alert(e.message) }
    }))
    out().querySelectorAll('[data-r]').forEach((b) => (b.onclick = async () => { if (confirm('Cabut paket user ini?')) { await put(`/admin/users/${b.dataset.r}/revoke`, {}, 'POST'); V.pengguna(q) } }))
  },
  async order() {
    const { orders } = await api('/admin/orders')
    out().innerHTML = `<h1>Order</h1><div class="panel tw"><table><tr><th>Tanggal</th><th>User</th><th>Paket</th><th>Total</th><th>Status</th><th></th></tr>${orders.map((o) => `<tr>
      <td>${fmtDate(o.created_at)}</td><td>${esc(o.username || '-')}</td><td>${esc(o.plan)} ${o.days ? o.days + ' hr' : '∞'}</td><td>${rp(o.total)}</td><td>${esc(o.status)}</td>
      <td>${o.status === 'pending' ? `<button class="btn" data-c="${o.id}">Konfirmasi</button> <button class="btn ghost" data-x="${o.id}">Batal</button>` : ''}</td></tr>`).join('')}</table></div>`
    const act = (sel, kind) => out().querySelectorAll(sel).forEach((b) => (b.onclick = async () => { try { await put(`/admin/orders/${b.dataset[kind]}/${kind === 'c' ? 'confirm' : 'cancel'}`, {}, 'POST'); V.order() } catch (e) { alert(e.message) } }))
    act('[data-c]', 'c'); act('[data-x]', 'x')
  },
  async paket() {
    const { plans } = await api('/billing/plans')
    out().innerHTML = `<h1>Paket</h1><p class="sub">Untuk mengubah harga/limit, edit <span class="mono">src/utils/plans.js</span> lalu deploy ulang.</p>
      <div class="panel tw"><table><tr><th>Paket</th><th>Limit/hari</th><th>Maks IP</th><th>Custom key</th><th>Harga</th></tr>${plans.map((p) => `<tr><td>${p.name}</td><td>${p.daily ?? '∞'}</td><td>${p.maxIps}</td><td>${p.customKey ? 'Ya' : '-'}</td>
      <td>${p.basePrice ? `${rp(p.basePrice)} / ${p.baseDays} hr` : ''} ${p.permanentPrice ? `${rp(p.permanentPrice)} permanen` : ''}</td></tr>`).join('')}</table></div>`
  },
}
const draw = () => { document.querySelectorAll('.side nav a').forEach((a) => a.classList.toggle('on', a.hash.slice(1) === view())); load(V[view()]) }

ready.then(({ who }) => {
  if (!who.is_owner) { $('#app').innerHTML = `<div class="panel"><h3>Akses ditolak</h3><p class="sub">IP kamu (${esc(who.ip)}) tidak ada di <span class="mono">OWNER_IPS</span>.</p></div>`; return }
  $('#app').innerHTML = `<nav>${Object.entries(MENU).map(([k, v]) => `<a href="#${k}">${v}</a>`).join('')}</nav><div id="v"></div>`
  window.onhashchange = draw; draw()
})
