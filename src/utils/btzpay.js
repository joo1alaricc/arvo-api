import { store, sameHash } from './session.js'

/* Integrasi BTZPay (Betabotz Paygate) untuk deposit saldo. Dokumentasi: https://web.btzpay.my.id/documentation
 *
 * Secret (wrangler secret put ...), TIDAK pernah dikirim ke browser:
 *   BTZPAY_APIKEY          API key Payment Method (live), dari dashboard BTZPay
 *   BTZPAY_SANDBOX_APIKEY  API key Payment Method khusus uji (opsional), dipakai panel Sandbox di admin
 *   BTZPAY_CALLBACK_TOKEN  token acak buatan sendiri; ditempel di callback_url supaya hanya BTZPay yang bisa memanggil endpoint callback
 * Variabel biasa (opsional): BTZPAY_BASE_URL (default https://web.btzpay.my.id)
 * Pengaturan lain (aktif/nonaktif, metode, timeout, fee, batas nominal) diubah admin di Admin > Pembayaran. */

export const METHODS = ['', 'qrisdana', 'qrisgopay', 'qrisorkut', 'qrisshopeepay']
/* enabled=false secara default: deposit tetap lewat panel lama sampai admin menyalakannya setelah uji di Sandbox. */
export const DEFAULTS = { enabled: false, payment_method: '', timeout_min: 15, fee: 0, min_amount: 1000, max_amount: 5000000, max_pending: 3, return_url: '' }

export const loadCfg = async (c) => ({ ...DEFAULTS, ...((await store(c).btzCfg()) || {}) })
const int = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }

export const cleanCfg = (b, cur) => {
    const o = { ...cur }
    if ('enabled' in b) o.enabled = !!b.enabled
    if ('payment_method' in b) { const m = String(b.payment_method || '').trim().toLowerCase(); if (!METHODS.includes(m)) return { error: 'Metode pembayaran tidak dikenal.' }; o.payment_method = m }
    if ('timeout_min' in b) o.timeout_min = int(b.timeout_min, 1, 60, cur.timeout_min)
    if ('fee' in b) o.fee = int(b.fee, 0, 1000, cur.fee)
    if ('min_amount' in b) o.min_amount = int(b.min_amount, 1, 50000000, cur.min_amount)
    if ('max_amount' in b) o.max_amount = int(b.max_amount, 1, 50000000, cur.max_amount)
    if ('max_pending' in b) o.max_pending = int(b.max_pending, 1, 10, cur.max_pending)
    if ('return_url' in b) {
        const u = String(b.return_url || '').trim()
        if (u) { try { if (new URL(u).protocol !== 'https:') throw 0 } catch { return { error: 'Return URL harus diawali https://' } } }
        o.return_url = u
    }
    if (o.max_amount < o.min_amount) return { error: 'Nominal maksimal tidak boleh lebih kecil dari minimal.' }
    return { cfg: o }
}

