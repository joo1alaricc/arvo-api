document.querySelectorAll('[data-ico]').forEach((e) => (e.innerHTML = ico(e.dataset.ico)))
/* API key: otomatis terisi dengan key akun yang login di SEMUA endpoint. User boleh menggantinya; perubahan dibagikan ke semua endpoint
 * dan diingat selama key akunnya belum berubah (kalau key akun diganti/ganti akun, kembali otomatis ke key akun). */
let me = null, savedKey = ''
const LS = { get: (k) => { try { return localStorage.getItem(k) } catch { return null } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch {} } }
const acct = () => (me && me.api_key) || ''
const initKey = () => {
  const o = LS.get('arvo_key_override'), base = LS.get('arvo_key_base')
  savedKey = o !== null && base === acct() ? o : acct()
}
const keyInputs = () => document.querySelectorAll('.pg-ep [data-k="apikey"]')
const syncMine = () => document.querySelectorAll('.pg-ep [data-mine]').forEach((b) => (b.hidden = !acct() || savedKey === acct()))
const setKey = (v, from) => {
  savedKey = v
  if (v === acct()) { LS.set('arvo_key_override', null); LS.set('arvo_key_base', null) } else { LS.set('arvo_key_override', v); LS.set('arvo_key_base', acct()) }
  keyInputs().forEach((i) => { if (i !== from) i.value = v })
  document.querySelectorAll('.pg-ep').forEach((e) => e._r?.()); syncMine()
}
const LANGS = { curl: 'cURL', js: 'JavaScript (fetch)', py: 'Python (requests)', php: 'PHP (cURL)' }
const snippets = (method, url, body, key) => {
  const h = { 'x-api-key': key || 'KEY_KAMU', ...(body ? { 'Content-Type': 'application/json' } : {}) }
  const hc = Object.entries(h).map(([k, v]) => ` \\\n  --header '${k}: ${v}'`).join('')
  const hp = Object.entries(h).map(([k, v]) => `    '${k}: ${v}'`).join(',\n')
  return {
    curl: `curl${method === 'GET' ? '' : ' -X ' + method} '${url}'${hc}${body ? ` \\\n  --data '${body}'` : ''}`,
    js: `const res = await fetch('${url}', {\n  method: '${method}',\n  headers: ${JSON.stringify(h, null, 2).replace(/\n/g, '\n  ')}${body ? `,\n  body: JSON.stringify(${body})` : ''}\n})\nconsole.log(await res.json())`,
    py: `import requests\n\nr = requests.${method.toLowerCase()}('${url}', headers=${JSON.stringify(h)}${body ? `, json=${body}` : ''})\nprint(r.json())`,
    php: `<?php\n$ch = curl_init('${url}');\ncurl_setopt_array($ch, [\n  CURLOPT_CUSTOMREQUEST => '${method}',\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_HTTPHEADER => [\n${hp}\n  ],${body ? `\n  CURLOPT_POSTFIELDS => '${body}',` : ''}\n]);\necho curl_exec($ch);`,
  }
}

