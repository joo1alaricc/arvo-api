import { store } from './session.js'

/* Layanan yang bisa dinyalakan/dimatikan admin: smm, otp, am. Default semua aktif.
 * Dicache singkat per isolate supaya halaman /smm, /otp, /am tidak memanggil Durable Object tiap request. */
const ALL_ON = { smm: true, otp: true, am: true }
let cache = { at: 0, v: null }
export const services = async (c) => {
    if (cache.v && Date.now() - cache.at < 5000) return cache.v
    try { cache = { at: Date.now(), v: await store(c).servicesCfg() } } catch (e) { console.error('[services]', e); return cache.v || ALL_ON }
    return cache.v
}
export const refreshServices = () => { cache.at = 0 }

/* Skala tampilan situs (publik, dicache singkat). */
let uiCache = { at: 0, v: null }
export const uiCfg = async (c) => {
    if (uiCache.v && Date.now() - uiCache.at < 5000) return uiCache.v
    try { uiCache = { at: Date.now(), v: await store(c).uiCfg() } } catch (e) { console.error('[ui]', e); return uiCache.v || { scale: 100, scale_mobile: 100 } }
    return uiCache.v
}
export const refreshUi = () => { uiCache.at = 0 }
