# Phase 5 Device and Contact-App UAT Matrix

Tanggal penyusunan: 15 Juli 2026  
Tujuan: bukti scan QR dan impor vCard pada perangkat/aplikasi target nyata  

## Automated baseline

| Pemeriksaan | Hasil |
|---|---|
| Decode Dynamic PNG pada L/M/Q/H | **PASS [VERIFIED]** melalui `jsQR` |
| Decode Dynamic PNG berlogo, correction H | **PASS [VERIFIED]** |
| Decode Dynamic SVG berlogo, correction H | **PASS [VERIFIED]** setelah render SVG ke raster |
| Decode direct-vCard PNG | **PASS [VERIFIED]**; hasil identik dengan payload generator |
| vCard CRLF, escaping, Unicode, 75-octet folding | **PASS [VERIFIED]** melalui golden/unit tests |
| PHOTO download | **PASS [VERIFIED]** sebagai JPEG base64 160×160 |
| Direct QR photo policy | **PASS [VERIFIED]**; PHOTO tidak dimasukkan |

## Physical-device UAT

Baris berikut membutuhkan perangkat/aplikasi eksternal yang tidak tersedia di workspace development. Status ini tidak mengurangi kelengkapan implementasi, tetapi tidak boleh dinyatakan PASS sebelum bukti fisik dicatat.

| Target | Skenario | Status | Bukti yang harus dicatat |
|---|---|---|---|
| Android modern | Scan Dynamic PNG tanpa logo | PENDING PHYSICAL UAT | Model, OS, aplikasi kamera, screenshot hasil |
| Android modern | Scan Dynamic PNG/SVG berlogo | PENDING PHYSICAL UAT | Model, OS, waktu scan, screenshot |
| iPhone modern | Scan Dynamic PNG tanpa logo | PENDING PHYSICAL UAT | Model, iOS, screenshot hasil |
| iPhone modern | Scan Dynamic PNG/SVG berlogo | PENDING PHYSICAL UAT | Model, iOS, waktu scan, screenshot |
| Android Contacts | Download dan impor `.vcf` | PENDING PHYSICAL UAT | Field nama/ORG/TITLE/TEL/EMAIL/ADR/URL/PHOTO |
| iOS Contacts | Download dan impor `.vcf` | PENDING PHYSICAL UAT | Field nama/ORG/TITLE/TEL/EMAIL/ADR/URL/PHOTO |
| Microsoft Outlook | Impor `.vcf` | PENDING APP UAT | Versi Outlook dan hasil mapping |
| Google Contacts | Impor `.vcf` | PENDING APP UAT | Browser/versi dan hasil mapping |

## Acceptance procedure

1. Gunakan satu profil ACTIVE dengan dua telepon, email, alamat dua baris, website, satu social link, bio Unicode, dan foto.
2. Ekspor Dynamic PNG/SVG tanpa logo dan dengan logo pada 512 px, margin 4, warna default.
3. Scan setiap output dari layar dan dari file yang dicetak minimal 30 mm.
4. Unduh `.vcf`, impor pada setiap target, lalu tandai field yang dipetakan, diabaikan, atau diubah aplikasinya.
5. Ubah jabatan/nomor profil; pastikan QR Dynamic lama membuka data baru dan direct-vCard lama tetap berisi data lama.
6. Simpan screenshot, tanggal, operator, perangkat, OS, aplikasi, serta hasil PASS/FAIL pada tabel di atas.
