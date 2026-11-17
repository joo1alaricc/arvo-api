# YEMO API

> **High-Performance. Scalable. Neo-Brutalist.**
> *Built with Hono, Node.js, and a focus on Developer Experience.*

---

## CORE FEATURES

| Feature | Description |
| :--- | :--- |
| **Ultrafast** | Powered by `Hono` + `Node.js` for low latency. |
| **Neo-Swagger** | Custom-designed API Portal (Not your boring swagger). |
| **Productivity** | Built-in Code Snippets (cURL, Fetch, Python). |
| **Accessibility** | Bookmarking (Favorites) & Precise Deep Linking. |
| **Fortified** | Built-in Rate Limiting, IP Whitelist & Ban System. |
| **Cluster Mode** | Auto-scales to use all available CPU cores. |
| **Type-Safe** | Full validation using `Zod` & `OpenAPI`. |
| **Modular** | Clean architecture for easy scalability. |

---

## PORTAL FEATURES

Our custom UI is designed for high-performance development workflows.

| Feature | Functionality |
| :--- | :--- |
| **Favorites (⭐)** | Bookmarks endpoints with LocalStorage persistence. |
| **Code Snippets** | Real-time generation for cURL, Fetch, and Python. |
| **Spec Download** | One-click download of the `openapi.json` definition. |
| **Accordion UX** | Auto-collapses other endpoints for focused debugging. |
| **Deep Link v2** | Precision hash routing (e.g., `#/get/api/stats`). |
| **Copy Feedback** | Instant "COPIED!" visual confirmation on all actions. |

---

## QUICK START

### 1. Clone & Install

```bash
git clone https://github.com/yemo-dev/API.git
cd API
npm install
```

### 2. Run Server

```bash
npm run dev
```

> **Note:** To run in **Cluster Mode** (multi-core support), use:
>
> ```bash
> npm run dev:cluster
> ```
>
> Access Portal: **<http://localhost:3000>**

---

## API ENDPOINTS

| Method | Endpoint | Description | Status Config |
| :--- | :--- | :--- | :--- |
| `GET` | **/api/stats** | System CPU, RAM, Network info. | `x-status` |

> *Check endpoint status availability in their respective route files.*

---

## SECURITY SYSTEM

We take security seriously. This API includes a robust protection layer within `src/utils/rateLimit.js`.

| System | Default Config | Effect on Breach |
| :--- | :--- | :--- |
| **Rate Limiter** | `100 req` / `15 min` | **429** Neo-Brutalist Page |
| **IP Whitelist** | Unlimited Access | Bypasses all limits |
| **IP Ban List** | Permanent Block | **403** Access Denied Page |

> **UI Note:** Error pages are located in `public/errors/` and feature a custom premium design.

---

## DEVELOPER GUIDE

### Adding a New Endpoint

 We use a specific pattern to ensure **Offline/Online** status checks work automatically.

**1. Create Route File**
`src/api/example/routes.js`

```javascript
import { createRoute, z } from '@hono/zod-openapi'

export const myRoute = createRoute({
    method: 'get',
    path: '/api/example',
    description: 'My cool endpoint',
    'x-status': 'ONLINE', // Config Status Here
    responses: { ... }
})

export const myHandler = (c) => c.json({ hello: 'world' })
```

**2. Register in `src/api/index.js`**
> **IMPORTANT:** Add your route and handler to the `setupRoutes` function.

```javascript
import { myRoute, myHandler } from './example/routes.js'
import { register } from '../utils/route.js'

export const setupRoutes = (app) => {
    // ... existing registers
    register(app, myRoute, myHandler)
}
```

---

## PROJECT STRUCTURE

```
API/
├── public/
│   └── errors/       # Custom 403, 404, 429, 500 Pages
├── src/
│   ├── api/          # Route Logic
│   │   ├── stats/    # Stats endpoint logic
│   │   └── index.js  # Centralized Route Setup
│   ├── utils/        # Security & Helpers (RateLimit, Logger)
│   └── index.js      # Main Entry Point (Server & Cluster)
└── package.json
```

---

<p align="center">
  <b>Built by YeMo Dev</b>
</p>

---

## AKUN, PREMIUM / VIP & PEMBAYARAN

- Halaman: `/` (landing), `/dashboard.html` (statistik publik: total request, endpoint, uptime, user, grafik 14 hari), `/login.html`, `/profile.html`, `/playground.html`, `/admin.html`.
- Akun: username + password (PBKDF2), atau Google (isi `GOOGLE_CLIENT_ID` di `wrangler.toml`). Tiap akun dapat API key.
- Login Google memakai mode redirect (tanpa popup). Di Google Cloud Console > Credentials > OAuth client (Web), isi:
  - Authorized JavaScript origins: `https://DOMAIN-KAMU` (dan `http://localhost:8787` untuk dev)
  - Authorized redirect URIs: `https://DOMAIN-KAMU/api/auth/google/callback` (dan versi localhost untuk dev)
