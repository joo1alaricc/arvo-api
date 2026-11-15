/* Override endpoint bawaan dari dashboard admin (nama, deskripsi, akses, status). Di-cache singkat per isolate. */
let cache = { at: 0, map: {} }
export const refreshOverrides = () => { cache.at = 0 }
export const getOverrides = async (c) => {
    if (!c.env.STORE) return {}
    if (Date.now() - cache.at > 10000) {
        try { cache = { at: Date.now(), map: (await c.env.STORE.get(c.env.STORE.idFromName('main')).builtinOverrides()).map } }
        catch (e) { console.error('[Override]', e); cache.at = Date.now() }
    }
    return cache.map
}
/* Nilai efektif sebuah route bawaan: kode asli ditimpa override admin bila ada. */
export const effective = async (c, route) => {
    const o = (await getOverrides(c))[route.path] || {}
    return {
        access: o.access || route['x-access'] || (route['x-premium'] ? 'premium' : 'free'),
        status: o.status ? o.status : route['x-status'] === 'OFFLINE' ? 'offline' : 'online',
        name: o.name || route.path.replace(/^\/api\//, ''), description: o.description ?? route.description ?? '',
    }
}
