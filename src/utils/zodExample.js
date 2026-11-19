/* Membaca nilai `example` dari field zod (hasil .openapi({ example }) / .meta({ example })).
 *
 * Kenapa perlu pembaca khusus: di zod v4 metadata disimpan di registry, bukan di field-nya, dan field yang dibungkus
 * (.optional(), .nullable(), .default(), .refine(), dst.) TIDAK mewarisi metadata field di dalamnya. Pembaca lama hanya
 * melihat lapisan terluar, jadi example hilang dan Playground jatuh ke teks "string".
 * Di sini kita telusuri semua lapisan pembungkus, lalu coba beberapa lokasi penyimpanan metadata. */

const empty = (v) => v === undefined || v === null || v === ''

/* Ambil example dari satu objek metadata (beberapa bentuk yang pernah dipakai zod / zod-to-openapi). */
const fromMeta = (m) => {
    if (!m || typeof m !== 'object') return undefined
    const list = [m.example, Array.isArray(m.examples) ? m.examples[0] : undefined, m.openapi?.example, m._internal?.example]
    return list.find((v) => !empty(v))
}

const safe = (fn) => { try { return fn() } catch { return undefined } }

/* Satu lapisan: cek .meta(), .description-style bag, def. */
const fromLayer = (f) => {
    if (!f || typeof f !== 'object') return undefined
    return fromMeta(safe(() => (typeof f.meta === 'function' ? f.meta() : undefined)))
        ?? fromMeta(safe(() => f._zod?.bag))
        ?? fromMeta(safe(() => f._zod?.def))
        ?? fromMeta(safe(() => f.def))
        ?? fromMeta(safe(() => f._def))
}

/* Lapisan di dalam pembungkus (optional/nullable/default/catch/readonly/pipe/effects/lazy). */
const inner = (f) => safe(() => {
    const d = f._zod?.def || f.def || f._def || {}
    return (typeof f.unwrap === 'function' ? f.unwrap() : undefined) || d.innerType || d.schema || d.in || d.type
}) || undefined

export const exampleOf = (field, toJSONSchema) => {
    let node = field
    for (let i = 0; node && typeof node === 'object' && i < 8; i++) {
        const v = fromLayer(node)
        if (!empty(v)) return v
        const next = inner(node)
        if (!next || next === node || typeof next !== 'object') break
        node = next
    }
    /* cadangan: zod v4 menulis example ke JSON Schema lewat toJSONSchema */
    if (typeof toJSONSchema === 'function') {
        const js = safe(() => toJSONSchema(field, { unrepresentable: 'any', io: 'input', target: 'draft-2020-12' }))
        const v = js && (empty(js.example) ? (Array.isArray(js.examples) ? js.examples[0] : undefined) : js.example)
        if (!empty(v)) return v
    }
    return undefined
}

/* Example dari dokumen OpenAPI hasil generator resmi: parameter query + properti body. */
export const examplesFromDoc = (doc) => {
    const out = {}
    const val = (o) => (o && [o.example, Array.isArray(o.examples) ? o.examples[0] : undefined, o.schema?.example, Array.isArray(o.schema?.examples) ? o.schema.examples[0] : undefined].find((v) => !empty(v)))
    for (const [path, ms] of Object.entries(doc?.paths || {})) {
        for (const op of Object.values(ms || {})) {
            if (!op || typeof op !== 'object') continue
            for (const p of op.parameters || []) { const v = val(p); if (!empty(v)) out[`${path}|${p.in}|${p.name}`] = String(v) }
            const props = op.requestBody?.content?.['application/json']?.schema?.properties || {}
            for (const [name, s] of Object.entries(props)) { const v = val({ schema: s, example: s?.example }); if (!empty(v)) out[`${path}|body|${name}`] = String(v) }
        }
    }
    return out
}
