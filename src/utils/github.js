/* Klien GitHub tipis (REST). Token dari env GITHUB_API (diisi di dashboard Cloudflare), repo dari var GITHUB_REPO ("owner/repo"), branch dari GITHUB_BRANCH. */
const API = 'https://api.github.com'
const fail = (status, error, message) => ({ ok: false, status, error, message })

export const ghCfg = (env) => ({ token: env.GITHUB_API || '', repo: env.GITHUB_REPO || '', branch: env.GITHUB_BRANCH || 'main' })
export const ghReady = (env) => { const c = ghCfg(env); return !!(c.token && /^[\w.-]+\/[\w.-]+$/.test(c.repo)) }
const notReady = () => fail(503, 'github_off', 'GitHub belum dikonfigurasi. Isi GITHUB_REPO di wrangler.toml dan tambahkan GITHUB_API di dashboard Cloudflare (Settings > Variables and Secrets)')

const call = async (env, path, init = {}) => {
    const { token } = ghCfg(env)
    const res = await fetch(API + path, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'arvo-admin', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
        signal: AbortSignal.timeout(25000),
    })
    const data = await res.json().catch(() => ({}))
    return { res, data }
}
const errOf = (res, data) => fail(res.status === 404 ? 404 : res.status === 401 || res.status === 403 ? 502 : res.status >= 500 ? 502 : res.status,
    'github_error', `GitHub ${res.status}: ${data.message || 'gagal'}${res.status === 401 ? ' (token GITHUB_API salah/kedaluwarsa)' : ''}${res.status === 403 ? ' (token butuh izin Contents: Read & write, atau kena rate limit)' : ''}`)

/* Path aman: relatif, tanpa .., tanpa .git/ dan node_modules/ */
export const safePath = (p) => {
    p = String(p || '').replace(/\\/g, '/').replace(/^\/+/, '')
    if (!p || p.length > 300 || p.split('/').some((s) => s === '..' || s === '.' || s === '') || /(^|\/)(\.git|node_modules)(\/|$)/.test(p)) return null
    return p
}
const enc = (p) => p.split('/').map(encodeURIComponent).join('/')

export const ghStatus = async (env) => {
    const c = ghCfg(env)
    if (!ghReady(env)) return { ok: true, configured: false, repo: c.repo || null, branch: c.branch, has_token: !!c.token }
    const { res, data } = await call(env, `/repos/${c.repo}`)
    if (!res.ok) return { ok: true, configured: true, reachable: false, repo: c.repo, branch: c.branch, message: errOf(res, data).message }
    return { ok: true, configured: true, reachable: true, repo: c.repo, branch: c.branch, can_push: !!data.permissions?.push, private: !!data.private }
}

/* Semua file di branch: { path: { sha, size } } */
export const ghTree = async (env) => {
    if (!ghReady(env)) return notReady()
    const c = ghCfg(env)
    const { res, data } = await call(env, `/repos/${c.repo}/git/trees/${encodeURIComponent(c.branch)}?recursive=1`)
    if (!res.ok) return errOf(res, data)
    return { ok: true, truncated: !!data.truncated, files: Object.fromEntries((data.tree || []).filter((t) => t.type === 'blob').map((t) => [t.path, { sha: t.sha, size: t.size || 0 }])) }
}

export const ghGet = async (env, path) => {
    if (!ghReady(env)) return notReady()
    const c = ghCfg(env)
    const { res, data } = await call(env, `/repos/${c.repo}/contents/${enc(path)}?ref=${encodeURIComponent(c.branch)}`)
    if (res.status === 404) return { ok: true, exists: false }
    if (!res.ok) return errOf(res, data)
    if (Array.isArray(data)) return fail(400, 'is_dir', 'Itu folder, bukan file.')
    let content = String(data.content || '').replace(/\n/g, '')
    if (!content && data.sha) { // file > 1 MB: ambil lewat blob API
        const b = await call(env, `/repos/${c.repo}/git/blobs/${data.sha}`)
        if (b.res.ok) content = String(b.data.content || '').replace(/\n/g, '')
    }
    return { ok: true, exists: true, sha: data.sha, content }
}

export const ghPut = async (env, path, b64, message, tries = 2) => {
    if (!ghReady(env)) return notReady()
    const c = ghCfg(env), cur = await ghGet(env, path)
    if (cur.ok === false) return cur
    const body = { message: String(message || `Update ${path}`).slice(0, 200), content: b64, branch: c.branch }
    if (cur.exists) { if (cur.content === b64) return { ok: true, path, unchanged: true }; body.sha = cur.sha }
    const { res, data } = await call(env, `/repos/${c.repo}/contents/${enc(path)}`, { method: 'PUT', body: JSON.stringify(body) })
    if (res.status === 409 && tries > 1) { await new Promise((r) => setTimeout(r, 700)); return ghPut(env, path, b64, message, tries - 1) }
    if (!res.ok) return errOf(res, data)
    return { ok: true, path, created: !cur.exists, commit: data.commit?.sha?.slice(0, 7) }
}

export const ghDelete = async (env, path, message) => {
    if (!ghReady(env)) return notReady()
    const c = ghCfg(env), cur = await ghGet(env, path)
    if (cur.ok === false) return cur
    if (!cur.exists) return { ok: true, path, missing: true }
    const { res, data } = await call(env, `/repos/${c.repo}/contents/${enc(path)}`, { method: 'DELETE', body: JSON.stringify({ message: String(message || `Delete ${path}`).slice(0, 200), sha: cur.sha, branch: c.branch }) })
    if (!res.ok) return errOf(res, data)
    return { ok: true, path, commit: data.commit?.sha?.slice(0, 7) }
}

/* Status deploy terakhir (GitHub Actions). Opsional: butuh izin Actions: Read. */
export const ghRuns = async (env) => {
    if (!ghReady(env)) return notReady()
    const c = ghCfg(env)
    const { res, data } = await call(env, `/repos/${c.repo}/actions/runs?branch=${encodeURIComponent(c.branch)}&per_page=5`)
    if (!res.ok) return { ok: true, runs: [], note: 'Status Actions tidak bisa dibaca (token tanpa izin Actions: Read, atau repo tanpa workflow).' }
    return { ok: true, runs: (data.workflow_runs || []).map((r) => ({ id: r.id, name: r.name, status: r.status, conclusion: r.conclusion, title: r.display_title, url: r.html_url, at: r.created_at })) }
}

export const b64ToText = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)))
export const textToB64 = (s) => { const u = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(bin) }
