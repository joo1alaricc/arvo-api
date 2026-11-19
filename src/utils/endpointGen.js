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

export const EXAMPLE = `import { createRoute, z } from '@hono/zod-openapi'

/* Tempel kode lengkap seperti src/api/downloader/tiktok.js. path, nama, akses & kategori
   di-set otomatis dari form dashboard, jadi nilainya di sini tidak harus sama. */
export const contohRoute = createRoute({
    method: 'get',
    path: '/api/contoh/halo',
    request: { query: z.object({ nama: z.string().openapi({ example: 'Arvo' }) }) },
    responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'OK' } },
})

export const contohHandler = async (c) => {
    const { nama } = c.req.valid('query')
    return c.json({ status: true, result: 'Halo ' + nama })
}`

export const STRUCTURE_HELP = [
    'Tempel kode seperti src/api/downloader/tiktok.js: export const <nama>Route = createRoute({...}) dan export const <nama>Handler = async (c) => {...}.',
    'Method & parameter (query/body) dibaca dari createRoute di kodemu. Path, nama, akses, dan kategori diambil dari form.',
    'Import relatif (mis. ../../utils/upstream.js) boleh dipakai. Workers tidak punya require(), fs, atau eval; pakai fetch(). Secret lewat c.env.NAMA.',
    'Cukup handler saja (tanpa createRoute) juga bisa; sistem membungkusnya otomatis.',
]

/* Set / sisipkan properti di objek createRoute({...}) */
const setProp = (code, key, literal) => {
    const k = key.replace(/-/g, '\\-')
    const re = new RegExp(`(['"]?)${k}\\1\\s*:\\s*(?:'[^']*'|"[^"]*"|\`[^\`]*\`|\\[[^\\]]*\\]|true|false)`)
    const q = /^[A-Za-z_$][\w$]*$/.test(key) ? key : `'${key}'`
    if (re.test(code)) return code.replace(re, () => `${q}: ${literal}`)
    return code.replace(/(\n([ \t]*)path:[^\n]*\n)/, (m, line, ind) => `${line}${ind}${q}: ${literal},\n`)
}
export const slugFrom = (path, category) => {
    const segs = String(path || '').trim().replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0].split('/').filter(Boolean).map((x) => x.toLowerCase())
    if (segs[0] === 'api') segs.shift()
    const slug = segs[segs.length - 1] || ''
    const cat = String(category || '').trim().toLowerCase() || (segs.length > 1 ? segs[segs.length - 2] : '')
    return { category: cat, slug }
}

