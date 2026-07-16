# Laporan Penyelesaian Phase 4

Tanggal verifikasi: 15 Juli 2026  
Scope: Public profile, contact/share actions, bilingual UI, lifecycle semantics, metadata/SEO, privacy, dan public contact API  
Status: **SELESAI [VERIFIED]**

## 1. Hasil implementasi

Phase 4 menghasilkan alur publik berikut:

1. Profil `ACTIVE` dapat dibuka melalui `/c/{slug}` tanpa autentikasi.
2. Branding, logo, favicon, dan warna berasal dari perusahaan pemilik profil.
3. Pengunjung dapat menjalankan aksi telepon, email, WhatsApp, website, media sosial, dan share.
4. Share memakai Web Share API ketika tersedia dan fallback copy-to-clipboard ketika tidak tersedia.
5. Bahasa label/action/status/privacy dapat diganti antara Indonesia dan English tanpa mengubah data profil.
6. Admin dapat membuka profil publik ACTIVE/INACTIVE langsung dari editor.
7. Public contact DTO tersedia melalui `GET /api/public/contacts/{slug}`.

Kontrol "Simpan ke Kontak" ditampilkan sebagai placeholder nonaktif yang jelas karena generator dan endpoint vCard merupakan scope Phase 5. Tidak ada tautan palsu menuju endpoint yang belum ada.

## 2. Policy data dan status

| Kondisi | Perilaku publik | Status |
|---|---|---|
| ACTIVE | SSR halaman profil dan public DTO | **[VERIFIED]** |
| INACTIVE | HTTP 200 dengan pesan umum dan branding saja; metadata `noindex, nofollow` | **[VERIFIED]** |
| DRAFT | HTTP 404 tanpa data profil | **[VERIFIED]** |
| ARCHIVED | HTTP 404 tanpa data profil | **[VERIFIED]** |
| Company nonaktif | HTTP 404 | **[VERIFIED]** |
| Field visibility nonaktif | Properti dikeluarkan dari DTO server dan HTML | **[VERIFIED]** |
| Social link nonaktif/tidak aman | Tidak masuk public DTO/HTML | **[VERIFIED]** |

Public DTO tidak memuat `id`, `companyId`, `createdBy`, email/telepon/alamat tersembunyi, path foto tersembunyi, atau social link nonaktif. Profil INACTIVE tidak memuat nama, jabatan, email, telepon, atau data individu lainnya.

## 3. Rendering, cache, dan SEO

- `/c/[slug]` menggunakan dynamic server rendering (`force-dynamic`, `revalidate = 0`).
- Strategi ini sengaja dipilih agar perubahan profil/perusahaan terlihat pada request berikutnya dan tidak menciptakan cache stale atau tag collision lintas perusahaan.
- Public API menggunakan `Cache-Control: private, no-store, max-age=0`.
- Profil ACTIVE memiliki title, description, canonical URL, Open Graph, optional company favicon, serta `index, follow`.
- INACTIVE dan not-found tidak mengindeks data.
- Description dan Open Graph hanya memakai nama tampilan, jabatan, departemen, perusahaan, serta foto/logo yang memang diizinkan tampil.
- `next/image` digunakan untuk logo dan foto dengan dimensi serta alt text eksplisit.

## 4. Accessibility dan responsive UI

- Lebar desktop maksimum 520 px; layout berubah menjadi full-width pada viewport sampai 560 px dan mendukung baseline minimum 360 px.
- Seluruh action mempunyai accessible text; social icon-only link mempunyai `aria-label` dan title.
- Language switcher, action, link, dan control dapat digunakan dengan keyboard serta memakai focus-visible global.
- Foreground tombol brand dipilih dari hitam/putih berdasarkan perbandingan contrast ratio terhadap warna perusahaan.
- Informasi status tidak hanya dibedakan melalui warna.
- `prefers-reduced-motion` menonaktifkan transition/animation secara global.
- Tidak menggunakan gradient, neon, glassmorphism, shadow tebal, atau animasi berlebihan.

## 5. URL dan keamanan output

- Website/social hanya menerima HTTP(S), tidak menerima credential pada URL, dan divalidasi ulang ketika dibaca.
- `javascript:`, `data:`, URL rusak, serta local asset path traversal dikeluarkan.
- Telepon wajib berbentuk internasional sebelum dibuat menjadi `tel:`.
- WhatsApp dibuat sebagai `https://wa.me/{digits}` tanpa tanda plus.
- Email action menolak newline dan query injection.
- External links memakai `noopener noreferrer` dan tab baru; telepon/email tetap memakai handler perangkat.
- Canonical URL menggunakan `APP_URL` runtime, sehingga deployment Ubuntu memakai `https://vcard.wijayainovasi.co.id` tanpa hard-code build artifact.

## 6. Bukti pengujian

Quality gate pada 15 Juli 2026:

- ESLint: lulus.
- TypeScript strict check: lulus.
- Vitest: **9 test file, 35/35 test lulus**.
- Next.js production build: lulus; `/c/[slug]`, `/privacy`, dan `/api/public/contacts/[slug]` terdaftar sebagai dynamic server routes.

Coverage perilaku test mencakup:

- ACTIVE/DRAFT/INACTIVE/ARCHIVED dan company inactive.
- Semua visibility utama, optional data, server DTO field removal, section order, dan social active state.
- URL/protocol/credential/path traversal, phone/WhatsApp/email mapping, canonical URL, dan brand contrast.
- Isolasi branding dua perusahaan.
- Native Web Share dan clipboard fallback.

Production HTTP smoke memakai hasil `next build`, `next start`, database `vcard_wig_test`, Windows development host, dan loopback `127.0.0.1`:

| Pemeriksaan | Hasil |
|---|---|
| ACTIVE page | HTTP 200; field/action/metadata tampil; hidden email/social tidak ada |
| Public API | HTTP 200; hidden data tidak ada; cache `no-store` |
| INACTIVE page | HTTP 200; pesan tampil; PII tidak ada; `noindex, nofollow` |
| DRAFT page | HTTP 404 |
| Privacy | HTTP 200; kebijakan tanpa penyimpanan IP tampil |
| Update saat server hidup | Jabatan baru terlihat pada request berikutnya |
| 7 warm request | 200,40–241,67 ms; p95 terukur 241,67 ms |

Angka performa tersebut **[VERIFIED untuk environment lokal yang disebutkan]**, bukan bukti performa jaringan seluler atau server Ubuntu. Uji Chrome/Edge/Safari/Firefox pada perangkat Android/iOS dan target `<2 detik` produksi tetap harus dilakukan pada UAT/deployment sesuai Phase 7.

## 7. Batas fase

Generator `.vcf`, tombol download contact aktif, dynamic/direct-vCard QR, serta ekspor PNG/SVG adalah Phase 5. Activity events dan statistik interaksi adalah Phase 6. Implementasi Phase 4 tidak menulis IP address atau event analytics.
