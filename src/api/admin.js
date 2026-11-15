import { Hono } from 'hono'
import { store, send } from '../utils/session.js'

/* Dashboard admin: akses otomatis dari IP owner (OWNER_IPS), tanpa login. */
export const admin = new Hono()
const body = (c) => c.req.json().catch(() => ({}))

admin.use('*', async (c, next) => {
    if (!c.get('isOwner')) return c.json({ error: 'Forbidden', message: `IP ${c.get('ip')} bukan owner.`, status: 403 }, 403)
    await next()
})
admin.get('/stats', async (c) => send(c, await store(c).adminStats(Date.now())))
admin.get('/users', async (c) => send(c, await store(c).adminUsers(c.req.query('q'), Date.now())))
admin.post('/users/:id/grant', async (c) => {
    const b = await body(c)
    return send(c, await store(c).adminGrant(+c.req.param('id'), b.plan, b.days, !!b.permanent, Date.now()))
})
admin.post('/users/:id/revoke', async (c) => send(c, await store(c).adminRevoke(+c.req.param('id'))))
admin.get('/orders', async (c) => send(c, await store(c).listOrders()))
admin.post('/orders/:id/confirm', async (c) => send(c, await store(c).confirmById(c.req.param('id'), Date.now())))
admin.post('/orders/:id/cancel', async (c) => send(c, await store(c).cancelOrder(c.req.param('id'))))
admin.get('/codes', async (c) => send(c, await store(c).adminCodes()))
admin.post('/codes', async (c) => send(c, await store(c).adminCreateCode(await body(c), Date.now())))
admin.delete('/codes/:code', async (c) => send(c, await store(c).adminDeleteCode(c.req.param('code'))))
