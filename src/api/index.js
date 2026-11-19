import { statsRoute, statsHandler } from './stats/routes.js'
import { premiumPingRoute, premiumPingHandler } from './premium/routes.js'
import {tiktokRoute, tiktokHandler} from './downloader/tiktok.js'

import { register } from '../utils/route.js'
import { OpenAPIHono, z } from '@hono/zod-openapi'
import { exampleOf, examplesFromDoc } from '../utils/zodExample.js'
import { instagramRoute as downloaderInstagramRoute, instagramHandler as downloaderInstagramHandler } from './downloader/instagram.js'
import { ytmp3Route as downloaderYtmp3Route, ytmp3Handler as downloaderYtmp3Handler } from './downloader/ytmp3.js'
import { ytmp4Route as downloaderYtmp4Route, ytmp4Handler as downloaderYtmp4Handler } from './downloader/ytmp4.js'
import { aioRoute as downloaderAioRoute, aioHandler as downloaderAioHandler } from './downloader/aio.js'
import { appleMusicRoute as downloaderApplemusicRoute, appleMusicHandler as downloaderApplemusicHandler } from './downloader/applemusic.js'
import { capcutRoute as downloaderCapcutRoute, capcutHandler as downloaderCapcutHandler } from './downloader/capcut.js'
import { facebookRoute as downloaderFacebookRoute, facebookHandler as downloaderFacebookHandler } from './downloader/facebook.js'
import { githubRoute as downloaderGithubRoute, githubHandler as downloaderGithubHandler } from './downloader/github.js'
import { gdriveRoute as downloaderGdriveRoute, gdriveHandler as downloaderGdriveHandler } from './downloader/gdrive.js'
import { mediafireRoute as downloaderMediafireRoute, mediafireHandler as downloaderMediafireHandler } from './downloader/mediafire.js'
import { pinterestRoute as downloaderPinterestRoute, pinterestHandler as downloaderPinterestHandler } from './downloader/pinterest.js'
import { spotifyRoute as downloaderSpotifyRoute, spotifyHandler as downloaderSpotifyHandler } from './downloader/spotify.js'
import { twitterRoute as downloaderTwitterRoute, twitterHandler as downloaderTwitterHandler } from './downloader/twitter.js'
import { claudeRoute as aiClaudeRoute, claudeHandler as aiClaudeHandler } from './ai/claude.js'
import { copilotRoute as aiCopilotRoute, copilotHandler as aiCopilotHandler } from './ai/copilot.js'

/* Tambah endpoint bawaan baru cukup di sini: otomatis terdaftar, masuk /docs, dan tampil di dashboard admin. */
const BUILTIN = [
    [statsRoute, statsHandler],
    [premiumPingRoute, premiumPingHandler],
    [tiktokRoute, tiktokHandler],
    [downloaderInstagramRoute, downloaderInstagramHandler],
    [downloaderYtmp3Route, downloaderYtmp3Handler],
    [downloaderYtmp4Route, downloaderYtmp4Handler],
    [downloaderAioRoute, downloaderAioHandler],
    [downloaderApplemusicRoute, downloaderApplemusicHandler],
    [downloaderCapcutRoute, downloaderCapcutHandler],
    [downloaderFacebookRoute, downloaderFacebookHandler],
    [downloaderGithubRoute, downloaderGithubHandler],
    [downloaderGdriveRoute, downloaderGdriveHandler],
    [downloaderMediafireRoute, downloaderMediafireHandler],
    [downloaderPinterestRoute, downloaderPinterestHandler],
    [downloaderSpotifyRoute, downloaderSpotifyHandler],
    [downloaderTwitterRoute, downloaderTwitterHandler],
    [aiClaudeRoute, aiClaudeHandler],
    [aiCopilotRoute, aiCopilotHandler],
]

export const BUILTIN_PATHS = BUILTIN.map(([r]) => r.path)

export const setupRoutes = (app) => {
    for (const [route, handler] of BUILTIN) register(app, route, handler)
}

/* Example dari generator OpenAPI resmi (cadangan). Dokumen dibuat sekali per isolate dari semua route bawaan; kalau pembacaan langsung
 * dari skema zod tidak menemukan example (mis. metadata hilang karena field dibungkus), nilainya diambil dari sini. Gagal = peta kosong. */
let docExamples = null
const specExamples = () => {
    if (docExamples) return docExamples
    docExamples = {}
    try {
        const tmp = new OpenAPIHono()
        for (const [route] of BUILTIN) { try { tmp.openapi(route, () => {}) } catch (e) { console.error('[Example] route dilewati:', route.path, e?.message || e) } }
        const info = { title: 'arvo', version: '1' }
        let doc
        try { doc = tmp.getOpenAPI31Document({ openapi: '3.1.0', info }) } catch { doc = tmp.getOpenAPIDocument({ openapi: '3.0.0', info }) }
        docExamples = examplesFromDoc(doc)
    } catch (e) { console.error('[Example] gagal membangun dokumen OpenAPI:', e?.message || e) }
    return docExamples
}

/* Daftar input (query/body) dibaca dari skema zod pada createRoute, supaya Playground menampilkan kolom inputnya dengan contoh nilainya
 * (mis. "halo apa kabar", bukan teks "string"). Aman: gagal baca = tanpa input / tanpa contoh. */
const fieldsOf = (schema, where, path) => {
    try {
        const shape = schema && schema.shape
        if (!shape) return []
        return Object.entries(shape).map(([name, f]) => {
            let example = exampleOf(f, z.toJSONSchema)
            if (example === undefined || example === null || example === '') example = specExamples()[`${path}|${where}|${name}`] ?? ''
            let required = true
            try { required = !f.safeParse(undefined).success } catch {}
            return { name, in: where, required, example: String(example ?? '') }
        })
    } catch { return [] }
}
const inputsOf = (r) => [...fieldsOf(r.request && r.request.query, 'query', r.path), ...fieldsOf(r.request?.body?.content?.['application/json']?.schema, 'body', r.path)]

/* Ringkasan endpoint bawaan untuk dashboard admin (/api/admin/builtin). */
export const builtinInfo = () => BUILTIN.map(([r]) => ({
    path: r.path,
    method: String(r.method).toUpperCase(),
    name: r.summary || r.path.replace(/^\/api\//, ''),
    category: (r.tags && r.tags[0]) || 'bawaan',
    description: r.description || '',
    access: r['x-access'] || (r['x-premium'] ? 'premium' : 'free'),
    status: r['x-status'] === 'OFFLINE' ? 'offline' : 'online',
    inputs: inputsOf(r),
    builtin: true,
}))