function card(path, method, d, tag) {
  const el = document.createElement('div'); el.className = 'pg-ep'
  const params = (d.parameters || []).filter((p) => p.name !== 'apikey'), bodyProps = d.requestBody?.content?.['application/json']?.schema
  const access = d['x-access'] || (d['x-premium'] ? 'premium' : 'free'), paid = access !== 'free', offline = d['x-status'] === 'OFFLINE'
  const bodyKeys = Object.keys(bodyProps?.properties || {}), bodyReq = bodyProps?.required || []
  const chips = [`<span class="chip">x-api-key</span>`, ...params.map((p) => `<span class="chip ${p.required ? '' : 'opt'}">${esc(p.name)}</span>`), ...bodyKeys.map((k) => `<span class="chip ${bodyReq.includes(k) ? '' : 'opt'}">${esc(k)}</span>`)]
  const m = method.toLowerCase()
  el._txt = `${path} ${d.summary || ''} ${d.description || ''} ${tag}`.toLowerCase()
  const field = (name, label, extra, ph, req, kind) => `<div><div class="lbl"><span>${esc(label)}${req ? ' <em>*</em>' : ''}</span><span>${esc(extra)}</span></div><input data-k="${esc(name)}" data-in="${kind}" placeholder="${esc(ph)}" autocomplete="off" spellcheck="false"></div>`
  el.innerHTML = `<button class="hd" data-hd><span class="mt ${m}">${esc(method.toUpperCase())}</span><span class="p">${esc(path)}</span>${access === 'vip' ? '<span class="tag2">vip</span>' : access === 'premium' ? '<span class="tag2">premium</span>' : access === 'owner' ? '<span class="tag2">owner</span>' : ''}${offline ? '<span class="tag2" style="color:var(--bad);border-color:var(--bad)">offline</span>' : ''}<span class="chev">${ico('chev')}</span></button>
  <div class="pg-b"><div class="in">
    ${d.summary || d.description ? `<p class="desc">${esc(d.summary || '')}${d.summary && d.description ? ' · ' : ''}${esc(d.description || '')}</p>` : ''}
    <div class="need"><span>Data yang diperlukan dari server:</span>${chips.join('')}</div>
    <div><div class="lbl"><span>x-api-key <span style="opacity:.6">(header)</span> <em>*</em></span><button class="ib" data-mine hidden title="Kembalikan ke key akunku" aria-label="Kembalikan ke key akunku" style="width:26px;height:26px">${ico('refresh')}</button></div>
      <input data-k="apikey" data-in="header" placeholder="arvo_xxxxxxxx (wajib)" autocomplete="off" spellcheck="false" value="${esc(savedKey)}"></div>
    ${params.map((p) => field(p.name, p.name, p.in, p.example ?? p.schema?.default ?? p.schema?.type ?? p.name, p.required, p.in)).join('')}
    ${bodyKeys.map((k) => field(k, k, 'body', bodyProps.properties[k].example ?? k, bodyReq.includes(k), 'body')).join('')}
    ${d.requestBody && !bodyKeys.length ? `<div><div class="lbl"><span>Body</span><span>JSON</span></div><textarea data-body rows="4" placeholder='{ "key": "value" }' spellcheck="false"></textarea></div>` : ''}
    <div><div class="lbl"><span>Pilih contoh kode</span><button class="ib" data-cc aria-label="Salin kode" hidden>${ico('copy')}</button></div>
      <select data-lang><option value="">Pilih</option>${Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <div class="cbox" data-code style="margin-top:8px" hidden><pre></pre></div></div>
    <div><div class="lbl"><span>Request URL (Try it)</span></div><div class="ubox"><code data-ru></code></div></div>
    <button class="btn go block" data-run>${ico('play')} Try it out</button>
    <p class="warn" data-warn hidden>${access === 'owner' ? 'Endpoint owner: isi x-api-key dengan Access Key pengelola.' : access === 'free' ? 'Isi x-api-key milikmu.' : `Endpoint ${access === 'vip' ? 'VIP' : 'premium'}: isi x-api-key dari paket yang sesuai.`}</p>
    <div><div class="lbl"><span>Full URL</span></div><div class="ubox"><code data-fu></code><button class="ib" data-cu aria-label="Salin URL">${ico('copy')}</button></div></div>
    <div><div class="rh"><span class="l">Response</span><button class="btn ghost sm" data-cr>${ico('copy')} Copy Result</button></div>
      <div class="cbox" data-out><p class="empty">Belum ada response. Klik Try it out.</p></div><p class="rmeta" data-meta></p></div>
  </div></div>`
  const q = (s) => el.querySelector(s)
  const keyEl = q('[data-k="apikey"]')
  keyEl.addEventListener('input', () => setKey(keyEl.value.trim(), keyEl))
  q('[data-mine]').onclick = () => { keyEl.value = acct(); setKey(acct(), keyEl) }
  q('[data-mine]').hidden = !acct() || savedKey === acct()
  /* query (apikey di depan, mirip betabotz) dan body dipisah */
  const build = () => {
    let p = path; const qs = new URLSearchParams(), bd = {}
    el.querySelectorAll('[data-k]').forEach((i) => {
      const v = i.value.trim(); if (!v) return
      if (i.dataset.in === 'header') return
      if (i.dataset.in === 'path') p = p.replace(`{${i.dataset.k}}`, encodeURIComponent(v))
      else if (i.dataset.in === 'body') bd[i.dataset.k] = v
      else qs.append(i.dataset.k, v)
    })
    const raw = q('[data-body]')?.value.trim()
    const rel = p + (qs.toString() ? '?' + qs : '')
    return { rel, url: location.origin + rel, body: raw || (Object.keys(bd).length ? JSON.stringify(bd) : ''), key: keyEl.value.trim() }
  }
  const showCode = () => {
    const l = q('[data-lang]').value, box = q('[data-code]'); box.hidden = !l; q('[data-cc]').hidden = !l
    if (l) { const { url, body, key } = build(); box.querySelector('pre').textContent = snippets(method.toUpperCase(), url, body, key)[l] }
  }
  el._r = () => {
    const { rel, url, key } = build(); q('[data-ru]').textContent = rel; q('[data-fu]').textContent = url
    q('[data-warn]').hidden = !!key; showCode()
  }
  el.addEventListener('input', el._r); el._r()
  let last = ''
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return
    if ('hd' in b.dataset) el.classList.toggle('open')
    else if ('cu' in b.dataset) navigator.clipboard.writeText(build().url).then(() => flash(b))
    else if ('cc' in b.dataset) navigator.clipboard.writeText(q('[data-code] pre').textContent).then(() => flash(b))
    else if ('cr' in b.dataset) { if (last) navigator.clipboard.writeText(last).then(() => flash(b, 'Tersalin')) }
    else if ('run' in b.dataset) {
      const { url, body, key } = build(), out = q('[data-out]'), meta = q('[data-meta]')
      const headers = { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'x-api-key': key } : {}) }
      b.disabled = true; b.innerHTML = '<i class="spin"></i> Menjalankan…'; const t0 = performance.now()
      try {
        const r = await fetch(url, { method: method.toUpperCase(), headers, body: method.toLowerCase() === 'get' ? undefined : body || undefined })
        const ct = r.headers.get('content-type') || '', ms = Math.round(performance.now() - t0)
        if (ct.startsWith('image/')) { const u = URL.createObjectURL(await r.blob()); out.innerHTML = `<img src="${u}" alt="response" style="max-width:100%;display:block;margin:12px auto;border-radius:8px">`; last = url }
        else { const txt = await r.text(); let shown = txt; try { shown = JSON.stringify(JSON.parse(txt), null, 2) } catch {} ; out.innerHTML = '<pre></pre>'; out.querySelector('pre').textContent = shown; last = shown }
        const rl = r.headers.get('x-ratelimit-remaining'), lim = r.headers.get('x-ratelimit-limit'), plan = r.headers.get('x-plan')
        meta.innerHTML = `Status <b class="${r.ok ? 'ok' : 'err'}">${r.status}</b> · ${ms} ms · ${esc(ct || 'tanpa content-type')}${lim ? ` · kuota ${esc(rl)}/${esc(lim)}` : ''}${plan ? ` · ${esc(plan)}` : ''}`
      } catch (err) { out.innerHTML = '<pre></pre>'; out.querySelector('pre').textContent = err.message; meta.innerHTML = '<b class="err">Gagal</b> terhubung ke server'; last = '' }
      b.disabled = false; b.innerHTML = ico('play') + ' Try it out'
    }
  })
  return el
}

