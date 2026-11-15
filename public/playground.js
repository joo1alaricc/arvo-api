document.querySelectorAll('[data-ico]').forEach((e) => (e.innerHTML = ico(e.dataset.ico)))
const pk = $('#pk')
try { pk.value = localStorage.getItem('arvo_key') || '' } catch {}
pk.oninput = () => { try { localStorage.setItem('arvo_key', pk.value.trim()) } catch {} ; document.querySelectorAll('.pg-ep').forEach((e) => e._r?.()) }
ready.then(({ user }) => { if (user) { $('#mine').hidden = false; $('#mine').onclick = () => { pk.value = user.api_key; pk.oninput() } } })
$('#dl').onclick = async () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(await (await fetch('/docs')).blob()); a.download = 'openapi.json'; a.click()
}

const LANGS = { curl: 'cURL', js: 'JavaScript (fetch)', py: 'Python (requests)', php: 'PHP (cURL)' }
const snippets = (method, url, body, key) => {
  const h = { ...(key ? { 'x-api-key': key } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }
  const hc = Object.entries(h).map(([k, v]) => ` \\\n  -H '${k}: ${v}'`).join('')
  const hp = Object.entries(h).map(([k, v]) => `    '${k}: ${v}'`).join(',\n')
  return {
    curl: `curl -X ${method} '${url}'${hc}${body ? ` \\\n  -d '${body}'` : ''}`,
    js: `const res = await fetch('${url}', {\n  method: '${method}',\n  headers: ${JSON.stringify(h)}${body ? `,\n  body: JSON.stringify(${body})` : ''}\n})\nconsole.log(await res.json())`,
    py: `import requests\n\nr = requests.${method.toLowerCase()}('${url}', headers=${JSON.stringify(h)}${body ? `, json=${body}` : ''})\nprint(r.json())`,
    php: `<?php\n$ch = curl_init('${url}');\ncurl_setopt_array($ch, [\n  CURLOPT_CUSTOMREQUEST => '${method}',\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_HTTPHEADER => [\n${hp}\n  ],${body ? `\n  CURLOPT_POSTFIELDS => '${body}',` : ''}\n]);\necho curl_exec($ch);`,
  }
}

function card(path, method, d, tag) {
  const el = document.createElement('div'); el.className = 'pg-ep'
  const params = d.parameters || [], premium = !!d['x-premium'], needs = params.filter((p) => p.required)
  const chips = [...(premium ? ['<span class="chip">x-api-key</span>'] : []), ...params.map((p) => `<span class="chip ${p.required ? '' : 'opt'}">${esc(p.name)}</span>`)]
  const m = method.toLowerCase()
  el._txt = `${path} ${d.summary || ''} ${d.description || ''} ${tag}`.toLowerCase()
  el.innerHTML = `<button class="hd" data-hd><span class="mt ${m}">${esc(method.toUpperCase())}</span><span class="p">${esc(path)}</span>${premium ? '<span class="tag2">premium</span>' : ''}<span class="chev">${ico('chev')}</span></button>
  <div class="pg-b">
    ${d.summary || d.description ? `<p class="desc">${esc(d.summary || '')}${d.summary && d.description ? ' · ' : ''}${esc(d.description || '')}</p>` : ''}
    <div class="need"><span>Data yang diperlukan:</span>${chips.join('') || '<span class="chip opt">tidak ada</span>'}</div>
    ${params.map((p) => `<div><div class="lbl"><span>${esc(p.name)}${p.required ? ' <em>*</em>' : ''}</span><span>${esc(p.in)}</span></div><input data-k="${esc(p.name)}" data-in="${esc(p.in)}" placeholder="${esc(p.example ?? p.schema?.default ?? p.schema?.type ?? p.name)}" autocomplete="off" spellcheck="false"></div>`).join('')}
    ${d.requestBody ? `<div><div class="lbl"><span>Body</span><span>JSON</span></div><textarea data-body rows="5" placeholder='{ "key": "value" }' spellcheck="false"></textarea></div>` : ''}
    <div><div class="lbl"><span>Request URL (Try it)</span></div><div class="ubox"><code data-ru></code></div></div>
    <button class="btn go block" data-run>${ico('play')} Try it out</button>
    <p class="warn" data-warn hidden>Endpoint premium: isi API key di bagian atas halaman.</p>
    <div><div class="lbl"><span>Full URL</span></div><div class="ubox"><code data-fu></code><button class="ib" data-cu aria-label="Salin URL">${ico('copy')}</button></div></div>
    <div><div class="lbl"><span>Contoh kode</span><button class="ib" data-cc aria-label="Salin kode" hidden>${ico('copy')}</button></div>
      <select data-lang><option value="">Pilih contoh kode</option>${Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <div class="cbox" data-code style="margin-top:8px" hidden><pre></pre></div></div>
    <div><div class="rh"><span class="l">Response</span><button class="btn ghost sm" data-cr>${ico('copy')} Copy Result</button></div>
      <div class="cbox" data-out><p class="empty">Belum ada response. Klik Try it out.</p></div><p class="rmeta" data-meta></p></div>
  </div>`
  const q = (s) => el.querySelector(s)
  const build = () => {
    let p = path; const qs = new URLSearchParams()
    el.querySelectorAll('[data-k]').forEach((i) => { if (!i.value.trim()) return; i.dataset.in === 'path' ? (p = p.replace(`{${i.dataset.k}}`, encodeURIComponent(i.value.trim()))) : qs.append(i.dataset.k, i.value.trim()) })
    const rel = p + (qs.toString() ? '?' + qs : '')
    return { rel, url: location.origin + rel, body: q('[data-body]')?.value.trim() }
  }
  const showCode = () => {
    const l = q('[data-lang]').value, box = q('[data-code]'); box.hidden = !l; q('[data-cc]').hidden = !l
    if (l) { const { url, body } = build(); box.querySelector('pre').textContent = snippets(method.toUpperCase(), url, body, pk.value.trim())[l] }
  }
  el._r = () => {
    const { rel, url } = build(); q('[data-ru]').textContent = rel; q('[data-fu]').textContent = url
    q('[data-warn]').hidden = !(premium && !pk.value.trim()); showCode()
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
      const { url, body } = build(), out = q('[data-out]'), meta = q('[data-meta]'), key = pk.value.trim()
      const headers = { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'x-api-key': key } : {}) }
      b.disabled = true; b.innerHTML = 'Menjalankan…'; const t0 = performance.now()
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

fetch('/docs').then((r) => r.json()).then((spec) => {
  const list = $('#list'); list.innerHTML = '<p class="nores" id="none" hidden>Tidak ada endpoint yang cocok.</p>'
  const by = {}
  for (const [path, ms] of Object.entries(spec.paths || {})) for (const [m, d] of Object.entries(ms)) (by[d.tags?.[0] || 'default'] ||= []).push([path, m, d])
  Object.entries(by).forEach(([tag, eps], i) => {
    const g = document.createElement('section'); g.className = 'grp' + (i === 0 ? ' open' : '')
    g.innerHTML = `<button class="grp-h">${tile('folder')}<span>${esc(tag)}</span><span class="cnt"></span><span class="chev">${ico('chev')}</span></button><div class="grp-b"></div>`
    const els = eps.map(([p, m, d]) => card(p, m, d, tag)); g.querySelector('.grp-b').append(...els)
    g.querySelector('.grp-h').onclick = () => g.classList.toggle('open')
    list.insertBefore(g, $('#none')); groups.push({ el: g, eps: els, cnt: g.querySelector('.cnt') })
  })
  applyFilter()
}).catch((e) => ($('#list').innerHTML = `<p class="err">Gagal memuat spec: ${esc(e.message)}</p>`))
$('#sq').oninput = applyFilter
