import { DurableObject } from 'cloudflare:workers'
import { DEFAULT_PLANS, quote, jakartaDay } from './plans.js'

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
                total INTEGER, status TEXT, ip TEXT, created_at INTEGER, expires_at INTEGER, paid_at INTEGER);
            CREATE TABLE IF NOT EXISTS ip_meta(user_id INTEGER, ip TEXT, created_at INTEGER, last_used INTEGER, req INTEGER DEFAULT 0, PRIMARY KEY(user_id,ip));
            CREATE TABLE IF NOT EXISTS codes(code TEXT PRIMARY KEY, plan TEXT, days INTEGER, max_uses INTEGER DEFAULT 1, used INTEGER DEFAULT 0, created_at INTEGER);
            CREATE TABLE IF NOT EXISTS redeems(code TEXT, user_id INTEGER, at INTEGER, PRIMARY KEY(code,user_id));
            CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY, tier TEXT, name TEXT, daily INTEGER, max_ips INTEGER DEFAULT 0, custom_key INTEGER DEFAULT 0,
                base_days INTEGER, base_price INTEGER, permanent_price INTEGER, visible INTEGER DEFAULT 1, sort INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS trial_claims(user_id INTEGER PRIMARY KEY, ip TEXT, plan TEXT, days INTEGER, at INTEGER);
            CREATE TABLE IF NOT EXISTS blocked_ips(ip TEXT PRIMARY KEY, reason TEXT, created_at INTEGER);
            CREATE TABLE IF NOT EXISTS seen_ips(user_id INTEGER, ip TEXT, src TEXT, first_at INTEGER, last_at INTEGER, hits INTEGER DEFAULT 0, PRIMARY KEY(user_id,ip));
            CREATE TABLE IF NOT EXISTS endpoints(id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT, slug TEXT, name TEXT, description TEXT DEFAULT '',
                method TEXT DEFAULT 'GET', access TEXT DEFAULT 'free', status TEXT DEFAULT 'online', mode TEXT DEFAULT 'proxy', code TEXT DEFAULT '',
                headers TEXT DEFAULT '{}', inputs TEXT DEFAULT '[]', created_at INTEGER, updated_at INTEGER, UNIQUE(category,slug));`)
        for (const col of ['phone', 'avatar_url', 'banner_url', 'reg_ip', 'last_ip', 'avatar_data', 'avatar_ver']) { try { this.sql.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT`) } catch {} }
        try { this.sql.exec('ALTER TABLE users ADD COLUMN last_seen INTEGER') } catch {}
        if (!this.q('SELECT 1 FROM plans LIMIT 1').length) {
            DEFAULT_PLANS.forEach((p, i) => this.sql.exec('INSERT INTO plans VALUES(?,?,?,?,?,?,?,?,?,1,?)', p.id, p.tier, p.name, p.daily, p.maxIps, p.customKey ? 1 : 0, p.baseDays, p.basePrice, p.permanentPrice, i))
        }
        this.loadPlans()
    }

    loadPlans() {
        this.plans = Object.fromEntries(this.q('SELECT * FROM plans ORDER BY sort,rowid').map((r) => [r.id, {
            id: r.id, tier: r.tier, name: r.name, daily: r.daily, maxIps: r.max_ips, customKey: !!r.custom_key,
            baseDays: r.base_days, basePrice: r.base_price, permanentPrice: r.permanent_price, visible: !!r.visible,
        }]))
    }
    setting(k, d = null) { const [r] = this.q('SELECT value FROM settings WHERE key=?', k); return r ? JSON.parse(r.value) : d }
    saveSetting(k, v) { this.sql.exec('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, JSON.stringify(v)) }
    touchIp(uid, ip, now, src) {
        if (!ip || ip === 'unknown') return
        this.sql.exec('INSERT INTO seen_ips VALUES(?,?,?,?,?,1) ON CONFLICT(user_id,ip) DO UPDATE SET last_at=excluded.last_at,hits=hits+1,src=excluded.src', uid, ip, src, now, now)
        this.sql.exec('UPDATE users SET last_ip=?,last_seen=? WHERE id=?', ip, now, uid)
    }

    q(sql, ...b) { return this.sql.exec(sql, ...b).toArray() }
    user(id) { return this.q('SELECT * FROM users WHERE id=?', id)[0] }

    pub(u, now) {
        const p = u.plan && (!u.expires_at || u.expires_at > now) ? this.plans[u.plan] || null : null
        return { ok: true, id: u.id, username: u.username, email: u.email, google: !!u.google_sub, has_password: !!u.pass_hash,
            api_key: u.api_key, role: p ? p.tier : 'member', plan: u.plan, plan_name: u.plan ? this.plans[u.plan]?.name || u.plan : null,
            active: !!p, expired: !!u.plan && !p, expires_at: u.expires_at, daily_limit: p ? p.daily : null,
            max_ips: p ? p.maxIps : 0, custom_key: !!p?.customKey, ips: JSON.parse(u.ips),
            used_today: u.usage_day === jakartaDay(now) ? u.usage_count : 0, total_requests: u.total, created_at: u.created_at,
            phone: u.phone || null, avatar_url: u.avatar_data ? `/api/auth/me/avatar?v=${u.avatar_ver || 1}` : (u.avatar_url || null), last_ip: u.last_ip || null }
    }

    /* ---------- akun & sesi ---------- */
    insertUser({ username, email = null, sub = null, hash = null, salt = null, now, ip = null }) {
        const id = this.sql.exec('INSERT INTO users(username,email,google_sub,pass_hash,pass_salt,api_key,created_at,reg_ip) VALUES(?,?,?,?,?,?,?,?) RETURNING id',
            username, email, sub, hash, salt, 'arvo_' + hex(16), now, ip).one().id
        this.touchIp(id, ip, now, 'web')
        return id
    }
    register(o) {
        if (this.q('SELECT 1 FROM users WHERE username=?', o.username).length) return fail(409, 'username_taken', 'Username sudah dipakai.')
        return { ok: true, id: this.insertUser(o) }
    }
    googleLogin({ sub, email, now, ip }) {
        const [u] = this.q('SELECT id,avatar_data,avatar_url,avatar_ver FROM users WHERE google_sub=?', sub)
        /* avatar_ver terisi = user pernah mengatur/menghapus foto sendiri, jangan ditimpa foto Google lagi */
        if (u) { this.touchIp(u.id, ip, now, 'web'); return { ok: true, id: u.id, needAvatar: !u.avatar_data && !u.avatar_url && u.avatar_ver == null } }
        const base = (email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 14) || 'user').padEnd(3, '0')
        let name = base
        while (this.q('SELECT 1 FROM users WHERE username=?', name).length) name = base + Math.floor(Math.random() * 9000 + 1000)
        return { ok: true, id: this.insertUser({ username: name, email, sub, now, ip }), needAvatar: true }
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
    getSession(tokenHash, now, ip) {
        const [s] = this.q('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?', tokenHash, now)
        let u = s && this.user(s.user_id)
        if (!u) return fail(401, 'unauthorized', 'Sesi tidak valid.')
        if (ip && (u.last_ip !== ip || now - (u.last_seen || 0) > 300000)) { this.touchIp(u.id, ip, now, 'web'); u = this.user(u.id) }
        return this.pub(u, now)
    }
    loginOk(id, ip, now) { this.touchIp(id, ip, now, 'web'); return { ok: true } }
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
        for (const i of list) this.sql.exec('INSERT OR IGNORE INTO ip_meta(user_id,ip,created_at,req) VALUES(?,?,?,0)', id, i, now)
        const old = this.q('SELECT ip FROM ip_meta WHERE user_id=?', id).map((r) => r.ip).filter((i) => !list.includes(i))
        for (const i of old) this.sql.exec('DELETE FROM ip_meta WHERE user_id=? AND ip=?', id, i)
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
    /* need: free | premium | vip | owner. Tier dicek SEBELUM kuota dikurangi, jadi request yang ditolak tidak memakan limit. */
    consume(key, ip, path, now, need = 'free') {
        const [u] = this.q('SELECT * FROM users WHERE api_key=?', key)
        if (!u) return fail(401, 'invalid_api_key', 'API key tidak valid.')
        const p = this.pub(u, now)
        const day = jakartaDay(now)
        const hit = () => this.sql.exec('INSERT INTO usage(user_id,day,path,count) VALUES(?,?,?,1) ON CONFLICT(user_id,day,path) DO UPDATE SET count=count+1', u.id, day, path)
        this.touchIp(u.id, ip, now, 'api')
        if (!p.active) {
            if (need !== 'free') return fail(402, 'premium_required', need === 'vip' ? 'Endpoint ini khusus paket VIP.' : 'Endpoint ini khusus paket Premium/VIP.')
            hit(); this.sql.exec('UPDATE users SET total=total+1 WHERE id=?', u.id); return { ok: true, premium: false }
        }
        if (need === 'vip' && p.role !== 'vip') return fail(402, 'vip_required', 'Endpoint ini khusus paket VIP.')
        if (p.ips.length && !p.ips.includes(ip)) return fail(403, 'ip_not_whitelisted', `IP ${ip} tidak ada di whitelist key ini.`)
        if (p.ips.includes(ip)) this.sql.exec('UPDATE ip_meta SET last_used=?,req=req+1 WHERE user_id=? AND ip=?', now, u.id, ip)
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

    /* ---------- profil, whitelist (tabel), redeem, hapus akun ---------- */
    /* ---------- foto profil (file diunggah, disimpan sebagai data URL kecil) ---------- */
    setAvatar(id, data, now) {
        data = String(data || '')
        if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(data)) return fail(400, 'bad_image', 'File harus gambar JPG, PNG, atau WebP.')
        if (data.length > 200000) return fail(413, 'image_big', 'Gambar terlalu besar. Pakai foto yang lebih kecil.')
        this.sql.exec('UPDATE users SET avatar_data=?,avatar_ver=?,avatar_url=NULL WHERE id=?', data, String(now), id)
        return { ok: true, avatar_url: `/api/auth/me/avatar?v=${now}` }
    }
    clearAvatar(id) {
        this.sql.exec("UPDATE users SET avatar_data=NULL,avatar_url=NULL,avatar_ver='0' WHERE id=?", id)
        return { ok: true, avatar_url: null }
    }
    getAvatar(id) {
        const u = this.user(id)
        return u && u.avatar_data ? { ok: true, data: u.avatar_data } : fail(404, 'no_avatar', 'Belum ada foto.')
    }
    /* Foto dari Google: hanya mengisi jika user belum pernah mengatur foto. */
    setAvatarIfEmpty(id, data, now) {
        const u = this.user(id)
        if (!u || u.avatar_data || u.avatar_url || u.avatar_ver != null) return { ok: true, skipped: true }
        return this.setAvatar(id, data, now)
    }

    setProfile(id, b) {
        const u = this.user(id), out = {}
        const url = (v, name) => {
            v = String(v ?? '').trim()
            if (!v) return null
            if (v.length > 500 || !(/^https:\/\/[^\s]+$/i.test(v) || /^\/(?!\/)[^\s]*$/.test(v))) throw new Error(`${name} harus berupa URL https:// atau path yang diawali /`)
            return v
        }
        try {
            if ('email' in b) {
                const e = String(b.email ?? '').trim()
                if (e && !/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e)) throw new Error('Format email tidak valid.')
                out.email = e || null
            }
            if ('phone' in b) {
                const ph = String(b.phone ?? '').replace(/[\s-]/g, '')
                if (ph && !/^\+?\d{8,15}$/.test(ph)) throw new Error('Nomor telepon 8-15 digit, boleh diawali +.')
                out.phone = ph || null
            }
        } catch (e) { return fail(400, 'bad_profile', e.message) }
        const keys = Object.keys(out)
        if (!keys.length) return fail(400, 'bad_profile', 'Tidak ada data yang diubah.')
        this.sql.exec(`UPDATE users SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`, ...keys.map((k) => out[k]), id)
        return { ok: true, ...out }
    }
    listIps(id) {
        const u = this.user(id), meta = new Map(this.q('SELECT * FROM ip_meta WHERE user_id=?', id).map((r) => [r.ip, r]))
        return { ok: true, ips: JSON.parse(u.ips).map((ip) => ({ ip, created_at: meta.get(ip)?.created_at ?? null, last_used: meta.get(ip)?.last_used ?? null, req: meta.get(ip)?.req ?? 0 })) }
    }
    addIp(id, ip, now) {
        const cur = JSON.parse(this.user(id).ips), v = String(ip || '').trim().toLowerCase()
        return cur.includes(v) ? fail(409, 'ip_exists', 'IP itu sudah ada di whitelist.') : this.setIps(id, [...cur, v], now)
    }
    removeIp(id, ip, now) {
        const cur = JSON.parse(this.user(id).ips), v = String(ip || '').trim().toLowerCase()
        return cur.includes(v) ? this.setIps(id, cur.filter((i) => i !== v), now) : fail(404, 'not_found', 'IP tidak ada di whitelist.')
    }
    redeem(id, code, now) {
        const c = String(code || '').trim().toUpperCase()
        if (!c) return fail(400, 'bad_code', 'Masukkan kode redeem.')
        const [r] = this.q('SELECT * FROM codes WHERE code=?', c)
        if (!r) return fail(404, 'bad_code', 'Kode tidak ditemukan.')
        if (r.used >= r.max_uses) return fail(410, 'code_used_up', 'Kode sudah habis dipakai.')
        if (this.q('SELECT 1 FROM redeems WHERE code=? AND user_id=?', c, id).length) return fail(409, 'code_taken', 'Kamu sudah memakai kode ini.')
        this.applyPlan(this.user(id), r.plan, r.days, now)
        this.sql.exec('INSERT INTO redeems VALUES(?,?,?)', c, id, now)
        this.sql.exec('UPDATE codes SET used=used+1 WHERE code=?', c)
        return { ok: true, plan: r.plan, name: this.plans[r.plan]?.name || r.plan, days: r.days }
    }
    deleteAccount(id) {
        for (const t of ['sessions', 'usage', 'ip_meta', 'redeems', 'seen_ips']) this.sql.exec(`DELETE FROM ${t} WHERE user_id=?`, id)
        this.sql.exec('DELETE FROM users WHERE id=?', id)
        return { ok: true }
    }

    /* ---------- order & paket ---------- */
    applyPlan(u, planId, days, now) {
        const add = days ? days * DAY : null
        const expires = add === null ? null : u.plan === planId
            ? (u.plan && u.expires_at === null ? null : Math.max(now, u.expires_at || 0) + add) : now + add
        const ips = JSON.stringify(JSON.parse(u.ips).slice(0, this.plans[planId].maxIps))
        this.sql.exec('UPDATE users SET plan=?,expires_at=?,ips=? WHERE id=?', planId, expires, ips, u.id)
    }
    createOrder({ userId, plan, days, permanent, ip, now, ttl }) {
        let qt
        try { const pl = this.plans[plan]; if (!pl || !pl.visible) throw new Error('Paket tidak tersedia.'); qt = quote(pl, { days, permanent }) } catch (e) { return fail(400, 'bad_request', e.message) }
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
        return { ok: true, id, plan, name: this.plans[plan].name, days: qt.days, amount: qt.amount, code, total, status: 'pending', expires_at: now + ttl }
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
        return { ok: true, id: o.id, plan: o.plan, name: this.plans[o.plan]?.name || o.plan, days: o.days, total: o.total, status: o.status, expires_at: o.expires_at }
    }
    userOrders(id) {
        return { ok: true, orders: this.q('SELECT id,plan,days,total,status,created_at FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 30', id) }
    }

    /* ---------- admin ---------- */
    adminStats(now) {
        const day = jakartaDay(now), one = (s, ...b) => this.q(s, ...b)[0]
        const tiers = { premium: 0, vip: 0 }
        for (const r of this.q('SELECT plan,COUNT(*) n FROM users WHERE plan IS NOT NULL AND (expires_at IS NULL OR expires_at>?) GROUP BY plan', now)) if (this.plans[r.plan]) tiers[this.plans[r.plan].tier] += r.n
        const paid = one("SELECT COALESCE(SUM(total),0) s,COUNT(*) n FROM orders WHERE status='paid'")
        return { ok: true, users: one('SELECT COUNT(*) n FROM users').n, ...tiers, revenue: paid.s, paid_orders: paid.n,
            pending_orders: one("SELECT COUNT(*) n FROM orders WHERE status='pending'").n,
            requests_today: one('SELECT COALESCE(SUM(count),0) n FROM usage WHERE day=?', day).n,
            top_paths: this.q('SELECT path,SUM(count) n FROM usage WHERE day=? GROUP BY path ORDER BY n DESC LIMIT 8', day) }
    }
    adminUsers(search, now) {
        const l = `%${search || ''}%`
        const blocked = new Set(this.q('SELECT ip FROM blocked_ips').map((r) => r.ip))
        const rows = this.q(`SELECT * FROM users WHERE username LIKE ? OR email LIKE ? OR last_ip LIKE ? OR reg_ip LIKE ?
            OR id IN (SELECT user_id FROM seen_ips WHERE ip LIKE ?) ORDER BY COALESCE(last_seen,created_at) DESC LIMIT 100`, l, l, l, l, l)
        return { ok: true, users: rows.map((u) => {
            const p = this.pub(u, now)
            return { id: u.id, username: u.username, email: u.email, role: p.role, plan_name: p.plan_name, expires_at: u.expires_at, total_requests: u.total,
                created_at: u.created_at, last_seen: u.last_seen, last_ip: u.last_ip, reg_ip: u.reg_ip, last_ip_blocked: blocked.has(u.last_ip), used_today: p.used_today, daily_limit: p.daily_limit }
        }) }
    }
    adminUserIps(id) {
        const blocked = new Set(this.q('SELECT ip FROM blocked_ips').map((r) => r.ip))
        const u = this.user(id)
        if (!u) return fail(404, 'not_found', 'User tidak ditemukan.')
        return { ok: true, username: u.username, reg_ip: u.reg_ip, ips: this.q('SELECT ip,src,first_at,last_at,hits FROM seen_ips WHERE user_id=? ORDER BY last_at DESC LIMIT 50', id).map((r) => ({ ...r, blocked: blocked.has(r.ip) })) }
    }
    adminGrant(id, plan, days, permanent, now) {
        const u = this.user(id), d = Math.floor(Number(days))
        if (!u) return fail(404, 'not_found', 'User tidak ditemukan.')
        if (!this.plans[plan]) return fail(400, 'bad_request', 'Paket tidak dikenal.')
        if (!permanent && !(d >= 1 && d <= 3650)) return fail(400, 'bad_request', 'Durasi 1-3650 hari.')
        this.applyPlan(u, plan, permanent ? null : d, now)
        return { ok: true }
    }
    adminRevoke(id) { this.sql.exec('UPDATE users SET plan=NULL,expires_at=NULL,ips=? WHERE id=?', '[]', id); return { ok: true } }
    adminCreateCode({ code, plan, days, permanent, max_uses }, now) {
        if (!this.plans[plan]) return fail(400, 'bad_request', 'Paket tidak dikenal.')
        const d = permanent ? null : Math.floor(Number(days)), m = Math.floor(Number(max_uses) || 1)
        if (!permanent && !(d >= 1 && d <= 3650)) return fail(400, 'bad_request', 'Durasi 1-3650 hari.')
        if (!(m >= 1 && m <= 100000)) return fail(400, 'bad_request', 'Maks pemakaian 1-100000.')
        const c = String(code || '').trim().toUpperCase() || hex(4).toUpperCase()
        if (!/^[A-Z0-9_-]{4,32}$/.test(c)) return fail(400, 'bad_code', 'Kode 4-32 karakter: huruf, angka, _ atau -.')
        if (this.q('SELECT 1 FROM codes WHERE code=?', c).length) return fail(409, 'code_exists', 'Kode sudah ada.')
        this.sql.exec('INSERT INTO codes VALUES(?,?,?,?,0,?)', c, plan, d, m, now)
        return { ok: true, code: c }
    }
    adminCodes() { return { ok: true, codes: this.q('SELECT * FROM codes ORDER BY created_at DESC LIMIT 100') } }
    adminDeleteCode(code) { this.sql.exec('DELETE FROM codes WHERE code=?', String(code).toUpperCase()); return { ok: true } }
    listOrders() {
        return { ok: true, orders: this.q("SELECT o.id,o.plan,o.days,o.total,o.status,o.created_at,u.username FROM orders o LEFT JOIN users u ON u.id=o.user_id ORDER BY o.status='pending' DESC,o.created_at DESC LIMIT 100") }
    }

    /* ---------- paket (dikelola admin) ---------- */
    publicPlans(all = false) { return Object.values(this.plans).filter((p) => all || p.visible) }
    cleanPlan(b, id) {
        const int = (v) => (v === null || v === '' || v === undefined ? null : Math.floor(Number(v)))
        const p = { id, tier: b.tier, name: String(b.name || '').trim(), daily: int(b.daily), maxIps: int(b.maxIps) ?? 0, customKey: !!b.customKey,
            baseDays: int(b.baseDays), basePrice: int(b.basePrice), permanentPrice: int(b.permanentPrice), visible: b.visible !== false }
        if (!['premium', 'vip'].includes(p.tier)) return fail(400, 'bad_plan', 'Tier harus premium atau vip.')
        if (!p.name || p.name.length > 40) return fail(400, 'bad_plan', 'Nama paket 1-40 karakter.')
        if (p.daily !== null && !(p.daily >= 1 && p.daily <= 10000000)) return fail(400, 'bad_plan', 'Limit harian kosong (unlimited) atau angka >= 1.')
        if (!(p.maxIps >= 0 && p.maxIps <= 100)) return fail(400, 'bad_plan', 'Maks IP 0-100.')
        const timed = p.basePrice !== null || p.baseDays !== null
        if (timed && !(p.basePrice >= 1000 && p.baseDays >= 1 && p.baseDays <= 365)) return fail(400, 'bad_plan', 'Harga acuan min. Rp1.000 dan hari acuan 1-365 (isi dua-duanya).')
        if (p.permanentPrice !== null && !(p.permanentPrice >= 1000)) return fail(400, 'bad_plan', 'Harga permanen min. Rp1.000.')
        if (!timed && p.permanentPrice === null) return fail(400, 'bad_plan', 'Isi harga berdurasi dan/atau harga permanen.')
        return p
    }
    adminPlans() {
        const users = Object.fromEntries(this.q('SELECT plan,COUNT(*) n FROM users WHERE plan IS NOT NULL GROUP BY plan').map((r) => [r.plan, r.n]))
        return { ok: true, plans: this.publicPlans(true).map((p) => ({ ...p, users: users[p.id] || 0 })) }
    }
    adminSavePlan(b, isNew) {
        const id = String(b.id || '').trim().toLowerCase()
        if (!/^[a-z0-9_-]{2,24}$/.test(id)) return fail(400, 'bad_plan', 'ID paket 2-24 karakter: huruf kecil, angka, _ atau -.')
        if (isNew && this.plans[id]) return fail(409, 'plan_exists', 'ID paket sudah ada.')
        if (!isNew && !this.plans[id]) return fail(404, 'not_found', 'Paket tidak ditemukan.')
        const p = this.cleanPlan(b, id)
        if (p.ok === false) return p
        if (isNew) this.sql.exec('INSERT INTO plans VALUES(?,?,?,?,?,?,?,?,?,?,?)', id, p.tier, p.name, p.daily, p.maxIps, p.customKey ? 1 : 0, p.baseDays, p.basePrice, p.permanentPrice, p.visible ? 1 : 0, Object.keys(this.plans).length)
        else this.sql.exec('UPDATE plans SET tier=?,name=?,daily=?,max_ips=?,custom_key=?,base_days=?,base_price=?,permanent_price=?,visible=? WHERE id=?',
            p.tier, p.name, p.daily, p.maxIps, p.customKey ? 1 : 0, p.baseDays, p.basePrice, p.permanentPrice, p.visible ? 1 : 0, id)
        this.loadPlans()
        return { ok: true, id }
    }
    adminDeletePlan(id) {
        if (!this.plans[id]) return fail(404, 'not_found', 'Paket tidak ditemukan.')
        if (this.q('SELECT 1 FROM users WHERE plan=? LIMIT 1', id).length) return fail(409, 'plan_in_use', 'Masih ada user di paket ini. Sembunyikan paketnya saja (nonaktifkan).')
        const t = this.setting('trial'); if (t?.plan === id) this.saveSetting('trial', { ...t, enabled: false })
        this.sql.exec('DELETE FROM codes WHERE plan=?', id); this.sql.exec('DELETE FROM plans WHERE id=?', id)
        this.loadPlans()
        return { ok: true }
    }

    /* ---------- claim trial ---------- */
    trialCfg() { return { enabled: false, plan: Object.keys(this.plans)[0] || null, days: 3, ...(this.setting('trial') || {}) } }
    trialStatus(uid, now) {
        const t = this.trialCfg(), plan = this.plans[t.plan], claim = this.q('SELECT * FROM trial_claims WHERE user_id=?', uid)[0]
        const active = this.pub(this.user(uid), now).active
        const reason = !t.enabled || !plan ? 'off' : claim ? 'claimed' : active ? 'has_plan' : null
        return { ok: true, enabled: !!(t.enabled && plan), plan_name: plan?.name || null, days: t.days, claimed: !!claim, claimed_at: claim?.at || null, can_claim: !reason, reason }
    }
    claimTrial(uid, ip, now) {
        const st = this.trialStatus(uid, now), t = this.trialCfg()
        if (st.reason === 'off') return fail(403, 'trial_off', 'Claim trial sedang tidak tersedia.')
        if (st.reason === 'claimed') return fail(409, 'trial_claimed', 'Kamu sudah pernah claim trial.')
        if (st.reason === 'has_plan') return fail(409, 'has_plan', 'Kamu masih punya paket aktif.')
        if (this.q('SELECT 1 FROM trial_claims WHERE ip=?', ip).length) return fail(409, 'trial_ip_used', 'IP ini sudah pernah dipakai claim trial akun lain.')
        this.applyPlan(this.user(uid), t.plan, t.days, now)
        this.sql.exec('INSERT INTO trial_claims VALUES(?,?,?,?,?)', uid, ip, t.plan, t.days, now)
        return { ok: true, name: this.plans[t.plan].name, days: t.days }
    }
    adminTrial() {
        return { ok: true, ...this.trialCfg(), claims: this.q('SELECT c.user_id,c.ip,c.plan,c.days,c.at,u.username FROM trial_claims c LEFT JOIN users u ON u.id=c.user_id ORDER BY c.at DESC LIMIT 50') }
    }
    adminSetTrial(b) {
        const days = Math.floor(Number(b.days)), plan = String(b.plan || '')
        if (!this.plans[plan]) return fail(400, 'bad_request', 'Paket trial tidak dikenal.')
        if (!(days >= 1 && days <= 365)) return fail(400, 'bad_request', 'Durasi trial 1-365 hari.')
        this.saveSetting('trial', { enabled: !!b.enabled, plan, days })
        return { ok: true }
    }
    adminResetClaim(uid) { this.sql.exec('DELETE FROM trial_claims WHERE user_id=?', uid); return { ok: true } }

    /* ---------- blokir IP ---------- */
    blockedList() { return { ok: true, ips: this.q('SELECT ip FROM blocked_ips').map((r) => r.ip) } }
    adminBlocked() {
        return { ok: true, blocked: this.q(`SELECT b.ip,b.reason,b.created_at,(SELECT GROUP_CONCAT(DISTINCT u.username) FROM seen_ips s JOIN users u ON u.id=s.user_id WHERE s.ip=b.ip) users
            FROM blocked_ips b ORDER BY b.created_at DESC LIMIT 200`) }
    }
    adminBlock(ip, reason, now) {
        const v = String(ip || '').trim().toLowerCase()
        if (!validIp(v)) return fail(400, 'bad_ip', 'Format IP salah.')
        this.sql.exec('INSERT INTO blocked_ips VALUES(?,?,?) ON CONFLICT(ip) DO UPDATE SET reason=excluded.reason', v, String(reason || '').slice(0, 200), now)
        return { ok: true, ip: v }
    }
    adminUnblock(ip) { this.sql.exec('DELETE FROM blocked_ips WHERE ip=?', String(ip).toLowerCase()); return { ok: true } }

    /* ---------- endpoint dinamis ---------- */
    epRow(r) { return { ...r, path: `/api/${r.category}/${r.slug}`, inputs: JSON.parse(r.inputs || '[]'), headers: JSON.parse(r.headers || '{}') } }
    listEndpoints() { return { ok: true, endpoints: this.q('SELECT * FROM endpoints ORDER BY category,slug').map((r) => this.epRow(r)) } }
    findEndpoint(category, slug) { const [r] = this.q('SELECT * FROM endpoints WHERE category=? AND slug=?', category, slug); return r ? { ok: true, endpoint: this.epRow(r) } : fail(404, 'not_found', 'Endpoint tidak ada.') }
    cleanEndpoint(b, builtin) {
        const e = { category: String(b.category || '').trim().toLowerCase(), slug: String(b.slug || '').trim().toLowerCase(), name: String(b.name || '').trim(),
            description: String(b.description || '').trim().slice(0, 300), method: String(b.method || 'GET').toUpperCase(), access: b.access || 'free',
            status: b.status === 'offline' ? 'offline' : 'online', mode: b.mode === 'json' ? 'json' : 'proxy', code: String(b.code || '').trim() }
        const ID = /^[a-z0-9_-]{1,30}$/
        if (!ID.test(e.category) || !ID.test(e.slug)) return fail(400, 'bad_endpoint', 'Kategori & slug 1-30 karakter: huruf kecil, angka, _ atau -.')
        if (['billing', 'auth', 'admin'].includes(e.category) || builtin.includes(`/api/${e.category}/${e.slug}`)) return fail(409, 'reserved', 'Path itu dipakai endpoint bawaan.')
        if (!e.name || e.name.length > 60) return fail(400, 'bad_endpoint', 'Nama fitur 1-60 karakter.')
        if (!['GET', 'POST'].includes(e.method)) return fail(400, 'bad_endpoint', 'Method GET atau POST.')
        if (!['free', 'premium', 'vip', 'owner'].includes(e.access)) return fail(400, 'bad_endpoint', 'Akses tidak valid.')
        if (!e.code) return fail(400, 'bad_endpoint', 'Kode wajib diisi.')
        if (e.code.length > 6000) return fail(400, 'bad_endpoint', 'Kode maksimal 6000 karakter.')
        if (e.mode === 'proxy' && !/^https:\/\/[^\s]+$/i.test(e.code)) return fail(400, 'bad_endpoint', 'Mode proxy: kode harus URL https:// (boleh pakai {url}, {username}, dst).')
        if (e.mode === 'json') { try { JSON.parse(e.code) } catch { return fail(400, 'bad_endpoint', 'Mode JSON: kode harus JSON valid.') } }
        let headers = b.headers ?? {}, inputs = b.inputs ?? []
        try { if (typeof headers === 'string') headers = JSON.parse(headers || '{}'); if (typeof inputs === 'string') inputs = JSON.parse(inputs || '[]') } catch { return fail(400, 'bad_endpoint', 'Headers/inputs bukan JSON valid.') }
        if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return fail(400, 'bad_endpoint', 'Headers harus objek JSON.')
        if (!Array.isArray(inputs) || inputs.length > 20) return fail(400, 'bad_endpoint', 'Input maksimal 20 field.')
        e.inputs = []
        for (const i of inputs) {
            const name = String(i.name || '').trim()
            if (!/^[A-Za-z_][A-Za-z0-9_]{0,30}$/.test(name)) return fail(400, 'bad_endpoint', `Nama input tidak valid: ${name || '(kosong)'}`)
            if (name.toLowerCase() === 'apikey' || e.inputs.some((x) => x.name === name)) return fail(400, 'bad_endpoint', `Nama input bentrok/ganda: ${name}`)
            e.inputs.push({ name, in: i.in === 'body' && e.method === 'POST' ? 'body' : 'query', required: !!i.required, example: String(i.example ?? '').slice(0, 200) })
        }
        e.headers = headers
        return e
    }
    adminSaveEndpoint(b, id, builtin, now) {
        const e = this.cleanEndpoint(b, builtin)
        if (e.ok === false) return e
        const dup = this.q('SELECT id FROM endpoints WHERE category=? AND slug=? AND id<>?', e.category, e.slug, id || 0)
        if (dup.length) return fail(409, 'endpoint_exists', 'Path itu sudah dipakai endpoint lain.')
        const vals = [e.category, e.slug, e.name, e.description, e.method, e.access, e.status, e.mode, e.code, JSON.stringify(e.headers), JSON.stringify(e.inputs)]
        if (id) {
            if (!this.q('SELECT 1 FROM endpoints WHERE id=?', id).length) return fail(404, 'not_found', 'Endpoint tidak ditemukan.')
            this.sql.exec('UPDATE endpoints SET category=?,slug=?,name=?,description=?,method=?,access=?,status=?,mode=?,code=?,headers=?,inputs=?,updated_at=? WHERE id=?', ...vals, now, id)
            return { ok: true, id, path: `/api/${e.category}/${e.slug}` }
        }
        const nid = this.sql.exec('INSERT INTO endpoints(category,slug,name,description,method,access,status,mode,code,headers,inputs,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id', ...vals, now, now).one().id
        return { ok: true, id: nid, path: `/api/${e.category}/${e.slug}` }
    }
    adminDeleteEndpoint(id) { this.sql.exec('DELETE FROM endpoints WHERE id=?', id); return { ok: true } }
}
