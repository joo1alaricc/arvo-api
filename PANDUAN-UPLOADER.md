# Konfigurasi Uploader (Cloudflare KV, tanpa kartu)

1. Buat namespace KV:  `npx wrangler login` lalu `npx wrangler kv namespace create UPLOADS`
   (atau dashboard: Storage & databases > KV > Create Instance, nama UPLOADS). Salin `id` yang muncul.
2. Buka `wrangler.toml`, ganti `GANTI_DENGAN_ID_KV` di blok `[[kv_namespaces]]` dengan id tadi.
3. Domain CDN: `routes` sudah berisi `cloud.arvo-api.my.id` (DNS dibuat otomatis saat deploy; domain utama harus di akun Cloudflare yang sama).
   Mau domain lain? Ubah `routes` DAN `CDN_BASE`. Tidak mau subdomain? Hapus entri routes ke-2 dan isi `CDN_BASE = ""` (link jadi /f/kode.ext).
4. Deploy: `npx wrangler deploy`
5. Tes: buka /uploader (Premium 1+/admin), pilih masa berlaku, unggah file.

Batas KV gratis: 1 GB total, 1.000 tulis/hari (1 upload atau 1 ubah-expired = 1 tulis), 100.000 baca/hari, 25 MB per file.