export const secretsStatus = (env) => ({ apikey: !!env.BTZPAY_APIKEY, sandbox_apikey: !!env.BTZPAY_SANDBOX_APIKEY, callback_token: !!env.BTZPAY_CALLBACK_TOKEN })
export const base = (env) => { const b = String(env.BTZPAY_BASE_URL || 'https://web.btzpay.my.id').replace(/\/+$/, ''); return /^https:\/\//.test(b) ? b : 'https://web.btzpay.my.id' }

const call = async (env, path, { method = 'GET', json } = {}) => {
    let r
    try {
        r = await fetch(base(env) + path, { method, headers: json ? { 'Content-Type': 'application/json' } : undefined, body: json ? JSON.stringify(json) : undefined, signal: AbortSignal.timeout(15000) })
    } catch (e) { return { ok: false, status: 504, error: 'btzpay_unreachable', message: e.name === 'TimeoutError' ? 'BTZPay tidak merespons (timeout).' : 'Tidak bisa menghubungi BTZPay.' } }
    const j = await r.json().catch(() => null)
    if (!j || typeof j !== 'object') return { ok: false, status: 502, error: 'btzpay_bad_response', message: `Respons BTZPay tidak valid (HTTP ${r.status}).` }
    if (j.success === false || !r.ok) {
        const det = Array.isArray(j.errors) ? ' ' + j.errors.map((e) => `${e.field}: ${e.message}`).join('; ') : ''
        return { ok: false, status: r.status === 429 ? 429 : r.status >= 500 ? 502 : 400, error: 'btzpay_error', message: (String(j.message || `HTTP ${r.status}`) + det).slice(0, 300), raw: j }
    }
    return { ok: true, data: j.data ?? null, raw: j }
}

/* p: amount, fee, paymentMethod, timeout(ms), callback_url, return_url, notes, metadata, customerInfo */
export const btzCreate = (env, apikey, p) => {
    const body = { apikey, amount: p.amount, timeout: p.timeout, notes: p.notes, metadata: p.metadata }
    if (p.fee > 0) body.fee = p.fee
    if (p.paymentMethod) body.paymentMethod = p.paymentMethod
    if (p.callback_url) body.callback_url = p.callback_url
    if (p.return_url) body.return_url = p.return_url
    if (p.customerInfo) body.customerInfo = p.customerInfo
    return call(env, '/api/qris/create', { method: 'POST', json: body })
}
export const btzStatus = (env, id, key) => call(env, `/api/qris/transaction/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`)
export const btzCancel = (env, apikey, id, reason = 'cancelled_by_user') => call(env, `/api/qris/cancel/${encodeURIComponent(id)}`, { method: 'POST', json: { apikey, reason } })
/* Hanya untuk Sandbox: meniru notifikasi dari aplikasi listener supaya transaksi uji menjadi "sukses". */
export const btzSimulate = (env, apikey, total) => call(env, '/api/qris/callback', { method: 'POST', json: { action: 'update', app: 'com.dana.id', notification: `Kamu menerima Rp${total} dari Sandbox Arvo`, amount: total, appVersionCode: 123, apikey } })

const isImg = (s) => typeof s === 'string' && (/^data:image\//.test(s) || /^https:\/\//.test(s))
/* Gambar QR untuk <img>: dibuat dari qrisString lewat endpoint create-qr-code BTZPay supaya tampilannya sama dengan halaman bayar BTZPay
 * (titik bulat, warna navy). qrisImage bawaan transaksi hanya dipakai kalau qrisString tidak ada. */
export const QR_STYLE = { style: 1, color: '0f1056' }
export const qrUrl = (env, d) => {
    if (!d) return null
    if (d.qrisString) return `${base(env)}/api/qris/create-qr-code?size=500x500&style=${QR_STYLE.style}&color=${QR_STYLE.color}&format=svg&viewer=0&data=${encodeURIComponent(d.qrisString)}`
    if (isImg(d.qrisImage)) return d.qrisImage
    if (d.qrisImage && /^[A-Za-z0-9+/=\s]+$/.test(d.qrisImage) && d.qrisImage.length > 200) return 'data:image/png;base64,' + d.qrisImage.replace(/\s+/g, '')
    return null
}
/* Gambar QR dari qrisString lewat generator BTZPay, diambil SERVER-SIDE lalu diteruskan ke browser dari domain Arvo sendiri
 * (browser tidak perlu memuat gambar dari domain lain). Coba mode styled dulu, lalu native. */
export const btzQr = async (env, data) => {
    for (const mode of ['styled', 'native']) {
        try {
            const r = await fetch(base(env) + '/api/qris/create-qr-code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data, size: '500x500', style: String(QR_STYLE.style), color: QR_STYLE.color, format: 'png', pngMode: mode, viewer: '0' }), signal: AbortSignal.timeout(15000) })
            const type = r.headers.get('content-type') || ''
            if (r.ok && /^image\//.test(type)) return { body: await r.arrayBuffer(), type }
            console.error('[btzpay] qr', mode, r.status, type)
        } catch (e) { console.error('[btzpay] qr', mode, e.message || e) }
    }
    return null
}
export const httpsOnly = (u) => { try { return new URL(u).protocol === 'https:' ? String(u) : null } catch { return null } }
export const tokenOk = (env, given) => !!env.BTZPAY_CALLBACK_TOKEN && sameHash(String(given || ''), String(env.BTZPAY_CALLBACK_TOKEN))

const OK = /^(sukses|success|paid)$/i, DEAD = /^(gagal|expired|cancel|canceled|cancelled|failed)$/i

/* Cocokkan satu deposit BTZPay: status SELALU diambil ulang dari BTZPay (isi callback tidak dipercaya), saldo dikredit sekali. */
export const settleBtzDeposit = async (c, d) => {
    const st = store(c)
    if (d.credited) return { status: 'success', amount: d.amount, bonus: 0, balance: await st.smmBal(d.user_id) }
    if (!d.access_key) return { err: { status: 500, error: 'no_access_key', message: 'Deposit tidak punya access key BTZPay.' } }
    const r = await btzStatus(c.env, d.id, d.access_key)
    if (!r.ok) return { err: r }
    const t = r.data || {}, s = String(t.status || 'pending')
    if (OK.test(s)) {
        /* nominal harus cocok dengan yang kita buat; kalau tidak, jangan dikredit, tandai untuk diperiksa admin */
        if (Number(t.amount) !== d.amount && Number(t.totalAmount) !== d.total) {
            console.error('[btzpay] nominal tidak cocok', d.id, t.amount, t.totalAmount, d.amount, d.total)
            await st.smmDepStatus(d.id, 'review')
            return { status: 'review', amount: d.amount, bonus: 0, balance: await st.smmBal(d.user_id) }
        }
        const k = await st.smmDepCredit(d.id, d.amount)
        return { status: 'success', amount: d.amount, bonus: 0, credited: k.credited, balance: k.balance }
    }
    if (DEAD.test(s)) { await st.smmDepStatus(d.id, /cancel/i.test(s) ? 'canceled' : 'expired'); return { status: 'expired', amount: d.amount, bonus: 0, balance: await st.smmBal(d.user_id) } }
    return { status: 'pending', amount: d.amount, bonus: 0, balance: await st.smmBal(d.user_id) }
}
