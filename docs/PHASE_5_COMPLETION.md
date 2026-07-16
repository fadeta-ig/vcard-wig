# Laporan Penyelesaian Phase 5

Tanggal verifikasi: 15 Juli 2026  
Scope: vCard 3.0, public/admin download, Dynamic URL QR, direct-vCard QR, PNG/SVG, logo, export UI, cache, dan security validation  
Status implementasi: **SELESAI [VERIFIED]**

## 1. vCard 3.0

- Mapping `N`, `FN`, `ORG`, `TITLE`, `ROLE`, multiple `TEL`, `EMAIL`, structured `ADR`, `URL`, labelled social URLs, `NOTE`, dan `PHOTO`.
- Semua baris memakai CRLF.
- Backslash, newline, semicolon, dan comma di-escape satu kali.
- Folding maksimal 75 UTF-8 octet per physical line tanpa memotong karakter Unicode.
- Nomor mobile dan WhatsApp identik tidak diduplikasi.
- Field optional kosong tidak dibuat.
- Foto visibility-enabled dikonversi menjadi JPEG 160×160 dan disematkan sebagai base64 pada download `.vcf`.
- Direct-vCard QR memakai generator/source yang sama tetapi sengaja menghilangkan PHOTO sesuai kebijakan kepadatan QR pada PRD.

Endpoint:

- `GET /api/public/contacts/{slug}/vcard` — hanya ACTIVE pada Company aktif.
- `GET /api/admin/profiles/{id}/vcard` — membutuhkan session dan company authorization.

Response memakai `text/vcard; charset=utf-8`, filename `{slug}.vcf`, `nosniff`, content length, dan `private, no-store`.

## 2. QR generator

Jenis payload:

- Dynamic: `{APP_URL}/c/{slug}`. Pada produksi menjadi `https://vcard.wijayainovasi.co.id/c/{slug}` ketika runtime `APP_URL` produksi digunakan.
- Direct-vCard: payload vCard visibility-filtered tanpa foto.

Opsi tervalidasi:

- Format PNG dan SVG.
- Ukuran 256–2048 px.
- Margin/quiet zone 4–16 modul.
- Error correction L/M/Q/H; otomatis H saat logo aktif.
- Foreground/background strict `#RRGGBB` dengan contrast ratio minimal 4.5:1.
- Logo perusahaan opsional, maksimal sekitar 17% area, dengan clear background di pusat QR.

SVG hanya berasal dari generator server, diperiksa ulang agar tidak mengandung script, `foreignObject`, event handler, atau `javascript:`. Logo SVG di-embed sebagai PNG data URL yang dibuat ulang oleh Sharp.

## 3. Cache dan konsistensi

- Hasil QR memakai SHA-256 fingerprint dari payload, seluruh opsi, dan path logo.
- Cache adalah LRU in-process maksimal 100 output; restart process mengosongkan cache tanpa memengaruhi correctness.
- Perubahan data kontak tidak mengubah fingerprint Dynamic QR karena URL/slug tetap sama.
- Perubahan data yang tampil mengubah direct-vCard payload dan fingerprint secara otomatis.
- Slug yang sudah pernah dipublikasikan tetap dikunci oleh policy Phase 3.
- Response QR memakai ETag fingerprint dan `Cache-Control: private, no-store`; cache browser tidak menyebabkan preview stale.

## 4. Admin dan public UI

- Halaman `/admin/profiles/{id}/qr` dapat dibuka dari editor profil.
- Preview mendukung Dynamic/direct-vCard, PNG/SVG, ukuran, margin, error correction, warna, dan logo.
- File QR serta `.vcf` dapat diunduh langsung.
- Draft/Inactive/Archived menampilkan warning yang sesuai lifecycle.
- Tombol public "Simpan ke Kontak" sekarang mengunduh `.vcf` aktif, bukan placeholder.

## 5. Visibility dan authorization

- `showEmail`, `showPhone`, `showAddress`, `showSocialLinks`, `showPhoto`, social `isActive`, dan URL safety diterapkan sebelum generator.
- Field tersembunyi tidak berada dalam `.vcf` atau direct-vCard QR.
- Public vCard untuk Draft/Inactive/Archived dan Company nonaktif mengembalikan 404.
- QR/vCard admin memerlukan session valid dan memakai `getProfileForSession`, sehingga cross-company IDOR ditolak.
- Tidak ada event atau alamat IP yang ditulis pada Phase 5; analytics tetap Phase 6.

## 6. Evidence otomatis

Quality gate sebelum dokumentasi:

- ESLint: PASS.
- TypeScript strict: PASS.
- Vitest: **12 test file, 50/50 tests PASS**.
- Production build: PASS.

Test coverage Phase 5:

- Golden vCard lengkap, one-word/Unicode name, escaping, CRLF, 75-octet folding, partial address, phone deduplication, empty fields, photo policy, dan visibility.
- QR PNG round-trip decode pada L/M/Q/H.
- PNG dan SVG round-trip dengan logo; H dipaksa otomatis.
- Direct-vCard QR decode identik dengan payload generator.
- Cache HIT/MISS, Dynamic stability, dan direct invalidation.
- Contrast, size, format, unknown option, margin, logo availability, status, dan public lifecycle.

Production HTTP smoke pada `next start`, Windows localhost, dan `vcard_wig_test`:

| Pemeriksaan | Hasil |
|---|---|
| Login dan admin QR page | 200 / 200 |
| Public/admin vCard | 200 / 200 |
| Draft public vCard | 404 |
| QR tanpa session | 401 |
| PNG | Signature `89504E470D0A1A0A` |
| In-process cache | MISS → HIT |
| SVG | Valid dan tidak mengandung script/`javascript:` |
| Contrast/margin/logo invalid | 422 / 422 / 422 |
| Update profil | Dynamic ETag tetap; direct ETag berubah; public vCard langsung fresh |

## 7. External acceptance boundary

Decode QR sudah diverifikasi secara otomatis pada output PNG/SVG dengan dan tanpa logo. Import manual pada perangkat Android/iOS, Outlook, dan Google Contacts memerlukan perangkat/aplikasi eksternal; status dan prosedur bukti tercatat di `docs/PHASE_5_DEVICE_UAT.md`. Hasil tidak boleh disebut PASS sebelum operator UAT mengisi matriks tersebut.
