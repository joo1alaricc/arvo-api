/* OTP email verifikasi — stateless (tidak perlu KV/DB tambahan).
 * Kode 6 digit diturunkan dari HMAC-SHA256(OTP_SECRET, email + exp), jadi server tidak
 * perlu menyimpan apa pun: cukup verifikasi ulang HMAC-nya saat /auth/register dipanggil.
 * otp_token yang dikirim ke klien berisi {email, exp} + tanda tangannya (sig), BUKAN kodenya,
 * supaya kode OTP tidak pernah terlihat di jaringan selain lewat email tujuan. */
const OTP_TTL_MS = 10 * 60 * 1000 // 10 menit
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64uToBuf = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0))

const hmacKey = async (secret) => crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])

const sign = async (secret, msg) => b64u(await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(msg)))

/* Kode 6 digit diturunkan dari tanda tangan HMAC lain (konteks "code") supaya tidak bisa dibalik dari otp_token. */
const deriveCode = async (secret, email, exp) => {
    const sig = await sign(secret, 'code:' + email.toLowerCase() + ':' + exp)
    const n = new DataView(b64uToBuf(sig).buffer).getUint32(0) % 1000000
    return String(n).padStart(6, '0')
}

export const createOtp = async (env, email) => {
    const secret = env.OTP_SECRET
    if (!secret) return null
    const exp = Date.now() + OTP_TTL_MS
    const code = await deriveCode(secret, email, exp)
    const sig = await sign(secret, 'tok:' + email.toLowerCase() + ':' + exp)
    const otp_token = b64u(new TextEncoder().encode(JSON.stringify({ email, exp }))) + '.' + sig
    return { code, otp_token, exp }
}

export const verifyOtp = async (env, { email, code, otp_token }) => {
    const secret = env.OTP_SECRET
    if (!secret || !otp_token || !code) return false
    const [payloadB64, sig] = String(otp_token).split('.')
    if (!payloadB64 || !sig) return false
    let payload
    try { payload = JSON.parse(new TextDecoder().decode(b64uToBuf(payloadB64))) } catch { return false }
    if (!payload || String(payload.email || '').toLowerCase() !== String(email || '').toLowerCase()) return false
    if (Date.now() > Number(payload.exp)) return false
    const expectSig = await sign(secret, 'tok:' + payload.email.toLowerCase() + ':' + payload.exp)
    if (expectSig !== sig) return false
    const expectCode = await deriveCode(secret, payload.email, payload.exp)
    return expectCode === String(code).trim()
}

/* Token "email sudah terverifikasi" — dipakai supaya setelah OTP benar, langkah berikutnya (pilih
 * username) tidak perlu minta kode lagi. Berlaku 15 menit, cukup untuk mengisi username. */
const VERIFIED_TTL_MS = 15 * 60 * 1000
export const createVerifiedToken = async (env, email) => {
    const secret = env.OTP_SECRET
    const exp = Date.now() + VERIFIED_TTL_MS
    const sig = await sign(secret, 'verified:' + email.toLowerCase() + ':' + exp)
    return b64u(new TextEncoder().encode(JSON.stringify({ email, exp }))) + '.' + sig
}
export const checkVerifiedToken = async (env, { email, verified_token }) => {
    const secret = env.OTP_SECRET
    if (!secret || !verified_token) return false
    const [payloadB64, sig] = String(verified_token).split('.')
    if (!payloadB64 || !sig) return false
    let payload
    try { payload = JSON.parse(new TextDecoder().decode(b64uToBuf(payloadB64))) } catch { return false }
    if (!payload || String(payload.email || '').toLowerCase() !== String(email || '').toLowerCase()) return false
    if (Date.now() > Number(payload.exp)) return false
    const expectSig = await sign(secret, 'verified:' + payload.email.toLowerCase() + ':' + payload.exp)
    return expectSig === sig
}

/* Kirim via Gmail API (akun Gmail biasa, bukan layanan email pihak ketiga, tidak perlu verifikasi domain).
 * Butuh secret: GOOGLE_CLIENT_SECRET (punya client OAuth yang sama dengan GOOGLE_CLIENT_ID) dan GMAIL_REFRESH_TOKEN.
 * Var: GMAIL_SENDER = alamat Gmail pengirim (mis. "Arvo API <noreply@gmail.com>").
 * Cara dapat GMAIL_REFRESH_TOKEN ada di komentar wrangler.toml / penjelasan chat. */
const b64uEnc = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const gmailAccessToken = async (env) => {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GMAIL_REFRESH_TOKEN) return null
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            refresh_token: env.GMAIL_REFRESH_TOKEN,
            grant_type: 'refresh_token',
        }),
    })
    const j = await res.json().catch(() => ({}))
    return res.ok ? j.access_token : null
}

export const sendOtpEmail = async (env, email, code) => {
    const token = await gmailAccessToken(env)
    if (!token) throw new Error('email_not_configured')
    const from = env.GMAIL_SENDER || 'Arvo API <noreply@gmail.com>'
    const subject = 'Kode verifikasi Arvo API'
    const html = `<p>Kode verifikasi akun Arvo API kamu:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>Berlaku 10 menit. Abaikan email ini jika kamu tidak meminta kode ini.</p>`
    const raw = [
        `From: ${from}`,
        `To: ${email}`,
        `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset="UTF-8"',
        '',
        html,
    ].join('\r\n')
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: b64uEnc(raw) }),
    })
    if (!res.ok) throw new Error('email_send_failed')
}
