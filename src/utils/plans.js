/* Paket bawaan (seed awal). Setelah pertama kali jalan, paket dikelola dari dashboard admin (tabel `plans`).
 * daily: null = unlimited | baseDays+basePrice = harga acuan (proporsional per hari) | permanentPrice = harga permanen */
export const DEFAULT_PLANS = [
    /* PREMIUM: limit harian selalu terbatas (tidak ada unlimited), cocok untuk pemakaian pribadi/proyek kecil. */
    { id: 'premium1', tier: 'premium', name: 'Premium 1', daily: 1000, maxIps: 3, customKey: false, baseDays: 14, basePrice: 5000, permanentPrice: null },
    { id: 'premium2', tier: 'premium', name: 'Premium 2', daily: 2000, maxIps: 5, customKey: true, baseDays: 30, basePrice: 10000, permanentPrice: null },
    { id: 'premium3', tier: 'premium', name: 'Premium 3', daily: 3000, maxIps: 5, customKey: true, baseDays: null, basePrice: null, permanentPrice: 25000 },
    /* VIP: satu-satunya yang punya request unlimited + endpoint khusus VIP + IP lebih banyak + border custom. */
    { id: 'vip1', tier: 'vip', name: 'VIP 1', daily: 10000, maxIps: 10, customKey: true, baseDays: 14, basePrice: 25000, permanentPrice: null },
    { id: 'vip2', tier: 'vip', name: 'VIP 2', daily: null, maxIps: 12, customKey: true, baseDays: 30, basePrice: 40000, permanentPrice: null },
    { id: 'vip3', tier: 'vip', name: 'VIP 3', daily: null, maxIps: 15, customKey: true, baseDays: null, basePrice: null, permanentPrice: 100000 },
]

export const MIN_DAYS = 1
export const MAX_DAYS = 365

/* p = objek paket dari store (this.plans[id]) */
export const quote = (p, { days, permanent } = {}) => {
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