/* Normalisasi kode admin -> { imports, body, mode, notes[], issues[] } */
export const analyze = (raw, { category, slug, name, access, status, description }) => {
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
        if (pm && pm[1] !== want) notes.push(`path di kode (${pm[1]}) diganti menjadi ${want}.`)
        const cut = code.search(/createRoute\s*\(/), P = (k, v) => { code = code.slice(0, cut) + setProp(code.slice(cut), k, v) }
        P('path', JSON.stringify(want).replace(/^"|"$/g, "'"))
        P('tags', `['${category}']`)
        if (access) { P('x-access', `'${access}'`); P('x-premium', access === 'free' ? 'false' : 'true') }
        if (status) P('x-status', status === 'offline' ? "'OFFLINE'" : "'ONLINE'")
        if (name) P('summary', JSON.stringify(name))
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
    const inferred = []
    const ds = body.match(/const\s*\{([^}]+)\}\s*=\s*(?:input|query|body|c\.req\.query\(\))/)
    if (ds) for (const n of ds[1].split(',').map((x) => x.split(/[:=]/)[0].trim())) if (/^[A-Za-z_]\w*$/.test(n) && !inferred.some((x) => x.name === n)) inferred.push({ name: n, in: 'query', required: true, example: '' })
    return { mode, body, imports, notes, issues, inferred, post: /c\.req\.json\(|\bbody\.\w/.test(body) }
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
    const full = analysis.mode === 'full'
    const e = { category: String(b.category || '').trim().toLowerCase(), slug: String(b.slug || '').trim().toLowerCase(), name: String(b.name || '').trim(),
        description: String(b.description || '').trim().slice(0, 300), method: String(b.method || (analysis.post ? 'POST' : 'GET')).toUpperCase(), access: b.access || 'free', status: b.status === 'offline' ? 'offline' : 'online' }
    const issues = [...(analysis.issues || [])]
    if (!ID.test(e.category) || !ID.test(e.slug)) issues.push('Kategori & path 1-30 karakter: huruf kecil, angka, _ atau -.')
    if (RESERVED_CAT.includes(e.category) || e.slug === 'routes') issues.push('Kategori/path itu dicadangkan.')
    if (!e.name) issues.push('Nama endpoint wajib diisi.')
    if (!['GET', 'POST'].includes(e.method)) issues.push('Method harus GET atau POST.')
    if (!['free', 'premium', 'vip', 'owner'].includes(e.access)) issues.push('Akses tidak valid.')
    let inputs = []
    if (!full) {
        try { inputs = typeof b.inputs === 'string' ? JSON.parse(b.inputs || '[]') : b.inputs || [] } catch { issues.push('Input bukan JSON valid.') }
        if (!inputs.length && analysis.inferred) inputs = analysis.inferred
    }
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

/* ---- penambahan / penghapusan baris di src/api/index.js ----
 * Nama diimpor dengan alias unik (<kategori><Slug>Route/Handler) supaya dua file dengan nama ekspor sama (mis. exampleRoute) tidak bentrok. */
export const patchIndex = (src, { file, route, handler, routeAs = route, handlerAs = handler }, remove = false) => {
    const alias = (a, b) => (a === b ? a : `${a} as ${b}`)
    const imp = `import { ${alias(route, routeAs)}, ${alias(handler, handlerAs)} } from './${file}'`
    if (remove) {
        /* pakai nama LOKAL sesuai baris import file ini, supaya tidak ikut menghapus entri file lain yang namanya kebetulan sama */
        const line = src.split('\n').find((l) => l.includes(`from './${file}'`)) || ''
        const loc = [...line.matchAll(/(?:(\w+)\s+as\s+)?(\w+)\s*(?:,|\})/g)].map((x) => x[2])
        const [nr, nh] = loc.length >= 2 ? loc : [routeAs, handlerAs]
        const re = new RegExp(`^\\s*\\[\\s*${nr}\\s*,\\s*${nh}\\s*\\],?\\s*(//.*)?$`)
        const out = src.split('\n').filter((l) => !l.includes(`from './${file}'`) && !re.test(l)).join('\n')
        return { ok: true, src: out, changed: out !== src }
    }
    if (src.includes(`from './${file}'`)) return { ok: true, src, changed: false }
    const lines = src.split('\n')
    let last = -1; lines.forEach((l, i) => { if (/^import\s.+from\s.+$/.test(l)) last = i })
    if (last < 0) return { ok: false, message: 'Tidak menemukan baris import di src/api/index.js.' }
    lines.splice(last + 1, 0, imp)
    let out = lines.join('\n')
    const m = out.match(/(const BUILTIN = \[[\s\S]*?)(\s*\n\])/)
    if (!m) return { ok: false, message: 'Tidak menemukan "const BUILTIN = [ ... ]" di src/api/index.js. Tambahkan manual: [' + routeAs + ', ' + handlerAs + '],' }
    const head = m[1].replace(/\s+$/, '').replace(/([^,\[])$/, '$1,')
    out = out.replace(m[0], () => `${head}\n    [${routeAs}, ${handlerAs}],${m[2]}`)
    return { ok: true, src: out, changed: true }
}

/* ---- Sinkronisasi src/api/index.js dengan isi folder src/api/<kategori>/ ----
 * index.js bisa tertimpa (mis. upload ZIP / deploy dari versi lama) sehingga import file endpoint hilang, atau tersisa import ke file yang sudah dihapus.
 * Sumber kebenarannya adalah file yang benar-benar ada di repo:
 *   - file endpoint (punya export <x>Route + <x>Handler) yang belum diimpor   -> ditambahkan (import + entri BUILTIN)
 *   - import yang menunjuk file yang sudah tidak ada                        -> dibuang (beserta entri BUILTIN-nya)
 *   - import ada tapi entri BUILTIN hilang                                  -> didaftarkan lagi
 *   - entri BUILTIN yang namanya tidak pernah diimpor                       -> dibuang (kalau dibiarkan, build gagal)
 * Hanya menyentuh baris import './<kategori>/<slug>.js' dan isi BUILTIN; baris lain tidak diubah. */
export const SYNC_FILE_RE = /^src\/api\/([\w-]+)\/([\w-]+)\.js$/

export const exportPairs = (src) => {
    const handlers = new Set([...String(src).matchAll(/export\s+(?:const|async\s+function|function)\s+(\w+)Handler\b/g)].map((m) => m[1]))
    return [...String(src).matchAll(/export\s+const\s+(\w+)Route\s*=/g)].map((m) => m[1]).filter((p) => handlers.has(p))
}

/* present: ['downloader/tiktok.js', ...] (relatif terhadap src/api). read(file) -> daftar prefix pasangan [x] atau null bila gagal dibaca. */
export const syncIndex = async (src, present, read, { canRemove = true } = {}) => {
    const IMP = /^import\s*\{([^}]*)\}\s*from\s*'\.\/([\w-]+\/[\w-]+\.js)'\s*;?\s*(?:\/\/.*)?$/
    const ANY_IMP = /^import\s*\{([^}]*)\}\s*from\s*'[^']+'/
    const ENT = /^\s*\[\s*(\w+)\s*,\s*(\w+)\s*\],?\s*(?:\/\/.*)?$/
    const specsOf = (s) => s.split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const m = x.match(/^(\w+)(?:\s+as\s+(\w+))?$/); return m ? { orig: m[1], local: m[2] || m[1] } : null }).filter(Boolean)
    const bounds = (ls) => {
        const s = ls.findIndex((l) => /const\s+BUILTIN\s*=\s*\[/.test(l)); if (s < 0) return null
        for (let i = s + 1; i < ls.length; i++) if (/^\]/.test(ls[i])) return [s, i]
        return null
    }
    const have = new Set(present), rep = { added: [], removed: [], repaired: [], skipped: [] }
    let lines = src.split('\n')
    if (!bounds(lines)) return { ok: false, message: 'Tidak menemukan "const BUILTIN = [ ... ]" di src/api/index.js.' }
    const inBlock = (fn) => { const [s, e] = bounds(lines); lines = lines.filter((l, i) => !(i > s && i < e) || fn(l)) }

    /* 1) import ke file yang sudah tidak ada (+ entri BUILTIN-nya) */
    const gone = new Set()
    if (canRemove) {
        lines = lines.filter((l) => { const m = l.match(IMP); if (!m || have.has(m[2])) return true; specsOf(m[1]).forEach((s) => gone.add(s.local)); rep.removed.push(m[2]); return false })
        if (gone.size) inBlock((l) => { const e = l.match(ENT); return !(e && (gone.has(e[1]) || gone.has(e[2]))) })
    }

    /* 2) nama yang dikenal index.js: hasil import + deklarasi lokal */
    const used = new Set()
    for (const l of lines) { const m = l.match(ANY_IMP); if (m) specsOf(m[1]).forEach((s) => used.add(s.local)) }
    for (const m of lines.join('\n').matchAll(/(?:^|\n)\s*(?:export\s+)?(?:const|let|var|function|class)\s+(\w+)/g)) used.add(m[1])

    /* 3) entri BUILTIN yang namanya tidak dikenal -> dibuang */
    inBlock((l) => { const e = l.match(ENT); if (!e || (used.has(e[1]) && used.has(e[2]))) return true; rep.repaired.push({ type: 'dangling', name: `${e[1]}, ${e[2]}` }); return false })

    /* 4) import yang masih ada tapi entri BUILTIN-nya hilang */
    const [s0, e0] = bounds(lines)
    const registered = new Set(); for (const l of lines.slice(s0 + 1, e0)) { const e = l.match(ENT); if (e) registered.add(e[1]) }
    const imported = new Set(), newEntries = [], newImports = []
    for (const l of lines) {
        const m = l.match(IMP); if (!m) continue
        imported.add(m[2])
        const sp = specsOf(m[1])
        for (const r of sp.filter((x) => /^\w+Route$/.test(x.orig))) {
            const h = sp.find((x) => x.orig === r.orig.replace(/Route$/, 'Handler'))
            if (h && !registered.has(r.local)) { newEntries.push(`    [${r.local}, ${h.local}],`); registered.add(r.local); rep.repaired.push({ type: 'unregistered', file: m[2], name: r.local }) }
        }
    }

    /* 5) file endpoint yang ada di repo tapi belum diimpor */
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
    const uniq = (n) => { let x = n, i = 2; while (used.has(x)) x = n + i++; used.add(x); return x }
    for (const file of [...present].sort()) {
        if (imported.has(file)) continue
        const pairs = await read(file)
        if (!pairs) { rep.skipped.push({ file, reason: 'Gagal dibaca dari GitHub.' }); continue }
        if (!pairs.length) { rep.skipped.push({ file, reason: 'Bukan endpoint (tidak ada export <nama>Route + <nama>Handler).' }); continue }
        const [cat, slug] = file.replace(/\.js$/, '').split('/'), base = exportNames(cat, slug).route.replace(/Route$/, '')
        const specs = []
        for (const p of pairs) {
            const b = pairs.length > 1 ? base + cap(p) : base, ra = uniq(b + 'Route'), ha = uniq(b + 'Handler')
            specs.push(`${p}Route${p + 'Route' === ra ? '' : ' as ' + ra}`, `${p}Handler${p + 'Handler' === ha ? '' : ' as ' + ha}`)
            newEntries.push(`    [${ra}, ${ha}],`)
        }
        newImports.push(`import { ${specs.join(', ')} } from './${file}'`)
        rep.added.push(file)
    }

    if (!newImports.length && !newEntries.length && !rep.removed.length && !rep.repaired.length) return { ok: true, src, changed: false, ...rep }

    /* 6) tulis: import baru setelah import terakhir, entri baru di akhir BUILTIN */
    if (newImports.length) {
        let last = -1; lines.forEach((l, i) => { if (/^import\s.+from\s.+$/.test(l)) last = i })
        if (last < 0) return { ok: false, message: 'Tidak menemukan baris import di src/api/index.js.' }
        lines.splice(last + 1, 0, ...newImports)
    }
    if (newEntries.length) {
        const [, e] = bounds(lines); let k = e - 1
        while (k >= 0 && !lines[k].trim()) k--
        if (!/[,\[]\s*(\/\/.*)?$/.test(lines[k])) lines[k] = lines[k].replace(/(\s*\/\/.*)?$/, (m) => ',' + (m || ''))
        lines.splice(k + 1, 0, ...newEntries)
    }
    const out = lines.join('\n')
    return { ok: true, src: out, changed: out !== src, ...rep }
}
