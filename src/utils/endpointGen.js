/* Pembuat endpoint "nyata": menghasilkan file JS di src/api/<kategori>/<slug>.js dan mendaftarkannya di src/api/index.js.
 * Strukturnya sama persis dengan endpoint bawaan (createRoute + handler). Kode admin dinormalisasi otomatis. */

const ID = /^[a-z0-9_-]{1,30}$/
const RESERVED_CAT = ['billing', 'auth', 'admin']
const RESERVED_VARS = ['c', 'query', 'body', 'ip', 'input', 'env', 'ctx', 'context', 'req']
const JS_WORDS = new Set('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static await async of'.split(' '))

const camel = (s) => s.replace(/[-_]+([a-z0-9])/g, (_, ch) => ch.toUpperCase())
export const exportNames = (category, slug) => {
    let base = camel(category) + camel(slug).replace(/^./, (ch) => ch.toUpperCase())
    if (!/^[A-Za-z_]/.test(base)) base = 'ep' + base
    return { route: base + 'Route', handler: base + 'Handler', file: `${category}/${slug}.js`, path: `src/api/${category}/${slug}.js` }
}

export const EXAMPLE = `// Contoh isi "Kode handler" (cukup bagian dalam fungsi):
const { url } = input                 // input = gabungan query + body
if (!url.startsWith('https://')) return c.json({ error: 'url harus https' }, 400)

const res = await fetch('https://api.example.com/info?u=' + encodeURIComponent(url))
const data = await res.json()
return { status: 'ok', result: data, ip }   // object biasa otomatis dibungkus c.json()`

export const STRUCTURE_HELP = [
    'File dibuat di src/api/<kategori>/<slug>.js dan diekspor sebagai <nama>Route (createRoute) + <nama>Handler.',
    'Variabel yang tersedia di handler: c (context Hono), input (query+body), query, body, ip, env, serta tiap nama input (mis. url).',
    'Boleh return object/array/string (otomatis jadi JSON) atau return c.json(...) / new Response(...).',
    'Workers tidak punya require(), fs, atau eval. Pakai fetch() untuk memanggil API lain. Secret lewat env.NAMA.',
]

