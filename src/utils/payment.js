import { convertQRIS, decodeQRImage, toDataURL } from 'qris-swap'

let staticPayload

/* QRIS statis: dari secret QRIS_STATIC, atau di-decode sekali dari gambar QRIS_IMAGE_URL. */
const getStatic = async (env) => {
    if (env.QRIS_STATIC) return env.QRIS_STATIC
    if (staticPayload) return staticPayload
    const res = await fetch(env.QRIS_IMAGE_URL)
    if (!res.ok) throw new Error(`Gagal mengambil gambar QRIS (${res.status})`)
    staticPayload = decodeQRImage(new Uint8Array(await res.arrayBuffer()))
    return staticPayload
}

/* Static -> dynamic QRIS dengan nominal unik per order (qris-swap). */
export const makeQris = async (env, total) => {
    const r = convertQRIS(await getStatic(env), { amount: total, render: { scale: 8, border: 4, dataUrl: true } })
    return { payload: r.qris, image: r.image?.dataUrl || toDataURL(r.image.png), merchant: r.merchantName }
}
