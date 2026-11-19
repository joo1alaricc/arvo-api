import { Hono } from 'hono'
import { MIN_DAYS, MAX_DAYS } from '../utils/plans.js'
import { peekQuota } from '../utils/rateLimit.js'
import { makeQris } from '../utils/payment.js'
import { store, send, requireUser, currentUser } from '../utils/session.js'
import { tokenOk, settleBtzDeposit } from '../utils/btzpay.js'

export const billing = new Hono()
const body = (c) => c.req.json().catch(() => ({}))
const attachQris = async (c, o) => {
    if (o.ok === false || o.status !== 'pending') return o
    try { return { ...o, qris: await makeQris(c.env, o.total, await store(c).getQrisStatic()) } }
    catch (e) {
        console.error('[QRIS]', e)
        /* admin/owner melihat penyebab aslinya; user biasa pesan umum */
        return { ok: false, status: 503, error: 'qris_unavailable', message: c.get('isOwner') ? `QRIS gagal dibuat: ${e.message}` : 'QRIS belum bisa dibuat. Hubungi admin.' }
    }
}

billing.get('/plans', async (c) => c.json({ min_days: MIN_DAYS, max_days: MAX_DAYS, plans: await store(c).publicPlans() }))
billing.get('/whoami', async (c) => {
    let level = null
    const u = await currentUser(c).catch(() => null)
    if (u) level = await store(c).adminLevel(u.id)
    return c.json({ ip: c.get('ip'), is_owner: !!c.get('isOwner'), is_admin: !!level, admin_level: level, quota: await peekQuota(c).catch(() => null) })
})

/* Dipanggil pembaca mutasi/notifikasi pembayaran: POST {amount} + Bearer PAYMENT_WEBHOOK_SECRET */
export const paymentWebhook = async (c) => {
    const secret = c.env.PAYMENT_WEBHOOK_SECRET
    if (!secret || c.req.header('authorization') !== `Bearer ${secret}`) return c.json({ error: 'Unauthorized', status: 401 }, 401)
    return send(c, await store(c).confirmByAmount(Number((await body(c)).amount), Date.now()))
}
billing.post('/webhook', paymentWebhook)

/* Beli paket: semua akun (member, premium, vip) boleh, wajib login. */
billing.post('/orders', requireUser, async (c) => {
    const b = await body(c)
    const o = await store(c).createOrder({ userId: c.get('user').id, plan: b.plan, days: b.days, permanent: !!b.permanent,
        ip: c.get('ip'), now: Date.now(), ttl: (Number(c.env.ORDER_TTL_MIN) || 30) * 60000 })
    return send(c, await attachQris(c, o))
})
billing.get('/orders/:id', requireUser, async (c) =>
    send(c, await attachQris(c, await store(c).getOrder(c.req.param('id'), c.get('user').id, !!c.get('isOwner')))))
billing.post('/orders/:id/cancel', requireUser, async (c) =>
    send(c, await store(c).cancelOwnOrder(c.req.param('id'), c.get('user').id)))

/* Callback BTZPay (POST ke callback_url saat status transaksi berubah). Dijaga token di URL (BTZPAY_CALLBACK_TOKEN).
 * Isi body TIDAK dipercaya: dipakai hanya untuk tahu transaksi mana; status asli diambil ulang dari BTZPay sebelum saldo dikredit.
 * Selalu balas {success:true} untuk transaksi tak dikenal (mis. uji Sandbox) supaya BTZPay tidak mengulang terus. */
export const btzCallback = async (c) => {
    if (!tokenOk(c.env, c.req.query('t') || c.req.header('x-callback-token'))) return c.json({ success: false, message: 'Unauthorized' }, 401)
    const b = await body(c), id = String(b.pay_id || b.raw?.data?.transactionId || '').trim()
    let matched = false, result = null
    if (/^[\w\-]{3,80}$/.test(id)) {
        const d = await store(c).smmDepGet(id)
        if (d && d.provider === 'btzpay') {
            matched = true
            try { const r = await settleBtzDeposit(c, d); result = r.err ? 'error: ' + r.err.message : r.status } catch (e) { result = 'error: ' + (e.message || e); console.error('[btzpay] callback', e) }
        }
    }
    await store(c).setBtzCb({ at: Date.now(), pay_id: id.slice(0, 80), status: String(b.status || '').slice(0, 20), matched, result: result && String(result).slice(0, 120) }).catch(() => {})
    return c.json({ success: true })
}
billing.post('/btzpay/callback', btzCallback)
