import { DurableObject } from 'cloudflare:workers'
import { PLANS, quote, jakartaDay } from './plans.js'

const DAY = 864e5
const GRACE = 10 * 60 * 1000
const fail = (status, error, message) => ({ ok: false, status, error, message })
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('')
const validIp = (ip) => /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)
    ? ip.split('.').every((n) => +n <= 255)
    : /^[0-9a-f:]{2,45}$/.test(ip) && ip.includes(':')

/* Satu instance global: akun, pemakaian harian, dan order pembayaran (SQLite). */
export class StoreDO extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env)
        this.sql = ctx.storage.sql
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS accounts(id INTEGER PRIMARY KEY AUTOINCREMENT, api_key TEXT UNIQUE, plan TEXT,
                expires_at INTEGER, ips TEXT DEFAULT '[]', usage_day TEXT, usage_count INTEGER DEFAULT 0,
                total INTEGER DEFAULT 0, created_at INTEGER);
            CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, plan TEXT, days INTEGER, amount INTEGER, code INTEGER,
                total INTEGER, status TEXT, account_id INTEGER, ip TEXT, created_at INTEGER, expires_at INTEGER, paid_at INTEGER);`)
    }

    q(sql, ...b) { return this.sql.exec(sql, ...b).toArray() }

    consume(key, ip, now) {
        const [a] = this.q('SELECT * FROM accounts WHERE api_key=?', key)
        if (!a) return fail(401, 'invalid_api_key', 'API key tidak valid.')
        const plan = PLANS[a.plan]
        if (a.expires_at && a.expires_at < now) return fail(403, 'plan_expired', 'Paket sudah berakhir, silakan perpanjang.')
        const ips = JSON.parse(a.ips)
        if (ips.length && !ips.includes(ip)) return fail(403, 'ip_not_whitelisted', `IP ${ip} tidak ada di whitelist key ini.`)
        const day = jakartaDay(now)
        let used = a.usage_day === day ? a.usage_count : 0
        if (plan.daily !== null && used >= plan.daily) return { ...fail(429, 'daily_limit', 'Limit harian habis, reset 00:00 WIB.'), limit: plan.daily, remaining: 0 }
        used++
        this.sql.exec('UPDATE accounts SET usage_day=?,usage_count=?,total=total+1 WHERE id=?', day, used, a.id)
        return { ok: true, plan: a.plan, name: plan.name, limit: plan.daily, remaining: plan.daily === null ? null : plan.daily - used }
    }

    createOrder({ plan, days, permanent, renewKey, ip, now, ttl }) {
        let qt
        try { qt = quote(plan, { days, permanent }) } catch (e) { return fail(400, 'bad_request', e.message) }
        let accountId = null
        if (renewKey) {
            const [a] = this.q('SELECT id FROM accounts WHERE api_key=?', renewKey)
            if (!a) return fail(404, 'invalid_api_key', 'API key untuk perpanjangan tidak ditemukan.')
            accountId = a.id
        }
        this.sql.exec("UPDATE orders SET status='expired' WHERE status='pending' AND expires_at+?<?", GRACE, now)
        if (this.q("SELECT COUNT(*) c FROM orders WHERE status='pending' AND ip=?", ip)[0].c >= 5) {
            return fail(429, 'too_many_pending', 'Terlalu banyak order tertunda, selesaikan atau tunggu kedaluwarsa.')
        }
        const used = new Set(this.q("SELECT code FROM orders WHERE status='pending' AND amount=?", qt.amount).map((r) => r.code))
        const free = Array.from({ length: 99 }, (_, i) => i + 1).filter((c) => !used.has(c))
        if (!free.length) return fail(503, 'busy', 'Antrean pembayaran penuh, coba beberapa menit lagi.')
        const code = free[Math.floor(Math.random() * free.length)]
        const id = hex(8)
        const total = qt.amount + code
        this.sql.exec('INSERT INTO orders(id,plan,days,amount,code,total,status,account_id,ip,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
            id, plan, qt.days, qt.amount, code, total, 'pending', accountId, ip, now, now + ttl)
        return { ok: true, id, plan, name: PLANS[plan].name, days: qt.days, amount: qt.amount, code, total, expires_at: now + ttl }
    }

    fulfill(o, now) {
        const exp = this.q('SELECT * FROM accounts WHERE id=?', o.account_id ?? -1)[0]
        const add = o.days ? o.days * DAY : null
        const expires = add === null ? null : exp && exp.plan === o.plan
            ? (exp.expires_at === null ? null : Math.max(now, exp.expires_at) + add) : now + add
        let id = exp?.id
        if (exp) {
            const ips = JSON.stringify(JSON.parse(exp.ips).slice(0, PLANS[o.plan].maxIps))
            this.sql.exec('UPDATE accounts SET plan=?,expires_at=?,ips=? WHERE id=?', o.plan, expires, ips, id)
        } else {
            id = this.sql.exec('INSERT INTO accounts(api_key,plan,expires_at,created_at) VALUES(?,?,?,?) RETURNING id',
                'arvo_' + hex(16), o.plan, expires, now).one().id
        }
        this.sql.exec("UPDATE orders SET status='paid',paid_at=?,account_id=? WHERE id=?", now, id, o.id)
        return { ok: true, order: o.id, plan: o.plan, total: o.total }
    }

    confirmByAmount(amount, now) {
        const rows = this.q("SELECT * FROM orders WHERE status='pending' AND total=? AND expires_at+?>?", amount, GRACE, now)
        return rows.length === 1 ? this.fulfill(rows[0], now) : fail(404, 'no_match', 'Tidak ada order pending dengan nominal itu.')
    }

    confirmById(id, now) {
        const [o] = this.q("SELECT * FROM orders WHERE id=? AND status='pending'", id)
        return o ? this.fulfill(o, now) : fail(404, 'no_match', 'Order pending tidak ditemukan.')
    }

    getOrder(id) {
        const [o] = this.q('SELECT o.*,a.api_key FROM orders o LEFT JOIN accounts a ON a.id=o.account_id WHERE o.id=?', id)
        if (!o) return fail(404, 'not_found', 'Order tidak ditemukan.')
        return { ok: true, id: o.id, plan: o.plan, name: PLANS[o.plan].name, days: o.days, total: o.total, status: o.status,
            expires_at: o.expires_at, api_key: o.status === 'paid' ? o.api_key : undefined }
    }

    listOrders() {
        return { ok: true, orders: this.q("SELECT id,plan,days,total,status,ip,created_at FROM orders ORDER BY status='pending' DESC, created_at DESC LIMIT 50") }
    }

    me(key, now) {
        const [a] = this.q('SELECT * FROM accounts WHERE api_key=?', key)
        if (!a) return fail(401, 'invalid_api_key', 'API key tidak valid.')
        const p = PLANS[a.plan]
        return { ok: true, plan: a.plan, name: p.name, tier: p.tier, daily_limit: p.daily, max_ips: p.maxIps, custom_key: p.customKey,
            expires_at: a.expires_at, expired: !!a.expires_at && a.expires_at < now, ips: JSON.parse(a.ips),
            used_today: a.usage_day === jakartaDay(now) ? a.usage_count : 0, total_requests: a.total }
    }

    setIps(key, ips) {
        const [a] = this.q('SELECT * FROM accounts WHERE api_key=?', key)
        if (!a) return fail(401, 'invalid_api_key', 'API key tidak valid.')
        const list = [...new Set((ips || []).map((i) => String(i).trim().toLowerCase()).filter(Boolean))]
        const bad = list.find((i) => !validIp(i))
        if (bad) return fail(400, 'bad_ip', `Format IP salah: ${bad}`)
        const max = PLANS[a.plan].maxIps
        if (list.length > max) return fail(400, 'too_many_ips', `Maksimal ${max} IP untuk ${PLANS[a.plan].name}.`)
        this.sql.exec('UPDATE accounts SET ips=? WHERE id=?', JSON.stringify(list), a.id)
        return { ok: true, ips: list }
    }

    setKey(key, newKey) {
        const [a] = this.q('SELECT * FROM accounts WHERE api_key=?', key)
        if (!a) return fail(401, 'invalid_api_key', 'API key tidak valid.')
        if (!PLANS[a.plan].customKey) return fail(403, 'not_allowed', 'Paket ini belum mendukung custom API key.')
        if (!/^[A-Za-z0-9_-]{10,40}$/.test(newKey || '')) return fail(400, 'bad_key', 'Key 10-40 karakter: huruf, angka, _ atau -.')
        if (this.q('SELECT 1 FROM accounts WHERE api_key=?', newKey).length) return fail(409, 'key_taken', 'Key sudah dipakai.')
        this.sql.exec('UPDATE accounts SET api_key=? WHERE id=?', newKey, a.id)
        return { ok: true, api_key: newKey }
    }
}