- Foto profil diunggah dari file (disimpan kecil di database). Foto Google otomatis dipakai saat pertama masuk.
- Video hero beranda: taruh file di `public/media/hero.mp4` lalu atur `HERO_VIDEO` di `wrangler.toml` (kosongkan untuk mematikan).
- Owner: isi `OWNER_IPS` dengan IP publikmu. Dari IP itu: request unlimited dan `/admin.html` bisa dibuka tanpa login.
- Paket diatur di `src/utils/plans.js`. Semua akun (member/premium/vip/owner) bisa beli.
  - **Premium** (1-3): limit harian selalu terbatas (1.000 / 2.000 / 3.000 per hari), tidak ada unlimited. Premium 3 permanen.
  - **VIP** (1-3): VIP 1 = 10.000/hari, VIP 2 & VIP 3 = unlimited. Hanya VIP yang bisa akses endpoint khusus VIP, slot IP lebih banyak (10-15), badge gold, dan border profil custom.
  - Seed ini hanya terpakai saat database baru. Untuk database yang sudah jalan, ubah lewat Admin > Paket.
- Pembayaran: QRIS statis (`QRIS_IMAGE_URL`) diubah jadi dinamis via `qris-swap` dengan kode unik.
  Konfirmasi otomatis: `POST /api/billing/webhook` + `Authorization: Bearer <PAYMENT_WEBHOOK_SECRET>`, body `{"amount": 5037}`.
  Atau manual dari Admin > Order.
- Setup: `npm install`, `wrangler secret put PAYMENT_WEBHOOK_SECRET`, `npm run deploy`.


---

## Update dashboard (Arvo)

- **Limit hanya berkurang saat endpoint dipanggil.** Middleware global hanya mengenali IP/owner/blokir; kuota (IP gratis & harian key) dihitung di `meter()` ketika endpoint API benar-benar diakses. `/docs`, `/health`, favicon, halaman, dan `/api/auth|billing|admin` tidak memakan limit.
- **Admin → Paket**: tambah/edit/hapus/sembunyikan paket (tersimpan di DB, seed awal dari `src/utils/plans.js`).
- **Admin → Claim trial**: atur aktif/nonaktif, paket, dan durasi. Satu kali per akun dan per IP. User claim dari Profil → Events.
- **Admin → Blokir IP** + kolom IP (daftar, terakhir, riwayat IP + hit) di daftar user. Tombol blokir tersedia per IP.
- **Admin → Endpoint**: nama fitur, kategori/slug, method, akses (gratis/premium/VIP/owner), mode, kode, input (`url`, `username`, dst), tes, hapus, online/offline.
  Cloudflare Workers melarang `eval`/`new Function`, jadi "kode" berupa konfigurasi: `proxy` (URL upstream https dengan `{input}`) atau `json` (template respons).
- Playground: kolom `apikey` ada di setiap endpoint (mengikuti gaya BetaBotz), key otomatis disinkronkan antar endpoint.

---

## DASHBOARD ADMIN: GITHUB, UPDATE ZIP, ENDPOINT KODE, MEDIA

**Setup sekali (super admin = IP di `OWNER_IPS`)**
1. `wrangler.toml` → isi `GITHUB_REPO = "pemilik/nama-repo"` (dan `GITHUB_BRANCH`).
2. `wrangler secret put GITHUB_API` → token GitHub (fine-grained: Contents *Read and write*, opsional Actions *Read*).
3. Auto-deploy: pakai Cloudflare Workers Builds (Connect to Git). Tidak perlu GitHub Actions.
4. Deploy manual sekali (`npm run deploy`), lalu semua perubahan berikutnya bisa dari dashboard.

**Tab baru**: Update web (ZIP → diff → commit satu per satu, file main terakhir), Endpoint (bagian "Endpoint kode"), Media, Pembayaran (QRIS), Tim admin.

**Hak akses**: super admin (owner) boleh semuanya. Admin tambahan (tab Tim) tidak bisa menambah admin, menambah/ubah endpoint, atau update kode.

**Endpoint kode** dibuat sebagai `src/api/<kategori>/<slug>.js` (createRoute + handler, struktur sama dengan endpoint bawaan) dan didaftarkan otomatis di `src/api/index.js`.


## User-Agent untuk request ke API lain

Semua `fetch()` keluar dari Worker (endpoint bawaan, endpoint proxy buatan admin, dan kode endpoint sendiri) otomatis memakai User-Agent browser
(`src/utils/upstream.js`), karena banyak API menolak User-Agent bawaan Cloudflare Workers. Header yang kamu isi sendiri selalu menang.
Untuk mengganti UA bawaan, tambahkan variabel `UPSTREAM_UA` (mis. di `[vars]` pada `wrangler.toml`).
Catatan: kalau upstream memblokir IP Cloudflare itu sendiri, UA saja tidak cukup.

## Layar pembuka & popup (beranda)

- `public/splash.js` + blok `#splash` di `index.html`: layar pembuka, tampil saat web dibuka/di-refresh (bukan saat pindah dari halaman lain di situs).
- `public/welcome.js`: popup sambutan, `POPUP_DELAY` ms setelah splash selesai, `POPUP_ONCE = false` = muncul tiap refresh.
