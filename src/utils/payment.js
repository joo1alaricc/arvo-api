import { convertQRIS, decodeQRImage, toDataURL } from 'qris-swap'

let imagePayload

/* ---- cek payload QRIS (EMV QR): TLV + CRC16-CCITT ---- */
const crc16 = (s) => {
    let crc = 0xffff
    for (let i = 0; i < s.length; i++) { crc ^= s.charCodeAt(i) << 8; for (let k = 0; k < 8; k++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff }
    return crc.toString(16).toUpperCase().padStart(4, '0')
}
const tlv = (s) => { const o = {}; for (let i = 0; i + 4 <= s.length;) { const t = s.slice(i, i + 2), n = parseInt(s.slice(i + 2, i + 4), 10); if (Number.isNaN(n)) break; o[t] = s.slice(i + 4, i + 4 + n); i += 4 + n } return o }
export const qrisInfo = (payload) => {
    const p = String(payload || '').trim()
    if (!/^000201/.test(p) || p.length < 40) return { valid: false, message: 'Bukan payload QRIS (harus diawali 000201).' }
    const t = tlv(p), crcOk = p.slice(-4).toUpperCase() === crc16(p.slice(0, -4))
    if (!crcOk) return { valid: false, message: 'CRC payload tidak cocok. Teks QR kemungkinan terpotong/salah.' }
    return { valid: true, is_static: t['01'] === '11', merchant: t['59'] || null, city: t['60'] || null }
}

/* Sumber QRIS statis, urutan: secret QRIS_STATIC -> payload tersimpan dari dashboard -> decode gambar QRIS_IMAGE_URL. */
const getStatic = async (env, saved) => {
    if (env.QRIS_STATIC) return env.QRIS_STATIC
    if (saved) return saved
    if (imagePayload) return imagePayload
    if (!env.QRIS_IMAGE_URL) throw new Error('QRIS belum diatur. Buka Admin > Pembayaran, unggah gambar QRIS.')
    const res = await fetch(env.QRIS_IMAGE_URL)
    if (!res.ok) throw new Error(`Gagal mengambil gambar QRIS (${res.status})`)
    try { imagePayload = decodeQRImage(new Uint8Array(await res.arrayBuffer())) }
    catch (e) { throw new Error('Gambar QRIS tidak bisa dibaca di server (format JPEG/ukuran). Buka Admin > Pembayaran dan unggah ulang gambarnya, nanti dibaca di browser.') }
    return imagePayload
}

/* Static -> dynamic QRIS dengan nominal unik per order (qris-swap). */
export const makeQris = async (env, total, saved) => {
    const payload = await getStatic(env, saved)
    const info = qrisInfo(payload)
    if (!info.valid) throw new Error('Payload QRIS tidak valid: ' + info.message)
    const r = convertQRIS(payload, { amount: total, render: { scale: 8, border: 4, dataUrl: true } })
    return { payload: r.qris, image: r.image?.dataUrl || toDataURL(r.image.png), merchant: r.merchantName }
}
