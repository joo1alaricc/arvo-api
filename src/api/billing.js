import { Hono } from 'hono'
import { PLANS, MIN_DAYS, MAX_DAYS } from '../utils/plans.js'
import { makeQris } from '../utils/payment.js'

export const billing = new Hono()

const store = (c) => c.env.STORE.get(c.env.STORE.idFromName('main'))
const send = (c, r) => c.json(r, r.ok === false ? r.status : 200)
const keyOf = (c) => c.req.header('x-api-key') || ''
const body = async (c) => c.req.json().catch(() => ({}))
const attachQris = async (c, o) => {
    if (o.ok === false || o.status === 'paid') return o
    try { return { ...o, qris: await makeQris(c.env, o.total) } }
    catch (e) { console.error('[QRIS]', e); return { ok: false, status: 503, error: 'qris_unavailable', message: 'QRIS belum bisa dibuat. Hubungi admin.' } }
}

billing.get('/plans', (c) => c.json({
    min_days: MIN_DAYS, max_days: MAX_DAYS,
    plans: Object.entries(PLANS).map(([id, p]) => ({ id, ...p })),
}))

billing.get('/whoami', (c) => c.json({ ip: c.get('ip'), is_owner: !!c.get('isOwner') }))

billing.post('/orders', async (c) => {
    const b = await body(c)
    const o = await store(c).createOrder({ plan: b.plan, days: b.days, permanent: !!b.permanent, renewKey: b.renew_key || null,
        ip: c.get('ip'), now: Date.now(), ttl: (Number(c.env.ORDER_TTL_MIN) || 30) * 60000 })
    return send(c, await attachQris(c, o))
})

billing.get('/orders/:id', async (c) => send(c, await attachQris(c, await store(c).getOrder(c.req.param('id')))))

/* Dipanggil oleh pembaca mutasi/notifikasi pembayaran: POST {amount} + Bearer WEBHOOK_SECRET */
billing.post('/webhook', async (c) => {
    const secret = c.env.PAYMENT_WEBHOOK_SECRET
    if (!secret || c.req.header('authorization') !== `Bearer ${secret}`) return c.json({ error: 'Unauthorized', status: 401 }, 401)
    const { amount } = await body(c)
    return send(c, await store(c).confirmByAmount(Number(amount), Date.now()))
})

billing.get('/me', async (c) => send(c, await store(c).me(keyOf(c), Date.now())))
billing.put('/me/ips', async (c) => send(c, await store(c).setIps(keyOf(c), (await body(c)).ips)))
billing.put('/me/key', async (c) => send(c, await store(c).setKey(keyOf(c), (await body(c)).new_key)))

billing.use('/admin/*', async (c, next) => {
    if (!c.get('isOwner')) return c.json({ error: 'Forbidden', message: 'Khusus owner.', status: 403 }, 403)
    await next()
})
billing.get('/admin/orders', async (c) => send(c, await store(c).listOrders()))
billing.post('/admin/orders/:id/confirm', async (c) => send(c, await store(c).confirmById(c.req.param('id'), Date.now())))
