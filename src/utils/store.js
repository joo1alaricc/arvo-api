import { DurableObject } from 'cloudflare:workers'
import { PLANS, quote, jakartaDay } from './plans.js'

const DAY = 864e5
const GRACE = 10 * 60 * 1000
const fail = (status, error, message) => ({ ok: false, status, error, message })
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('')
const validIp = (ip) => /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)
    ? ip.split('.').every((n) => +n <= 255)
    : /^[0-9a-f:]{2,45}$/.test(ip) && ip.includes(':')

/* Satu instance global: user, sesi, pemakaian, dan order (SQLite). */
export class StoreDO extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env)
        this.sql = ctx.storage.sql
        this.sql.exec(`
            CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE COLLATE NOCASE, email TEXT,
                google_sub TEXT UNIQUE, pass_hash TEXT, pass_salt TEXT, api_key TEXT UNIQUE, plan TEXT, expires_at INTEGER,
                ips TEXT DEFAULT '[]', usage_day TEXT, usage_count INTEGER DEFAULT 0, total INTEGER DEFAULT 0, created_at INTEGER);
            CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER, expires_at INTEGER);
            CREATE TABLE IF NOT EXISTS usage(user_id INTEGER, day TEXT, path TEXT, count INTEGER DEFAULT 0, PRIMARY KEY(user_id,day,path));
            CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, user_id INTEGER, plan TEXT, days INTEGER, amount INTEGER, code INTEGER,
                total INTEGER, status TEXT, ip TEXT, created_at INTEGER, expires_at INTEGER, paid_at INTEGER);`)
    }

    q(sql, ...b) { return this.sql.exec(sql, ...b).toArray() }
    user(id) { return this.q('SELECT * FROM users WHERE id=?', id)[0] }

    pub(u, now) {
        const p = u.plan && (!u.expires_at || u.expires_at > now) ? PLANS[u.plan] : null
        return { ok: true, id: u.id, username: u.username, email: u.email, google: !!u.google_sub, has_password: !!u.pass_hash,
            api_key: u.api_key, role: p ? p.tier : 'member', plan: u.plan, plan_name: u.plan ? PLANS[u.plan].name : null,
            active: !!p, expired: !!u.plan && !p, expires_at: u.expires_at, daily_limit: p ? p.daily : null,
            max_ips: p ? p.maxIps : 0, custom_key: !!p?.customKey, ips: JSON.parse(u.ips),
            used_today: u.usage_day === jakartaDay(now) ? u.usage_count : 0, total_requests: u.total, created_at: u.created_at }
    }

    /* ---------- akun & sesi ---------- */
    insertUser({ username, email = null, sub = null, hash = null, salt = null, now }) {
        return this.sql.exec('INSERT INTO users(username,email,google_sub,pass_hash,pass_salt,api_key,created_at) VALUES(?,?,?,?,?,?,?) RETURNING id',
            username, email, sub, hash, salt, 'arvo_' + hex(16), now).one().id
    }
    register(o) {
        if (this.q('SELECT 1 FROM users WHERE username=?', o.username).length) return fail(409, 'username_taken', 'Username sudah dipakai.')
        return { ok: true, id: this.insertUser(o) }
    }
    googleLogin({ sub, email, now }) {
        const [u] = this.q('SELECT id FROM users WHERE google_sub=?', sub)
        if (u) return { ok: true, id: u.id }
        const base = (email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 14) || 'user').padEnd(3, '0')
        let name = base
        while (this.q('SELECT 1 FROM users WHERE username=?', name).length) name = base + Math.floor(Math.random() * 9000 + 1000)
        return { ok: true, id: this.insertUser({ username: name, email, sub, now }) }
    }
    authInfo({ username, id }) {
        const [u] = id ? this.q('SELECT * FROM users WHERE id=?', id) : this.q('SELECT * FROM users WHERE username=?', username)
        return u ? { ok: true, id: u.id, hash: u.pass_hash, salt: u.pass_salt } : fail(401, 'invalid_login', 'Username atau password salah.')
    }
    createSession(userId, tokenHash, now, ttl) {
        this.sql.exec('DELETE FROM sessions WHERE expires_at<?', now)
        this.sql.exec('INSERT INTO sessions VALUES(?,?,?)', tokenHash, userId, now + ttl)
        return { ok: true }
    }
    getSession(tokenHash, now) {
        const [s] = this.q('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?', tokenHash, now)
        const u = s && this.user(s.user_id)
        return u ? this.pub(u, now) : fail(401, 'unauthorized', 'Sesi tidak valid.')
    }
    endSession(tokenHash) { this.sql.exec('DELETE FROM sessions WHERE token_hash=?', tokenHash); return { ok: true } }

    setUsername(id, name) {
        if (this.q('SELECT 1 FROM users WHERE username=? AND id<>?', name, id).length) return fail(409, 'username_taken', 'Username sudah dipakai.')
        this.sql.exec('UPDATE users SET username=? WHERE id=?', name, id)
        return { ok: true, username: name }
    }
    setPassword(id, hash, salt) { this.sql.exec('UPDATE users SET pass_hash=?,pass_salt=? WHERE id=?', hash, salt, id); return { ok: true } }

    setIps(id, ips, now) {
        const p = this.pub(this.user(id), now)
        if (!p.active) return fail(403, 'not_allowed', 'Whitelist IP khusus paket Premium/VIP yang aktif.')
        const list = [...new Set((ips || []).map((i) => String(i).trim().toLowerCase()).filter(Boolean))]
        const bad = list.find((i) => !validIp(i))
        if (bad) return fail(400, 'bad_ip', `Format IP salah: ${bad}`)
        if (list.length > p.max_ips) return fail(400, 'too_many_ips', `Maksimal ${p.max_ips} IP untuk ${p.plan_name}.`)
        this.sql.exec('UPDATE users SET ips=? WHERE id=?', JSON.stringify(list), id)
        return { ok: true, ips: list }
    }
    setKey(id, newKey, now) {
        const p = this.pub(this.user(id), now)
        if (!p.custom_key) return fail(403, 'not_allowed', 'Custom API key khusus Premium 2 ke atas yang aktif.')
        if (!/^[A-Za-z0-9_-]{10,40}$/.test(newKey || '')) return fail(400, 'bad_key', 'Key 10-40 karakter: huruf, angka, _ atau -.')
        if (this.q('SELECT 1 FROM users WHERE api_key=? AND id<>?', newKey, id).length) return fail(409, 'key_taken', 'Key sudah dipakai.')
        this.sql.exec('UPDATE users SET api_key=? WHERE id=?', newKey, id)
        return { ok: true, api_key: newKey }
    }

    /* ---------- pemakaian API ---------- */
    consume(key, ip, path, now) {
        const [u] = this.q('SELECT * FROM users WHERE api_key=?', key)
        if (!u) return fail(401, 'invalid_api_key', 'API key tidak valid.')
        const p = this.pub(u, now)
        const day = jakartaDay(now)
        const hit = () => this.sql.exec('INSERT INTO usage(user_id,day,path,count) VALUES(?,?,?,1) ON CONFLICT(user_id,day,path) DO UPDATE SET count=count+1', u.id, day, path)
        if (!p.active) { hit(); this.sql.exec('UPDATE users SET total=total+1 WHERE id=?', u.id); return { ok: true, premium: false } }
        if (p.ips.length && !p.ips.includes(ip)) return fail(403, 'ip_not_whitelisted', `IP ${ip} tidak ada di whitelist key ini.`)
        let used = u.usage_day === day ? u.usage_count : 0
        if (p.daily_limit !== null && used >= p.daily_limit) return fail(429, 'daily_limit', 'Limit harian habis, reset 00:00 WIB.')
        used++
        this.sql.exec('UPDATE users SET usage_day=?,usage_count=?,total=total+1 WHERE id=?', day, used, u.id)
        hit()
        return { ok: true, premium: true, plan: u.plan, name: p.plan_name, limit: p.daily_limit, remaining: p.daily_limit === null ? null : p.daily_limit - used }
    }
    usage(id, now) {
        const from = jakartaDay(now - 13 * DAY)
        return { ok: true,
            days: this.q('SELECT day,SUM(count) n FROM usage WHERE user_id=? AND day>=? GROUP BY day ORDER BY day DESC', id, from),
            paths: this.q('SELECT path,SUM(count) n FROM usage WHERE user_id=? AND day>=? GROUP BY path ORDER BY n DESC LIMIT 10', id, from) }
    }

    /* ---------- order & paket ---------- */
    applyPlan(u, planId, days, now) {
        const add = days ? days * DAY : null
        const expires = add === null ? null : u.plan === planId
            ? (u.plan && u.expires_at === null ? null : Math.max(now, u.expires_at || 0) + add) : now + add
        const ips = JSON.stringify(JSON.parse(u.ips).slice(0, PLANS[planId].maxIps))
        this.sql.exec('UPDATE users SET plan=?,expires_at=?,ips=? WHERE id=?', planId, expires, ips, u.id)
    }
    createOrder({ userId, plan, days, permanent, ip, now, ttl }) {
        let qt
        try { qt = quote(plan, { days, permanent }) } catch (e) { return fail(400, 'bad_request', e.message) }
        this.sql.exec("UPDATE orders SET status='expired' WHERE status='pending' AND expires_at+?<?", GRACE, now)
        if (this.q("SELECT COUNT(*) c FROM orders WHERE status='pending' AND user_id=?", userId)[0].c >= 5) {
            return fail(429, 'too_many_pending', 'Terlalu banyak order tertunda, selesaikan atau tunggu kedaluwarsa.')
        }
        const used = new Set(this.q("SELECT code FROM orders WHERE status='pending' AND amount=?", qt.amount).map((r) => r.code))
        const free = Array.from({ length: 99 }, (_, i) => i + 1).filter((c) => !used.has(c))
        if (!free.length) return fail(503, 'busy', 'Antrean pembayaran penuh, coba beberapa menit lagi.')
        const code = free[Math.floor(Math.random() * free.length)]
        const id = hex(8), total = qt.amount + code
        this.sql.exec('INSERT INTO orders(id,user_id,plan,days,amount,code,total,status,ip,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
            id, userId, plan, qt.days, qt.amount, code, total, 'pending', ip, now, now + ttl)
        return { ok: true, id, plan, name: PLANS[plan].name, days: qt.days, amount: qt.amount, code, total, status: 'pending', expires_at: now + ttl }
    }
    fulfill(o, now) {
        this.applyPlan(this.user(o.user_id), o.plan, o.days, now)
        this.sql.exec("UPDATE orders SET status='paid',paid_at=? WHERE id=?", now, o.id)
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
    cancelOrder(id) { this.sql.exec("UPDATE orders SET status='cancelled' WHERE id=? AND status='pending'", id); return { ok: true } }
    getOrder(id, userId, isOwner) {
        const [o] = this.q('SELECT * FROM orders WHERE id=?', id)
        if (!o || (!isOwner && o.user_id !== userId)) return fail(404, 'not_found', 'Order tidak ditemukan.')
        return { ok: true, id: o.id, plan: o.plan, name: PLANS[o.plan].name, days: o.days, total: o.total, status: o.status, expires_at: o.expires_at }
    }
    userOrders(id) {
        return { ok: true, orders: this.q('SELECT id,plan,days,total,status,created_at FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 30', id) }
    }

    /* ---------- admin ---------- */
    adminStats(now) {
        const day = jakartaDay(now), one = (s, ...b) => this.q(s, ...b)[0]
        const tiers = { premium: 0, vip: 0 }
        for (const r of this.q('SELECT plan,COUNT(*) n FROM users WHERE plan IS NOT NULL AND (expires_at IS NULL OR expires_at>?) GROUP BY plan', now)) tiers[PLANS[r.plan].tier] += r.n
        const paid = one("SELECT COALESCE(SUM(total),0) s,COUNT(*) n FROM orders WHERE status='paid'")
        return { ok: true, users: one('SELECT COUNT(*) n FROM users').n, ...tiers, revenue: paid.s, paid_orders: paid.n,
            pending_orders: one("SELECT COUNT(*) n FROM orders WHERE status='pending'").n,
            requests_today: one('SELECT COALESCE(SUM(count),0) n FROM usage WHERE day=?', day).n,
            top_paths: this.q('SELECT path,SUM(count) n FROM usage WHERE day=? GROUP BY path ORDER BY n DESC LIMIT 8', day) }
    }
    adminUsers(search, now) {
        const l = `%${search || ''}%`
        return { ok: true, users: this.q('SELECT * FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY id DESC LIMIT 100', l, l).map((u) => {
            const p = this.pub(u, now)
            return { id: u.id, username: u.username, email: u.email, role: p.role, plan_name: p.plan_name, expires_at: u.expires_at, total_requests: u.total, created_at: u.created_at }
        }) }
    }
    adminGrant(id, plan, days, permanent, now) {
        const u = this.user(id), d = Math.floor(Number(days))
        if (!u) return fail(404, 'not_found', 'User tidak ditemukan.')
        if (!PLANS[plan]) return fail(400, 'bad_request', 'Paket tidak dikenal.')
        if (!permanent && !(d >= 1 && d <= 3650)) return fail(400, 'bad_request', 'Durasi 1-3650 hari.')
        this.applyPlan(u, plan, permanent ? null : d, now)
        return { ok: true }
    }
    adminRevoke(id) { this.sql.exec('UPDATE users SET plan=NULL,expires_at=NULL,ips=? WHERE id=?', '[]', id); return { ok: true } }
    listOrders() {
        return { ok: true, orders: this.q("SELECT o.id,o.plan,o.days,o.total,o.status,o.created_at,u.username FROM orders o LEFT JOIN users u ON u.id=o.user_id ORDER BY o.status='pending' DESC,o.created_at DESC LIMIT 100") }
    }
}
