const pk = $('#pk')
pk.value = localStorage.getItem('arvo_key') || ''
pk.oninput = () => localStorage.setItem('arvo_key', pk.value.trim())
ready.then(({ user }) => { if (user) { $('#mine').hidden = false; $('#mine').onclick = () => { pk.value = user.api_key; pk.oninput() } } })
$('#dl').onclick = async () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(await (await fetch('/docs')).blob()); a.download = 'openapi.json'; a.click()
}

const snippets = (method, url, body, key) => {
  const h = key ? { 'x-api-key': key } : {}
  const hc = Object.entries(h).map(([k, v]) => ` \\\n  -H '${k}: ${v}'`).join('') + (body ? " \\\n  -H 'Content-Type: application/json'" : '')
  return {
    curl: `curl -X ${method} '${url}'${hc}${body ? ` \\\n  -d '${body}'` : ''}`,
    js: `const res = await fetch('${url}', {\n  method: '${method}',\n  headers: ${JSON.stringify(body ? { ...h, 'Content-Type': 'application/json' } : h)}${body ? `,\n  body: JSON.stringify(${body})` : ''}\n})\nconsole.log(await res.json())`,
    py: `import requests\n\nr = requests.${method.toLowerCase()}('${url}', headers=${JSON.stringify(h)}${body ? `, json=${body}` : ''})\nprint(r.json())`,
  }
}

function card(path, method, d) {
  const el = document.createElement('details'); el.className = 'ep'
  const params = (d.parameters || []).map((p) => `<input data-k="${esc(p.name)}" data-in="${p.in}" placeholder="${esc(p.name)}${p.required ? ' *' : ''} (${p.in})">`).join('')
  el.innerHTML = `<summary><span class="m">${method}</span><span class="p">${esc(path)}</span>${d['x-premium'] ? '<span class="tag2">premium</span>' : ''}<span class="s">${esc(d.summary || '')}</span></summary>
    <div class="in"><p class="sub">${esc(d.description || '')}</p>${params}
    ${d.requestBody ? '<textarea data-body rows="5" placeholder=\'{ "key": "value" }\' style="font-family:JetBrains Mono,monospace"></textarea>' : ''}
    <div class="row"><button class="btn" data-run>Execute</button><button class="btn ghost" data-code>Kode</button></div>
    <div class="code" data-snip hidden><div class="tabs"><button class="on" data-t="curl">cURL</button><button data-t="js">JavaScript</button><button data-t="py">Python</button></div><pre></pre></div>
    <div class="res" data-res hidden><div class="h" data-meta></div><pre></pre></div></div>`
  const build = () => {
    let p = path; const q = new URLSearchParams()
    el.querySelectorAll('[data-k]').forEach((i) => { if (!i.value) return; i.dataset.in === 'path' ? (p = p.replace(`{${i.dataset.k}}`, encodeURIComponent(i.value))) : q.append(i.dataset.k, i.value) })
    return { url: location.origin + p + (q.toString() ? '?' + q : ''), body: el.querySelector('[data-body]')?.value.trim() }
  }
  const showSnip = (t) => {
    const { url, body } = build(); const box = el.querySelector('[data-snip]')
    box.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t))
    box.querySelector('pre').textContent = snippets(method.toUpperCase(), url, body, pk.value.trim())[t]
  }
  el.querySelector('[data-code]').onclick = () => { const b = el.querySelector('[data-snip]'); b.hidden = !b.hidden; if (!b.hidden) showSnip('curl') }
  el.querySelectorAll('[data-snip] .tabs button').forEach((b) => (b.onclick = () => showSnip(b.dataset.t)))
  el.querySelector('[data-run]').onclick = async (ev) => {
    const btn = ev.target, { url, body } = build(), res = el.querySelector('[data-res]')
    const headers = { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(pk.value.trim() ? { 'x-api-key': pk.value.trim() } : {}) }
    btn.disabled = true; btn.textContent = 'Menjalankan…'; const t0 = performance.now()
    try {
      const r = await fetch(url, { method: method.toUpperCase(), headers, body: body || undefined })
      const txt = await r.text(); let shown = txt; try { shown = JSON.stringify(JSON.parse(txt), null, 2) } catch {}
      const rl = r.headers.get('x-ratelimit-remaining'), lim = r.headers.get('x-ratelimit-limit')
      el.querySelector('[data-meta]').innerHTML = `<b class="${r.ok ? 'ok' : 'err'}">${r.status}</b> · ${Math.round(performance.now() - t0)} ms${lim ? ` · kuota ${esc(rl)}/${esc(lim)}` : ''}${r.headers.get('x-plan') ? ` · ${esc(r.headers.get('x-plan'))}` : ''}`
      res.querySelector('pre').textContent = shown
    } catch (e) { el.querySelector('[data-meta]').textContent = 'Gagal'; res.querySelector('pre').textContent = e.message }
    res.hidden = false; btn.disabled = false; btn.textContent = 'Execute'
  }
  return el
}

fetch('/docs').then((r) => r.json()).then((spec) => {
  const list = $('#list'); list.innerHTML = ''
  const groups = {}
  for (const [path, ms] of Object.entries(spec.paths || {})) for (const [m, d] of Object.entries(ms)) (groups[d.tags?.[0] || 'default'] ||= []).push([path, m, d])
  for (const [tag, eps] of Object.entries(groups)) {
    list.insertAdjacentHTML('beforeend', `<h3 style="margin:18px 0 10px">${esc(tag)}</h3>`)
    eps.forEach(([p, m, d]) => list.append(card(p, m, d)))
  }
}).catch((e) => ($('#list').innerHTML = `<p class="err">Gagal memuat spec: ${esc(e.message)}</p>`))
$('#sq').oninput = (e) => document.querySelectorAll('.ep').forEach((el) => (el.hidden = !el.textContent.toLowerCase().includes(e.target.value.toLowerCase().slice(0, 60))))
