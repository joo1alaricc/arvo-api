import { Hono } from 'hono'
import { store, send, fail } from '../utils/session.js'
import { refreshBlocked } from '../utils/rateLimit.js'
import { BUILTIN_PATHS } from './index.js'

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

/* ---- detail IP user & blokir IP ---- */
admin.get('/users/:id/ips', async (c) => send(c, await store(c).adminUserIps(+c.req.param('id'))))
admin.get('/blocked', async (c) => send(c, await store(c).adminBlocked()))
admin.post('/blocked', async (c) => {
    const b = await body(c)
    if (String(c.env.OWNER_IPS || '').split(',').map((x) => x.trim()).includes(String(b.ip || '').trim())) return send(c, fail(400, 'owner_ip', 'IP owner tidak boleh diblokir.'))
    const r = await store(c).adminBlock(b.ip, b.reason, Date.now()); refreshBlocked(); return send(c, r)
})
admin.delete('/blocked/:ip', async (c) => { const r = await store(c).adminUnblock(decodeURIComponent(c.req.param('ip'))); refreshBlocked(); return send(c, r) })

/* ---- paket ---- */
admin.get('/plans', async (c) => send(c, await store(c).adminPlans()))
admin.post('/plans', async (c) => send(c, await store(c).adminSavePlan(await body(c), true)))
admin.put('/plans/:id', async (c) => send(c, await store(c).adminSavePlan({ ...(await body(c)), id: c.req.param('id') }, false)))
admin.delete('/plans/:id', async (c) => send(c, await store(c).adminDeletePlan(c.req.param('id'))))

/* ---- claim trial ---- */
admin.get('/trial', async (c) => send(c, await store(c).adminTrial()))
admin.put('/trial', async (c) => send(c, await store(c).adminSetTrial(await body(c))))
admin.delete('/trial/claims/:uid', async (c) => send(c, await store(c).adminResetClaim(+c.req.param('uid'))))

/* ---- endpoint dinamis ---- */
admin.get('/endpoints', async (c) => send(c, await store(c).listEndpoints()))
admin.post('/endpoints', async (c) => send(c, await store(c).adminSaveEndpoint(await body(c), null, BUILTIN_PATHS, Date.now())))
admin.put('/endpoints/:id', async (c) => send(c, await store(c).adminSaveEndpoint(await body(c), +c.req.param('id'), BUILTIN_PATHS, Date.now())))
admin.delete('/endpoints/:id', async (c) => send(c, await store(c).adminDeleteEndpoint(+c.req.param('id'))))
