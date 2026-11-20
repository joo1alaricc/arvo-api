import { meter } from '../utils/rateLimit.js'
import { store } from '../utils/session.js'

/* Endpoint buatan admin. Workers melarang eval/new Function, jadi "kode" berupa konfigurasi:
 *  - proxy: URL https:// upstream dengan placeholder {nama_input}; headers (JSON) boleh pakai placeholder juga
 *  - json : template JSON; "{nama}" diganti nilai input; juga tersedia {ip} dan {now} */
const fill = (str, vals, enc = (v) => v) => String(str).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, k) => (k in vals ? enc(vals[k]) : m))
const deep = (node, vals) => {
    if (typeof node === 'string') { const only = node.match(/^\{([A-Za-z_]\w*)\}$/); return only && only[1] in vals ? vals[only[1]] : fill(node, vals) }
    if (Array.isArray(node)) return node.map((n) => deep(n, vals))
    if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, deep(v, vals)]))
    return node
}
const err = (c, status, error, message) => c.json({ error, message, status }, status)

export const dynamicHandler = (builtin) => async (c) => {
    const [, , category, slug, extra] = c.req.path.split('/')
    if (!category || !slug || extra !== undefined || ['billing', 'auth', 'admin'].includes(category)) return err(c, 404, 'Not Found', 'The requested API endpoint does not exist.')
    const r = await store(c).findEndpoint(category, slug)
    if (r.ok === false) return err(c, 404, 'Not Found', 'The requested API endpoint does not exist.')
    const ep = r.endpoint
    /* endpoint berbayar: cek akses dulu (404 bila tidak berhak), baru method/status, supaya tidak bocor keberadaannya */
    const gate = async () => {
        if (ep.method !== c.req.method && !(ep.method === 'GET' && c.req.method === 'HEAD')) return err(c, 405, 'Method Not Allowed', `Gunakan method ${ep.method}.`)
        if (ep.status === 'offline') return err(c, 503, 'Service Unavailable', 'This endpoint is currently OFFLINE.')
        return null
    }
    if (ep.access !== 'free') {
        const denied = await meter(c, { path: ep.path, access: ep.access }); if (denied) return denied
        const bad = await gate(); if (bad) return bad
    } else {
        const bad = await gate(); if (bad) return bad
        const denied = await meter(c, { path: ep.path, access: ep.access }); if (denied) return denied
    }

    const body = ep.method === 'POST' ? await c.req.json().catch(() => ({})) : {}
    const vals = { ip: c.get('ip'), now: String(Date.now()) }, missing = []
    for (const i of ep.inputs) {
        const v = i.in === 'body' ? body[i.name] : c.req.query(i.name)
        if (v === undefined || v === null || v === '') { if (i.required) missing.push(i.name); continue }
        vals[i.name] = String(v).slice(0, 2000)
    }
    if (missing.length) return err(c, 400, 'Bad Request', `Parameter wajib: ${missing.join(', ')}`)

    if (ep.mode === 'json') {
        let tpl
        try { tpl = JSON.parse(ep.code) } catch { return err(c, 500, 'Internal Server Error', 'Template JSON endpoint ini rusak. Hubungi admin.') }
        return c.json(deep(tpl, vals))
    }

    try {
        const headers = Object.fromEntries(Object.entries(ep.headers).map(([k, v]) => [k, fill(v, vals)]))
        const init = { method: ep.method, headers, signal: AbortSignal.timeout(15000) }
        if (ep.method === 'POST') {
            headers['Content-Type'] ||= 'application/json'
            init.body = JSON.stringify(Object.fromEntries(ep.inputs.filter((i) => i.in === 'body' && i.name in vals).map((i) => [i.name, vals[i.name]])))
        }
        const up = await fetch(fill(ep.code, vals, encodeURIComponent), init)
        const out = new Headers({ 'Content-Type': up.headers.get('content-type') || 'application/octet-stream' })
        return new Response(up.body, { status: up.status >= 500 ? 502 : up.status, headers: out })
    } catch (e) {
        return err(c, 502, 'Bad Gateway', e.name === 'TimeoutError' ? 'Upstream timeout.' : 'Upstream tidak bisa dihubungi.')
    }
}

/* Gabungkan endpoint dinamis ke dokumen OpenAPI (dipakai Playground). */
export const mergeSpec = (doc, endpoints, isOwner) => {
    for (const e of endpoints) {
        if (e.access === 'owner' && !isOwner) continue
        const q = e.inputs.filter((i) => i.in === 'query'), b = e.inputs.filter((i) => i.in === 'body')
        const op = {
            tags: [e.category], summary: e.name, description: e.description || undefined,
            'x-status': e.status === 'offline' ? 'OFFLINE' : 'ONLINE', 'x-access': e.access, 'x-premium': e.access !== 'free',
            parameters: q.map((i) => ({ name: i.name, in: 'query', required: i.required, example: i.example || undefined, schema: { type: 'string', ...(i.example ? { example: i.example } : {}) } })),
            responses: { 200: { description: 'OK' } },
        }
        if (b.length) op.requestBody = { content: { 'application/json': { schema: { type: 'object', properties: Object.fromEntries(b.map((i) => [i.name, { type: 'string', example: i.example || undefined }])), required: b.filter((i) => i.required).map((i) => i.name) } } } }
        ;(doc.paths[e.path] ||= {})[e.method.toLowerCase()] = op
    }
    return doc
}