const groups = []
function applyFilter() {
  const s = $('#sq').value.toLowerCase().trim().slice(0, 60)
  let any = false
  for (const g of groups) {
    let n = 0
    g.eps.forEach((e) => { const ok = !s || e._txt.includes(s); e.hidden = !ok; if (ok) n++ })
    g.el.hidden = n === 0; any ||= n > 0
    g.cnt.textContent = s ? `${n} dari ${g.eps.length} endpoint` : `${g.eps.length} endpoint`
    if (s && n) g.el.classList.add('open')
  }
  $('#none').hidden = any
}

const showMsg = (t, cls = 'sub') => ($('#list').innerHTML = `<p class="${cls}" style="white-space:pre-wrap">${esc(t)}</p>`)
Promise.all([ready.catch(() => ({})), fetch('/api/catalog', { cache: 'no-store', credentials: 'same-origin' }).then(async (r) => ({ r, j: await r.json().catch(() => null) }))]).then(([sess, { r, j: spec }]) => {
  me = sess.user || null; initKey()
  if (!r.ok || !spec || !spec.paths) return showMsg(`Gagal memuat daftar endpoint (HTTP ${r.status}).\n${(spec && (spec.message || spec.error)) || 'Respons server tidak valid.'}${spec && spec.detail ? '\n' + spec.detail : ''}`, 'err')
  const list = $('#list'); list.innerHTML = '<p class="nores" id="none" hidden>Tidak ada endpoint yang cocok.</p>'
  const by = {}
  for (const [path, ms] of Object.entries(spec.paths)) for (const [m, d] of Object.entries(ms)) (by[d.tags?.[0] || 'default'] ||= []).push([path, m, d])
  if (!Object.keys(by).length) { list.innerHTML = `<p class="nores">Belum ada endpoint yang bisa kamu akses.${spec.warnings ? '<br><small>' + esc(spec.warnings.join(' · ')) + '</small>' : ''}</p>`; return }
  Object.entries(by).forEach(([tag, eps], i) => {
    const g = document.createElement('section'); g.className = 'grp' + (i === 0 ? ' open' : ''); g.style.animationDelay = i * 0.05 + 's'
    g.innerHTML = `<button class="grp-h">${tile('folder')}<span>${esc(tag)}</span><span class="cnt"></span><span class="chev">${ico('chev')}</span></button><div class="grp-b"><div class="in"></div></div>`
    const els = eps.map(([p, m, d]) => card(p, m, d, tag)); g.querySelector('.in').append(...els)
    g.querySelector('.grp-h').onclick = () => g.classList.toggle('open')
    list.insertBefore(g, $('#none')); groups.push({ el: g, eps: els, cnt: g.querySelector('.cnt') })
  })
  if (spec.warnings) list.insertAdjacentHTML('beforeend', `<p class="sub" style="font-size:12px">Catatan untuk admin: ${esc(spec.warnings.join(' · '))}</p>`)
  applyFilter()
}).catch((e) => showMsg('Gagal memuat daftar endpoint: ' + e.message, 'err'))
$('#sq').oninput = applyFilter
