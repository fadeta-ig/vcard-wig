# Laporan Penyelesaian Phase 3

Tanggal verifikasi: 15 Juli 2026  
Scope: Manajemen profil, social links, upload foto, status, visibility, section order, dan preview  
Status: **SELESAI [VERIFIED]**

## 1. Hasil implementasi

Phase 3 menghasilkan workflow admin yang dapat digunakan dari awal sampai akhir:

1. Admin memilih perusahaan yang berhak diakses.
2. Admin membuka daftar profil yang sudah company-scoped.
3. Admin mencari, memfilter, mengurutkan, dan melakukan pagination.
4. Admin membuat Draft dengan data dasar, pekerjaan, kontak, alamat, bio, dan social links.
5. Admin melihat preview Mobile/Tablet/Desktop menggunakan data form yang belum disimpan.
6. Admin mengunggah, mengganti, atau menghapus foto.
7. Admin memublikasikan, menonaktifkan, mengaktifkan kembali, mengarsipkan, atau memulihkan profil sesuai transition policy.
8. Setiap mutasi penting ditulis ke audit log.

## 2. Traceability kebutuhan

| Kebutuhan | Implementasi | Status |
|---|---|---|
| CRUD profil | Service transaksi, route handlers, list page, create/edit page | **[VERIFIED]** |
| Company isolation | `companyId` berasal dari authorized context dan setiap ID dicek ulang | **[VERIFIED]** cross-tenant test lulus |
| Search | Nama, email, jabatan, departemen, perusahaan, dan telepon | **[VERIFIED]** |
| Filter | Status, departemen, dan rentang tanggal Asia/Jakarta | **[VERIFIED]** |
| Sorting | Terbaru, terlama, nama A–Z, dan view count | **[VERIFIED]** |
| Pagination | Server-side, 10–100 item per halaman | **[VERIFIED]** |
| Slug | Auto-generation, reserved-word check, global uniqueness, suffix collision | **[VERIFIED]** |
| Stabilitas slug/QR | Slug dikunci setelah publish pertama agar QR lama tidak rusak | **[VERIFIED]** transition test lulus |
| Email | Lowercase normalization; email kontak tidak unique | **[VERIFIED]** duplicate-email test lulus |
| Telepon | Normalisasi dan validasi format internasional E.164 | **[VERIFIED]** |
| Social links | 12 platform termasuk Custom, maksimal 20, allowlisted icon, order, active state | **[VERIFIED]** |
| Foto | JPG/PNG/WebP, maksimal 2 MB dan 2000×2000, signature check, Sharp re-encode | **[VERIFIED]** |
| Output foto | 600×600 WebP dan thumbnail 160×160 WebP | **[VERIFIED]** metadata test lulus |
| File lifecycle | Random filename, scoped directory, rollback file baru, cleanup file lama | **[VERIFIED]** replace/remove tests lulus |
| Status | DRAFT, ACTIVE, INACTIVE, ARCHIVED dengan transition allowlist | **[VERIFIED]** |
| Archive | Soft delete, hilang dari list default, dapat dipulihkan ke Draft | **[VERIFIED]** |
| Visibility | Foto, email, telepon, alamat, dan social links | **[VERIFIED]** preview hanya menampilkan field aktif |
| Section order | CONTACT, SOCIAL, ADDRESS, BIO; lengkap, unik, dapat diurutkan | **[VERIFIED]** |
| Preview | Mobile, Tablet, Desktop dan menggunakan unsaved form state | **[VERIFIED]** |
| Bilingual UI | Bahasa Indonesia dan English | **[VERIFIED]** |
| Audit | Create/update/status/photo/social mutations tanpa menduplikasi contact PII sensitif | **[VERIFIED]** |

## 3. API Phase 3

- `GET/POST /api/admin/profiles`
- `GET/PATCH/DELETE /api/admin/profiles/{id}`
- `POST /api/admin/profiles/{id}/status`
- `POST /api/admin/profiles/{id}/publish`
- `POST /api/admin/profiles/{id}/archive`
- `POST/DELETE /api/admin/profiles/{id}/photo`
- `POST /api/admin/profiles/{id}/social-links`
- `PATCH/DELETE /api/admin/social-links/{id}`

Seluruh mutation endpoint memerlukan session, Origin/request-marker validation, session-bound CSRF token, company authorization, dan server validation.

## 4. Bukti pengujian

- Unit/integration suite: 6 files, 25 tests lulus.
- Tenant isolation: list, detail, dan update lintas perusahaan ditolak.
- Transaction: profile dan social links diperbarui secara atomik bersama audit.
- Status: transition valid lulus; transition tidak valid ditolak.
- Upload: output dimension/format, replace cleanup, remove cleanup, fake signature, dan oversize dimensions diuji.
- Quality gate akhir menggunakan `npm.cmd run verify` untuk lint, typecheck, tests, dan production build.
- Production HTTP smoke pada port terisolasi lulus untuk login, render list/form/editor, create, update, publish, search, archive, dan logout. Search mengembalikan tepat satu profil yang dibuat oleh smoke test.
- Build yang sama berhasil diarahkan ke `vcard_wig_test` melalui environment saat `next start`, membuktikan konfigurasi database tidak terkunci ke environment build.

## 5. Keputusan teknis

- Tidak ada migration Phase 3 tambahan karena initial schema Phase 1 sudah mengandung seluruh field ContactProfile dan SocialLink yang dibutuhkan.
- Foto original tidak disimpan. Hanya output WebP terkontrol yang dipertahankan.
- Update form mengganti koleksi social links dalam satu transaksi agar order dan active state tidak berada pada kondisi parsial.
- Environment database dan canonical origin dibaca saat runtime server agar artifact production yang sama dapat dipromosikan ke Ubuntu tanpa rebuild dengan secret production.
- Data tersembunyi tetap berada di admin database untuk dapat diedit, tetapi preview mengeluarkannya dari tampilan. Phase 4 wajib menerapkan filtering yang sama pada public DTO, HTML, metadata, dan seluruh output publik.

## 6. Caveat QA tooling

In-app browser automation Codex tidak dapat diinisialisasi karena runtime plugin menghasilkan `Cannot redefine property: process`. Ini adalah kegagalan tooling di luar aplikasi. Penggantinya adalah production HTTP smoke untuk seluruh critical mutation flow, server-rendered HTML checks untuk list/form/editor, automated service/integration tests, dan production build. Visual click-through manual dapat dilakukan pada server development yang sedang berjalan; cross-browser/device acceptance formal tetap merupakan scope Phase 7.

## 7. Batas fase

Halaman publik `/c/{slug}`, vCard, QR, dan analytics event bukan bagian Phase 3 dan tetap berada pada Phase 4-6. Tombol menuju output tersebut tidak dibuat sebagai placeholder palsu pada editor Phase 3.
