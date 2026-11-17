import { statsRoute, statsHandler } from './stats/routes.js'
import { premiumPingRoute, premiumPingHandler } from './premium/routes.js'
import {tiktokRoute, tiktokHandler} from './downloader/tiktok.js'

import { register } from '../utils/route.js'
import { instagramRoute as downloaderInstagramRoute, instagramHandler as downloaderInstagramHandler } from './downloader/instagram.js'
import { ytmp3Route as downloaderYtmp3Route, ytmp3Handler as downloaderYtmp3Handler } from './downloader/ytmp3.js'
import { ytmp4Route as downloaderYtmp4Route, ytmp4Handler as downloaderYtmp4Handler } from './downloader/ytmp4.js'
import { aioRoute as downloaderAioRoute, aioHandler as downloaderAioHandler } from './downloader/aio.js'
import { appleMusicRoute as downloaderApplemusicRoute, appleMusicHandler as downloaderApplemusicHandler } from './downloader/applemusic.js'
import { capcutRoute as downloaderCapcutRoute, capcutHandler as downloaderCapcutHandler } from './downloader/capcut.js'
import { facebookRoute as downloaderFacebookRoute, facebookHandler as downloaderFacebookHandler } from './downloader/facebook.js'
import { githubRoute as downloaderGithubRoute, githubHandler as downloaderGithubHandler } from './downloader/github.js'

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
]

export const BUILTIN_PATHS = BUILTIN.map(([r]) => r.path)

export const setupRoutes = (app) => {
    for (const [route, handler] of BUILTIN) register(app, route, handler)
}

/* Daftar input (query/body) dibaca dari skema zod pada createRoute, supaya Playground menampilkan kolom inputnya. Aman: gagal baca = tanpa input. */
const fieldsOf = (schema, where) => {
    try {
        const shape = schema && schema.shape
        if (!shape) return []
        return Object.entries(shape).map(([name, f]) => {
            let example = ''
            try { const m = (typeof f.meta === 'function' && f.meta()) || {}; example = m.example ?? m.openapi?.example ?? '' } catch {}
            let required = true
            try { required = !f.safeParse(undefined).success } catch {}
            return { name, in: where, required, example: String(example ?? '') }
        })
    } catch { return [] }
}
const inputsOf = (r) => [...fieldsOf(r.request && r.request.query, 'query'), ...fieldsOf(r.request?.body?.content?.['application/json']?.schema, 'body')]

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
