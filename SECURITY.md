# Keamanan Arvo API

## Yang sudah aktif di kode
| Lapisan | Perlindungan |
|---|---|
| `src/utils/shield.js` (paling awal) | Limit per IP/menit: login/daftar 20, admin/billing/tools 150, API 300, web 240. Lewat batas 3 menit berbeda atau banjir >4x limit = ban 15 menit (balasan murah, tanpa DB). Tolak method aneh, URL >4 KB, path `..`/null byte, body >1 MB. Anti-CSRF (Origin harus sama untuk POST/PUT/DELETE ke rute akun). IP owner dikecualikan. |
| Login/daftar/admin-login | Throttle per IP + per akun, PBKDF2 100k, Turnstile opsional. |
| Auto-blokir | IP dengan ≥40 pelanggaran (key salah, IP tak terdaftar, tier) dalam 10 menit masuk daftar blokir (bisa dibuka di Admin). |
| Header | CSP, HSTS, nosniff, frame-ancestors, Referrer-Policy, Permissions-Policy (Worker + `public/_headers` untuk file statis). |
| CORS | Terbuka hanya untuk API publik. `/api/auth|admin|billing|tools` tidak bisa dibaca lintas-origin. |
| Rahasia | Webhook & access key dibandingkan waktu-konstan. `OWNER_ACCESS_KEY` hanya lewat `wrangler secret`. |

Catatan jujur: pembatas di Worker hidup di memori tiap isolate, jadi bukan pengganti aturan di edge Cloudflare. DDoS volumetrik diserap Cloudflare; yang di atas menahan serangan level aplikasi.

## Wajib kamu atur di dashboard Cloudflare (tidak bisa lewat kode)
1. **Security > Settings**: Security Level = High; aktifkan **Bot Fight Mode** (atau Super Bot Fight Mode), **Browser Integrity Check**.
2. **Security > WAF > Rate limiting rules** (ini yang paling kuat, jalan di edge sebelum Worker):
   - `URI Path` mulai `/api/auth/` → 10 request / 1 menit per IP → Block 10 menit.
   - `URI Path` mulai `/api/` → 120 request / 10 detik per IP → Managed Challenge 10 menit.
   - Seluruh situs → 300 request / 1 menit per IP → Managed Challenge.
3. **Security > WAF > Managed rules**: aktifkan Cloudflare Managed Ruleset + OWASP Core.
4. **Saat diserang**: Security > Settings > **Under Attack Mode** = ON (tantangan JS untuk semua pengunjung), matikan lagi setelah reda.
5. **Turnstile**: buat widget, isi `TURNSTILE_SITE_KEY` di `wrangler.toml`, lalu `npx wrangler secret put TURNSTILE_SECRET`.
6. **Lindungi `/admin.html` dengan Cloudflare Access** (Zero Trust, gratis sampai 50 user): hanya email adminmu yang bisa membuka panel.
7. **Secret**: `wrangler secret put OWNER_ACCESS_KEY` (kunci panjang acak). Putar ulang bila pernah bocor. Jangan taruh secret di `[vars]`.
8. **Tips**: Cloudflare Dashboard > Notifications > aktifkan notifikasi DDoS & lonjakan trafik.
