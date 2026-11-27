# Konfigurasi Uploader (Cloudflare KV, tanpa kartu)

1. Buat namespace KV:  `npx wrangler login` lalu `npx wrangler kv namespace create UPLOADS`
   (atau dashboard: Storage & databases > KV > Create Instance, nama UPLOADS). Salin `id` yang muncul.
2. Buka `wrangler.toml`, ganti `GANTI_DENGAN_ID_KV` di blok `[[kv_namespaces]]` dengan id tadi.
3. Domain CDN: `routes` sudah berisi `cloud.arvo-api.my.id` (DNS dibuat otomatis saat deploy; domain utama harus di akun Cloudflare yang sama).
   Mau domain lain? Ubah `routes` DAN `CDN_BASE`. Tidak mau subdomain? Hapus entri routes ke-2 dan isi `CDN_BASE = ""` (link jadi /f/kode.ext).
4. Deploy: `npx wrangler deploy`
5. Tes: buka /uploader (Premium 1+/admin), pilih masa berlaku, unggah file.

Batas KV gratis: 1 GB total, 1.000 tulis/hari (1 upload atau 1 ubah-expired = 1 tulis), 100.000 baca/hari, 25 MB per file.

## Endpoint API: POST /api/upload (Premium ke atas, wajib API key)
Respons sukses:
{ "status": true, "author": "Arvo - Endpoint", "result": { "id", "key", "name", "size", "mime", "url", "expires_at" }, "timestamp": "...", "response_time": "123ms" }

ttl: detik atau 30m, 12h, 7d, 2w, 1y; 0 = permanen; tanpa ttl = 30 hari.

# 1) Kirim file (multipart)
curl -X POST "https://arvo-api.my.id/api/upload" -H "x-api-key: KEY_KAMU" -F "file=@foto.jpg" -F "expired=7d"
# 2) Body mentah
curl -X POST "https://arvo-api.my.id/api/upload?name=foto.jpg&expired=0" -H "x-api-key: KEY_KAMU" --data-binary @foto.jpg
# 3) Unggah ulang dari URL
curl -X POST "https://arvo-api.my.id/api/upload" -H "x-api-key: KEY_KAMU" -H "Content-Type: application/json" -d '{"url":"https://example.com/a.jpg","expired":"30d"}'

## Catatan Sinkronisasi Endpoint
- File endpoint WAJIB ada di `src/api/<kategori>/<slug>.js` supaya terdeteksi. Endpoint upload sekarang di `src/api/tools/upload.js`
  (sebelumnya `src/api/upload.js`, di luar folder kategori, jadi Sinkronisasi tidak pernah melihatnya).
- Alamat publiknya tetap `POST /api/upload` (bukan /api/tools/upload, karena itu dipakai halaman Uploader yang login lewat sesi).
- Sinkronisasi hanya mengubah `src/api/index.js` di GitHub. Endpoint baru aktif setelah deploy selesai.
