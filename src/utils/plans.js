/* Semua paket ada di sini. Ubah harga/limit cukup lewat file ini.
 * daily: null = unlimited | baseDays+basePrice = harga acuan (dihitung proporsional per hari)
 * permanentPrice = harga permanen (kalau ada) */
export const PLANS = {
    premium1: { tier: 'premium', name: 'Premium 1', daily: 1000, maxIps: 3, customKey: false, baseDays: 14, basePrice: 5000 },
    premium2: { tier: 'premium', name: 'Premium 2', daily: 2000, maxIps: 5, customKey: true, baseDays: 30, basePrice: 10000 },
    premium3: { tier: 'premium', name: 'Premium 3', daily: null, maxIps: 5, customKey: true, permanentPrice: 25000 },
    vip1: { tier: 'vip', name: 'VIP 1', daily: 5000, maxIps: 10, customKey: true, baseDays: 14, basePrice: 20000 },
    vip2: { tier: 'vip', name: 'VIP 2', daily: 7000, maxIps: 12, customKey: true, baseDays: 30, basePrice: 30000 },
    vip3: { tier: 'vip', name: 'VIP 3', daily: null, maxIps: 15, customKey: true, permanentPrice: 50000 },
}

export const MIN_DAYS = 1
export const MAX_DAYS = 365

export const quote = (id, { days, permanent } = {}) => {
    const p = PLANS[id]
    if (!p) throw new Error('Paket tidak dikenal.')
    if (permanent) {
        if (!p.permanentPrice) throw new Error(`${p.name} tidak tersedia permanen.`)
        return { amount: p.permanentPrice, days: null }
    }
    if (!p.basePrice) throw new Error(`${p.name} hanya tersedia permanen.`)
    const d = Math.floor(Number(days))
    if (!(d >= MIN_DAYS && d <= MAX_DAYS)) throw new Error(`Durasi harus ${MIN_DAYS}-${MAX_DAYS} hari.`)
    return { amount: Math.max(1000, Math.ceil((p.basePrice * d) / p.baseDays / 100) * 100), days: d }
}

/* Hari berganti jam 00:00 WIB */
export const jakartaDay = (now) => new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10)
