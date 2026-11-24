# Keamanan Arvo API

## Yang sudah aktif di kode
| Lapisan | Perlindungan |
|---|---|
| `src/utils/shield.js` (paling awal) | Limit per IP/menit (default: login/daftar 20, admin/billing/tools 150, API 300, web 240, file statis 1200). IP yang melewati batas beberapa kali atau banjir = **diblokir otomatis** dan masuk daftar di Admin > Blokir IP. Tolak method aneh, URL >4 KB, path `..`/null byte, body >1 MB. Anti-CSRF (Origin harus sama untuk POST/PUT/DELETE ke rute akun). **IP owner dan IP/akun admin tidak pernah kena limit atau auto-blokir.** |
| Login/daftar/admin-login | Throttle per IP + per akun, PBKDF2 100k, Turnstile opsional. |
| Auto-blokir | Dua pemicu: (1) melewati limit permintaan (lihat di atas), (2) IP menumpuk pelanggaran akses (key salah, IP tak terdaftar, tier). Semua angka (limit, jumlah pelanggaran, pengali banjir, lama blokir, 0 = permanen) **diatur di Dashboard Admin > Blokir IP > Auto-blokir** (simpan hanya super admin). Daftar blokir bisa dibuka satu per satu dari tab yang sama. |
| Header | CSP, HSTS, nosniff, frame-ancestors, Referrer-Policy, Permissions-Policy (Worker + `public/_headers` untuk file statis). |
| CORS | Terbuka hanya untuk API publik. `/api/auth|admin|billing|tools` tidak bisa dibaca lintas-origin. |
| Rahasia | Webhook & access key dibandingkan waktu-konstan. `OWNER_ACCESS_KEY` hanya lewat `wrangler secret`. |

Catatan jujur: pembatas di Worker hidup di memori tiap isolate, jadi bukan pengganti aturan di edge Cloudflare. DDoS volumetrik diserap Cloudflare; yang di atas menahan serangan level aplikasi.

## Panel Pterodactyl (Tools > Panel Pterodactyl, `/pterodactyl`)
Setup (sekali):
1. Deploy, lalu buka **Admin > Pterodactyl**: isi domain panel (https), Application API key (`ptla_`), dan Client API key (`ptlc_`, **wajib dari akun root admin**). Klik **Tes koneksi**, pilih Nest, Egg, Lokasi, lalu Simpan. Kunci disimpan di database server dan tidak pernah dikirim balik ke browser.
2. Pastikan lokasi punya node dengan alokasi port kosong, node memakai SSL (wss), dan egg tidak punya variabel *required* tanpa nilai bawaan (kalau ada, isi di kolom JSON environment).
3. Nyalakan di **Admin > Layanan > Panel Pterodactyl** (default mati). Pembayaran memakai BTZPay yang sama dengan deposit (`BTZPAY_APIKEY`, `BTZPAY_CALLBACK_TOKEN`).

Keamanan & perilaku:
- Browser tidak pernah menerima kunci panel, domain panel, alamat node, UUID server, atau token konsol. Semua lewat server Arvo; konsol live dijembatani (WebSocket) dan hanya meneruskan perintah/power/log yang aman.
- Setiap aksi dicek: server milik user yang login, masih aktif, belum lewat masa aktif. Harga dihitung di server; pembayaran dikonfirmasi ulang ke BTZPay (isi callback tidak dipercaya) dan server dibuat **sekali saja** (klaim atomik, `external_id` unik) walau callback, polling, dan cron datang bersamaan.
- Cron tiap 15 menit: server habis masa aktif otomatis **ditangguhkan**, lalu **dihapus setelah masa tenggang** (default 3 hari, atur di admin; data user hilang saat dihapus). Pembuatan yang gagal karena panel down diulang otomatis (maks 6x) dan bisa diulang manual dari admin.
- Unggah file maks 25 MB per file (diteruskan streaming ke node, tidak disimpan di Arvo). Hanya rute unggah itu yang memakai batas body lebih besar dari 1 MB.

## Wajib kamu atur di dashboard Cloudflare (tidak bisa lewat kode)
1. **Security > Settings**: Security Level = High; aktifkan **Bot Fight Mode** (atau Super Bot Fight Mode), **Browser Integrity Check**.
2. **Security > WAF > Rate limiting rules** (ini yang paling kuat, jalan di edge sebelum Worker):
   - `URI Path` mulai `/api/auth/` → 10 request / 1 menit per IP → Block 10 menit.
   - `URI Path` mulai `/api/` → 120 request / 10 detik per IP → Managed Challenge 10 menit.
   - Seluruh situs → 300 request / 1 menit per IP → Managed Challenge.
3. **Security > Bots**: aktifkan **Block AI Scrapers and Crawlers** (gratis), lalu Bot Fight Mode. Pastikan *Verified Bots* (Google/Bing) tetap diizinkan.
   **Security > WAF > Managed rules**: aktifkan Cloudflare Managed Ruleset + OWASP Core.
4. **Saat diserang**: Security > Settings > **Under Attack Mode** = ON (tantangan JS untuk semua pengunjung), matikan lagi setelah reda.
5. **Turnstile**: buat widget, isi `TURNSTILE_SITE_KEY` di `wrangler.toml`, lalu `npx wrangler secret put TURNSTILE_SECRET`.
6. **Lindungi `/admin.html` dengan Cloudflare Access** (Zero Trust, gratis sampai 50 user): hanya email adminmu yang bisa membuka panel.
7. **Secret**: `wrangler secret put OWNER_ACCESS_KEY` (kunci panjang acak). Putar ulang bila pernah bocor. Jangan taruh secret di `[vars]`.
8. **Tips**: Cloudflare Dashboard > Notifications > aktifkan notifikasi DDoS & lonjakan trafik.