/* Normalisasi kode admin -> { imports, body, mode, notes[], issues[] } */
export const analyze = (raw, { category, slug }) => {
    const notes = [], issues = []
    let code = String(raw || '').replace(/\r\n/g, '\n').trim()
    const fence = code.match(/^```(?:js|javascript|ts)?\n([\s\S]*?)\n```$/i)
    if (fence) { code = fence[1].trim(); notes.push('Pagar ``` dibuang.') }
    if (!code) return { imports: [], body: '', mode: 'empty', notes, issues: ['Kode kosong.'] }
    if (code.length > 20000) issues.push('Kode terlalu panjang (maks 20.000 karakter).')

    /* 1) File lengkap bergaya bawaan */
    if (/createRoute\s*\(/.test(code)) {
        const r = code.match(/export\s+const\s+(\w+Route)\s*=\s*createRoute/), h = code.match(/export\s+(?:const|function|async function)\s+(\w+Handler)\b/)
        if (!r) issues.push('Ada createRoute() tapi tidak diekspor sebagai "export const <nama>Route = createRoute(...)".')
        if (!h) issues.push('Handler belum diekspor. Tambahkan "export const <nama>Handler = (c) => c.json({...})".')
        const want = `/api/${category}/${slug}`
        const pm = code.match(/path:\s*['"`]([^'"`]+)['"`]/)
        if (pm && pm[1] !== want) { code = code.replace(pm[0], `path: '${want}'`); notes.push(`path di kode (${pm[1]}) disesuaikan menjadi ${want}.`) }
        if (!/from\s+['"]@hono\/zod-openapi['"]/.test(code)) { code = `import { createRoute, z } from '@hono/zod-openapi'\n` + code; notes.push('Import createRoute/z ditambahkan.') }
        lint(code, issues, notes)
        return { mode: 'full', full: code, routeName: r?.[1], handlerName: h?.[1], notes, issues, imports: [], body: '' }
    }

    /* 2) Hanya handler: kumpulkan import, lalu bungkus */
    const imports = []
    code = code.replace(/^\s*import\s[^;\n]+(?:;|$)/gm, (m) => { imports.push(m.trim().replace(/;?$/, '')); return '' }).trim()
    if (imports.length) notes.push(`${imports.length} baris import dipindah ke bagian atas file.`)
    for (const m of imports) if (/from\s+['"](axios|node-fetch|cheerio|got|request)['"]/.test(m)) issues.push(`Paket tidak terpasang: ${m}. Pakai fetch() bawaan, atau tambahkan paketnya ke package.json lewat upload ZIP.`)

    let body = code, mode = 'body'
    const ed = code.match(/^export\s+default\s+([\s\S]+?);?$/)
    if (ed) { body = `const __h = ${ed[1]}\nreturn __h(c)`; mode = 'wrapped'; notes.push('"export default" diubah menjadi pemanggilan handler.') }
    else if (/^(?:async\s*)?(?:\(|function\b|[A-Za-z_$][\w$]*\s*=>)/.test(code) && !/^\s*(?:const|let|var)\b/.test(code)) { body = `const __h = (${code.replace(/;$/, '')})\nreturn __h(c)`; mode = 'wrapped'; notes.push('Fungsi anonim dibungkus dan dipanggil dengan (c).') }
    else {
        const d = code.match(/^(?:export\s+)?(?:async\s+)?function\s+([\w$]+)\s*\(/) || code.match(/^(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:function\b|\()/)
        if (d) { body = `${code.replace(/^export\s+/, '')}\nreturn ${d[1]}(c)`; mode = 'wrapped'; notes.push(`Fungsi ${d[1]}() dipanggil otomatis dengan (c).`) }
    }
    if (mode === 'body' && !/\breturn\b/.test(body)) { body = `return (${body.replace(/;$/, '')})`; notes.push('Tidak ada "return": ekspresi dijadikan nilai balik.') }
    lint(body, issues, notes)
    return { mode, body, imports, notes, issues }
}

function lint(code, issues, notes) {
    if (/\brequire\s*\(/.test(code)) issues.push('require() tidak didukung di Workers. Pakai import di atas file atau fetch().')
    if (/\beval\s*\(|new\s+Function\s*\(/.test(code)) issues.push('eval/new Function dilarang di Cloudflare Workers.')
    if (/\bfrom\s+['"](fs|path|os|child_process|net|http|https)['"]/.test(code) || /\brequire\(['"](fs|child_process)['"]\)/.test(code)) issues.push('Modul Node (fs/path/os/child_process/http) tidak ada di Workers.')
    if (/\bprocess\.env\b/.test(code)) notes.push('process.env tidak ada di Workers. Pakai env.NAMA (secret/vars).')
    if (/\bres\.(send|json|status)\b/.test(code) && !/c\.json/.test(code)) notes.push('Terlihat gaya Express (res.json). Di sini pakai: return c.json({...}) atau return object biasa.')
}

/* Validasi form + susun file */
export const build = (b, analysis, existingInputs = []) => {
    const e = { category: String(b.category || '').trim().toLowerCase(), slug: String(b.slug || '').trim().toLowerCase(), name: String(b.name || '').trim(),
        description: String(b.description || '').trim().slice(0, 300), method: String(b.method || 'GET').toUpperCase(), access: b.access || 'free', status: b.status === 'offline' ? 'offline' : 'online' }
    const issues = [...(analysis.issues || [])]
    if (!ID.test(e.category) || !ID.test(e.slug)) issues.push('Kategori & slug 1-30 karakter: huruf kecil, angka, _ atau -.')
    if (RESERVED_CAT.includes(e.category) || e.slug === 'routes') issues.push('Kategori/slug itu dicadangkan.')
    if (!['GET', 'POST'].includes(e.method)) issues.push('Method harus GET atau POST.')
    if (!['free', 'premium', 'vip', 'owner'].includes(e.access)) issues.push('Akses tidak valid.')
    let inputs = []
    try { inputs = typeof b.inputs === 'string' ? JSON.parse(b.inputs || '[]') : b.inputs || [] } catch { issues.push('Input bukan JSON valid.') }
    if (!Array.isArray(inputs) || inputs.length > 20) { issues.push('Input maksimal 20 field.'); inputs = [] }
    const clean = []
    for (const i of inputs) {
        const name = String(i.name || '').trim()
        if (!/^[A-Za-z_][A-Za-z0-9_]{0,30}$/.test(name)) { issues.push(`Nama input tidak valid: ${name || '(kosong)'}`); continue }
        if (RESERVED_VARS.includes(name)) issues.push(`Nama input "${name}" bentrok dengan variabel bawaan handler (${RESERVED_VARS.join(', ')}).`)
        if (name.toLowerCase() === 'apikey') issues.push('Nama input "apikey" dicadangkan.')
        if (clean.some((x) => x.name === name)) issues.push(`Nama input ganda: ${name}`)
        clean.push({ name, in: i.in === 'body' && e.method === 'POST' ? 'body' : 'query', required: !!i.required, example: String(i.example ?? '').slice(0, 200) })
    }
    if (issues.length) return { ok: false, issues, notes: analysis.notes || [] }

    const n = exportNames(e.category, e.slug), q = clean.filter((i) => i.in === 'query'), bd = clean.filter((i) => i.in === 'body')
    const zf = (i) => `${i.name}: z.string()${i.example ? `.openapi({ example: ${JSON.stringify(i.example)} })` : ''}${i.required ? '' : '.optional()'}`
    const req = []
    if (q.length) req.push(`query: z.object({ ${q.map(zf).join(', ')} })`)
    if (bd.length) req.push(`body: { content: { 'application/json': { schema: z.object({ ${bd.map(zf).join(', ')} }) } }, required: ${bd.some((i) => i.required)} }`)

    let content
    if (analysis.mode === 'full') {
        content = `// @arvo-endpoint ${JSON.stringify({ category: e.category, slug: e.slug, name: e.name, mode: 'full' })}\n` + analysis.full.replace(/^\/\/ @arvo-endpoint.*\n/, '') + '\n'
        n.route = analysis.routeName || n.route; n.handler = analysis.handlerName || n.handler
    } else {
        const vars = clean.map((i) => i.name).filter((x) => !JS_WORDS.has(x))
        const userCode = analysis.body.split('\n').map((l) => '        ' + l).join('\n')
        content = `// @arvo-endpoint ${JSON.stringify({ category: e.category, slug: e.slug, name: e.name, mode: 'handler', inputs: clean })}
// Dibuat dari dashboard admin. Aman diedit manual: bagian di antara penanda handler dibaca lagi oleh dashboard.
import { createRoute, z } from '@hono/zod-openapi'
${analysis.imports.map((x) => x + '\n').join('')}
export const ${n.route} = createRoute({
    method: '${e.method.toLowerCase()}',
    path: '/api/${e.category}/${e.slug}',
    tags: ['${e.category}'],
    description: ${JSON.stringify(e.description || e.name)},
    'x-status': '${e.status === 'offline' ? 'OFFLINE' : 'ONLINE'}',
    'x-access': '${e.access}',${req.length ? `\n    request: { ${req.join(', ')} },` : ''}
    responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' } },
})

export const ${n.handler} = async (c) => {
    const env = c.env, ip = c.get('ip')
    const query = c.req.query()
    const body = ${e.method === 'POST' ? "await c.req.json().catch(() => ({}))" : '{}'}
    const input = { ...query, ...body }
${vars.length ? `    const { ${vars.join(', ')} } = input\n` : ''}    const out = await (async () => {
        // <handler-code>
${userCode}
        // </handler-code>
    })()
    if (out instanceof Response) return out
    return c.json(out ?? { status: 'ok' }, 200)
}
`
    }
    return { ok: true, endpoint: { ...e, inputs: clean }, names: n, files: [{ path: n.path, content }], notes: analysis.notes || [], mode: analysis.mode, body: analysis.body }
}

/* Ambil kembali kode handler dari file yang dibuat dashboard (untuk Edit). */
export const readBack = (src) => {
    const meta = src.match(/^\/\/ @arvo-endpoint (.+)$/m)
    let info = null; try { info = meta ? JSON.parse(meta[1]) : null } catch {}
    const m = src.match(/\/\/ <handler-code>\n([\s\S]*?)\n\s*\/\/ <\/handler-code>/)
    const route = src.match(/export const (\w+Route)\b/)?.[1], handler = src.match(/export (?:const|async function|function) (\w+Handler)\b/)?.[1]
    const desc = src.match(/description:\s*("(?:[^"\\]|\\.)*")/)?.[1], method = src.match(/method:\s*'(\w+)'/)?.[1], access = src.match(/'x-access':\s*'(\w+)'/)?.[1], status = src.match(/'x-status':\s*'(\w+)'/)?.[1]
    let description = ''; try { description = JSON.parse(desc || '""') } catch {}
    return { info, route, handler, method: (method || 'get').toUpperCase(), access: access || 'free', status: status === 'OFFLINE' ? 'offline' : 'online', description,
        code: m ? m[1].split('\n').map((l) => l.replace(/^ {8}/, '')).join('\n') : (info?.mode === 'full' || !info ? src : '') }
}

/* ---- penambahan / penghapusan baris di src/api/index.js ---- */
export const patchIndex = (src, { file, route, handler }, remove = false) => {
    const imp = `import { ${route}, ${handler} } from './${file}'`
    if (remove) {
        const out = src.split('\n').filter((l) => !l.includes(`from './${file}'`) && !new RegExp(`^\\s*\\[\\s*${route}\\s*,\\s*${handler}\\s*\\],?\\s*(//.*)?$`).test(l)).join('\n')
        return { ok: true, src: out, changed: out !== src }
    }
    if (src.includes(`from './${file}'`)) return { ok: true, src, changed: false }
    const lines = src.split('\n')
    let last = -1; lines.forEach((l, i) => { if (/^import\s.+from\s.+$/.test(l)) last = i })
    if (last < 0) return { ok: false, message: 'Tidak menemukan baris import di src/api/index.js.' }
    lines.splice(last + 1, 0, imp)
    let out = lines.join('\n')
    const m = out.match(/(const BUILTIN = \[[\s\S]*?)(\s*\n\])/)
    if (!m) return { ok: false, message: 'Tidak menemukan "const BUILTIN = [ ... ]" di src/api/index.js. Tambahkan manual: [' + route + ', ' + handler + '],' }
    const head = m[1].replace(/\s+$/, '').replace(/([^,\[])$/, '$1,')
    out = out.replace(m[0], `${head}\n    [${route}, ${handler}],${m[2]}`)
    return { ok: true, src: out, changed: true }
}
