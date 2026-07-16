# Rencana Implementasi Corporate vCard & QR Contact Generator

Tanggal penyusunan: 15 Juli 2026  
Sumber kebutuhan: PRD versi 1.0, status Draft  
Status dokumen: Phase 1 sampai Phase 6 selesai diimplementasikan dan diverifikasi otomatis pada 15 Juli 2026; Phase 7 tetap menjadi roadmap QA/UAT/deployment produksi

## 1. Ringkasan eksekutif

Produk akan dibangun sebagai aplikasi Next.js App Router dengan dua area utama:

1. Admin panel terautentikasi untuk mengelola profil, branding perusahaan, QR, statistik, pengguna admin, dan audit log.
2. Halaman publik `/c/{slug}` untuk menampilkan kontak, menjalankan aksi kontak, dan mengunduh vCard.

QR utama menyimpan URL dinamis sehingga perubahan data profil tidak mengubah QR. Direct-vCard QR disediakan sebagai ekspor tambahan. Satu deployment harus mendukung dua atau lebih perusahaan. Setiap perusahaan mempunyai branding, kontak perusahaan, default QR, profil, statistik, dan penugasan admin sendiri. Super Admin dapat mengelola seluruh perusahaan; Admin direkomendasikan hanya dapat mengakses perusahaan yang ditugaskan kepadanya.

Estimasi keseluruhan: **34–47 hari kerja** untuk satu full-stack developer dengan dukungan QA/UAT paruh waktu. **[ESTIMATED]** Estimasi direvisi karena data isolation multi-company, company switcher, authorization per perusahaan, branding dinamis, bilingual UI, dan test matrix tambahan. Estimasi belum memasukkan waktu tunggu keputusan bisnis, penyediaan branding, provisioning server produksi, atau antrean approval perusahaan.

## 2. Baseline yang sudah diverifikasi

| Item | Status | Hasil |
|---|---|---|
| Workspace | **[VERIFIED]** | Repo masih kosong; proyek perlu di-bootstrap dari nol. |
| Database endpoint | **[VERIFIED]** | `127.0.0.1:3307` dapat diakses. |
| Database engine | **[VERIFIED]** | MariaDB `10.4.32`, bukan MySQL Server. |
| Database schema | **[VERIFIED]** | `vcard_wig` sudah dibuat. |
| Character set | **[VERIFIED]** | `utf8mb4`. |
| Collation | **[VERIFIED]** | `utf8mb4_unicode_ci`. |
| Database tables | **[VERIFIED]** | Belum dibuat; tabel akan dibuat melalui Prisma migration setelah model final disetujui. |
| Local DB access | **[VERIFIED]** | Akun lokal `root` dapat terhubung tanpa password. Ini hanya dapat diterima untuk lingkungan development lokal dan tidak boleh digunakan pada produksi. |

Prisma mendokumentasikan bahwa connector `mysql` digunakan untuk MySQL maupun MariaDB dan mendukung MariaDB 10.0 ke atas. Dengan demikian, MariaDB 10.4.32 yang aktif kompatibel pada level versi yang didokumentasikan. **[HIGH CONFIDENCE]** Compatibility tetap harus dibuktikan lewat migration dan integration test pada Fase 1.

## 3. Prinsip pengerjaan

- Setiap fase menghasilkan increment yang bisa diuji, bukan sekadar kumpulan file.
- Validasi server menjadi sumber kebenaran; validasi client hanya memperbaiki pengalaman pengguna.
- Semua perubahan schema dilakukan melalui migration yang repeatable dari database kosong.
- Setiap fitur selesai bersama happy path, error state, authorization, auditability yang relevan, dan test.
- Data tersembunyi tidak boleh bocor lewat API, metadata, vCard, QR, atau HTML. Ini menjadi default sampai ada keputusan bisnis yang berbeda.
- Setiap query dan mutation yang menyentuh data perusahaan wajib memiliki company scope dari session/authorization server-side, bukan hanya filter dari browser.
- Bahasa UI tersedia dalam Bahasa Indonesia dan English; data profil tetap ditampilkan sebagaimana dimasukkan kecuali translation field disetujui kemudian.
- Tidak ada hard delete profil pada MVP. Endpoint `DELETE` dipetakan ke archive/soft delete.
- Local filesystem upload hanya untuk development atau deployment single-instance dengan persistent disk.

## 4. Keputusan produk dan decision gate

Keputusan berikut sudah diperbarui berdasarkan jawaban stakeholder. Item **[PROPOSED]** masih dapat diubah tanpa membatalkan keputusan yang sudah dikonfirmasi.

| Status | Keputusan | Hasil/default |
|---|---|---|
| **[CONFIRMED]** | Model perusahaan | Multi-company dalam satu deployment; mendukung dua atau lebih perusahaan dengan konfigurasi masing-masing. |
| **[PROPOSED]** | Scope Admin | Super Admin global; Admin ditugaskan ke satu atau lebih perusahaan melalui membership. |
| **[CONFIRMED]** | Bahasa aplikasi | UI dapat beralih Bahasa Indonesia/English. Konten profil tidak diterjemahkan otomatis. |
| **[CONFIRMED]** | Zona waktu | `Asia/Jakarta`; timestamp database disimpan dalam UTC. |
| **[CONFIRMED]** | Field disembunyikan | Tidak masuk public API, halaman publik, vCard, atau direct-vCard QR. Social link hanya menampilkan item yang aktif dan dipilih. |
| **[CONFIRMED]** | Statistik kunjungan | Hit total, bukan unique visitor; abaikan prefetch/bot yang jelas. |
| **[CONFIRMED]** | IP pengunjung | Tidak disimpan dan field `ipHash` dihapus dari schema MVP. |
| **[CONFIRMED]** | Target produksi | Ubuntu Server; development tetap di Windows. |
| **[CONFIRMED]** | Public base URL | `https://vcard.wijayainovasi.co.id`. |
| **[CONFIRMED]** | Super Admin awal | Username `root`; password yang sudah diberikan hanya masuk melalui environment/seed dan disimpan sebagai Argon2id hash. |
| **[PROPOSED]** | Login identifier | Form login menerima username atau email agar akun `root` tetap sesuai kebutuhan dan email dapat digunakan untuk akun admin biasa. |
| **[PROPOSED]** | Upload produksi | Gunakan object storage; persistent local disk Ubuntu hanya dipakai bila deployment dipastikan single-instance dan backup file tersedia. |
| **[PROPOSED]** | Auth/session | Credentials dengan library autentikasi yang matang, opaque/rotatable session, dan HttpOnly cookie. |
| **[PROPOSED]** | Penghapusan profil | Archive, bukan hard delete. |
| **[PROPOSED]** | Status publik | Draft/Archived = 404; Inactive = halaman inactive + `noindex`. |

## 5. Gap pada PRD/data model yang perlu diperbaiki

1. **Company model belum ada.** Tambahkan `Company` berisi slug, identity, branding, contact, QR defaults, active state, dan timestamps. `ContactProfile` wajib mempunyai `companyId`.
2. **Penugasan Admin belum ada.** Tambahkan `UserCompanyMembership` dengan unique `(userId, companyId)`. Super Admin dapat bypass company scope; Admin hanya dapat mengakses membership aktif.
3. **`CompanySetting` global tidak lagi sesuai.** Pindahkan pengaturan ke `Company` atau relasi one-to-one `CompanySetting` dengan `companyId @unique` agar setiap perusahaan memiliki satu konfigurasi.
4. **Slug publik perlu global uniqueness.** Pertahankan URL `/c/{slug}` dan buat slug profil unik lintas perusahaan. Collision ditangani dengan suffix agar QR tidak memerlukan perubahan route.
5. **Session model belum ada.** Jika session disimpan di database, diperlukan tabel session dengan token hash, expiry, user, created time, dan revoked time.
6. **Username belum ada pada model User.** Tambahkan `username @unique`; email admin tetap dapat disimpan unik dan login menerima username/email.
7. **`Urutan informasi` belum memiliki representasi data.** Tambahkan konfigurasi JSON tervalidasi atau model section-order. Untuk MVP, JSON enum terkontrol lebih sederhana.
8. **Relasi AuditLog tidak konsisten.** Pertahankan relasi polymorphic logis melalui `entityType`/`entityId`, serta simpan `companyId` bila aksi terkait perusahaan untuk memudahkan scope dan filter.
9. **Kontrak `DELETE` konflik dengan aturan archive.** Endpoint harus melakukan archive dan diberi nama aksi eksplisit; hard delete hanya maintenance terkontrol di luar UI.
10. **Counter dan event raw berpotensi tidak konsisten.** Update event dan counter perlu transaction/atomic increment. Dashboard harus mendokumentasikan apakah membaca counter atau agregasi event.
11. **QR option tidak punya storage per profil.** Opsi warna, ukuran, margin, dan error correction bersifat export-time; default disimpan per perusahaan.
12. **Upload hanya menyimpan satu path.** Untuk MVP simpan path output 600×600 dan thumbnail 160×160; original tidak dipublikasikan.
13. **Email profil bebas.** Email kontak tidak diberi unique constraint; hanya slug yang wajib unik.
14. **Visibility sudah diputuskan.** Field tersembunyi dan social link nonaktif dikeluarkan pada server dari page, public API, vCard, dan direct-vCard QR.

## 6. Fase implementasi

### Fase 0 — Discovery dan penguncian keputusan

Estimasi: **1–2 hari kerja [ESTIMATED]**

Tujuan:

- Mengubah PRD Draft menjadi baseline MVP yang dapat diimplementasikan dan diuji.
- Mengunci keputusan yang berdampak pada schema, keamanan, serta deployment.

Pekerjaan:

- Review decision gate pada bagian 4 bersama stakeholder.
- Verifikasi DNS/TLS dan kesiapan `https://vcard.wijayainovasi.co.id` sebagai base URL QR.
- Kumpulkan logo, favicon, warna, nama/legal identity, alamat, dan default contact untuk setiap perusahaan awal.
- Konfirmasi email opsional Super Admin `root`; password seed hanya dibaca dari environment dan tidak ditulis ke repo/migration.
- Rinci deployment Ubuntu: versi OS, reverse proxy, process/container manager, storage upload, database produksi, dan backup target.
- Tetapkan kebijakan data: field publik, analytics, retensi event, audit log, backup, serta siapa yang boleh mengelola admin.
- Tetapkan browser/device test matrix dan contact apps yang menjadi acceptance target.
- Buat requirement traceability matrix dari acceptance criteria PRD ke fitur dan test.

Deliverable:

- PRD MVP bertanda approved atau daftar perubahan terkontrol.
- Architecture Decision Records untuk auth, storage, analytics, dan deployment.
- Test matrix Android, iOS, Outlook, serta Google Contacts.

Exit criteria:

- Tidak ada keputusan schema/security berstatus blocker.
- Base URL, model visibility, multi-company boundary, dan target deployment sudah diputuskan.

### Fase 1 — Fondasi proyek, database, dan quality gate

Status: **SELESAI [VERIFIED]**. Bukti implementasi dan pengujian tercatat di `docs/PHASE_1_2_COMPLETION.md`.

Estimasi: **3–4 hari kerja [ESTIMATED]**  
Dependensi: Fase 0 selesai untuk keputusan yang memengaruhi schema.

Pekerjaan:

- Bootstrap Next.js App Router + TypeScript dengan struktur `src/`.
- Konfigurasi lint, formatter, strict TypeScript, test runner, dan production build gate.
- Siapkan fondasi i18n dengan locale `id` dan `en`, language switcher state/cookie, serta fallback `id`.
- Buat `.env.example`, loader/validator environment, dan dokumentasi setup lokal.
- Konfigurasi Prisma untuk provider `mysql` ke database `vcard_wig`.
- Finalisasi model `Company`, `User`, `UserCompanyMembership`, `ContactProfile`, `SocialLink`, `ActivityEvent`, `AuditLog`, dan `Session`, termasuk index, timestamps, serta delete behavior.
- Wajibkan `companyId` pada semua entity tenant-owned dan buat helper server-side untuk company scope.
- Buat initial migration dan seed idempotent untuk Super Admin `root`; credential dibaca dari environment dan password disimpan sebagai hash.
- Buat singleton Prisma client dan batas service/repository agar akses DB tidak tersebar di UI.
- Siapkan error taxonomy: validation, authentication, authorization, conflict, not found, rate limit, dan internal error.
- Siapkan logging server yang tidak membocorkan secret, password hash, session token, query sensitif, atau stack trace ke pengguna.

Pengujian:

- Migration berhasil dari database kosong.
- Migration dapat diaplikasikan ulang pada environment bersih.
- Seed tidak menggandakan data saat dijalankan ulang.
- DB smoke test untuk create/read/update transaction.
- Isolation test: data Company A tidak dapat dibaca atau diubah melalui company scope Company B.
- Locale fallback dan missing translation key test.
- `lint`, typecheck, unit test, dan production build berhasil.

Deliverable:

- Proyek yang dapat dijalankan lokal.
- Prisma schema, migration awal, seed, `.env.example`, dan README setup.
- Database `vcard_wig` berisi schema hasil migration.

Exit criteria:

- Developer baru dapat menjalankan aplikasi dari dokumentasi tanpa langkah tersembunyi.
- Build production lulus dan DB integration test hijau.

### Fase 2 — Autentikasi, authorization, admin shell, dan manajemen perusahaan

Status: **SELESAI [VERIFIED]**. Bukti implementasi dan pengujian tercatat di `docs/PHASE_1_2_COMPLETION.md`.

Estimasi: **5–7 hari kerja [ESTIMATED]**  
Dependensi: Fase 1.

Pekerjaan:

- Login username/email + password, logout, session expiry, revocation, dan update `lastLoginAt`.
- Hash password menggunakan Argon2id dengan parameter yang didokumentasikan dan diuji pada kapasitas server.
- Cookie session HttpOnly, Secure di HTTPS, SameSite, scoped path/domain, expiry, dan rotation.
- Proteksi route UI dan seluruh endpoint admin; pemeriksaan role tetap dilakukan di server pada setiap aksi.
- CSRF protection untuk state-changing request; SameSite tidak dipakai sebagai satu-satunya lapisan.
- Rate limiting login berdasarkan kombinasi account + source signal tanpa membocorkan apakah email terdaftar.
- Admin layout: sidebar, header, responsive navigation, language switcher, company switcher, serta loading/error/empty states.
- Super Admin dapat CRUD perusahaan, mengaktifkan/menonaktifkan perusahaan, dan mengatur branding/contact/default QR masing-masing.
- Super Admin dapat list/create/deactivate admin dan menugaskan satu admin ke satu atau lebih perusahaan.
- Semua navigation dan mutation menyaring perusahaan yang boleh diakses oleh user aktif.
- Audit log untuk login penting, perubahan admin, membership, perusahaan, dan company settings.

Pengujian:

- Login benar/salah, akun nonaktif, session kedaluwarsa, logout, dan revoked session.
- Admin tidak dapat mengakses fungsi Super Admin.
- Admin Company A tidak dapat melihat identifier, statistik, profile count, asset path, atau data Company B.
- Pergantian company context divalidasi terhadap membership, termasuk melalui request yang dimanipulasi.
- Pengguna tanpa session ditolak pada page dan API.
- CSRF, rate-limit boundary, cookie flags, dan generic login error.
- Keyboard navigation dan focus state pada layout utama.

Exit criteria:

- Tidak ada route admin atau mutation endpoint yang dapat dipakai tanpa authorization server-side.
- Super Admin dapat mengelola perusahaan, membership, setting, dan admin sesuai role.

### Fase 3 — Manajemen profil, social links, upload foto, status, dan preview

Status: **SELESAI [VERIFIED]**. Bukti implementasi dan pengujian tercatat di `docs/PHASE_3_COMPLETION.md`.

Estimasi: **7–9 hari kerja [ESTIMATED]**  
Dependensi: Fase 2.

Pekerjaan:

- Profile list dengan server-side pagination, search, filter, dan sorting yang selalu dibatasi company context.
- Create/edit form per section: dasar, pekerjaan, kontak, media sosial, tampilan, dan QR defaults.
- Normalisasi email, nomor telepon internasional, URL, whitespace, dan slug.
- Slug otomatis, pengecekan reserved slug, uniqueness, serta conflict handling yang ramah pengguna.
- Social link modular: preset platform, custom link, label, username, icon token allowlist, active state, dan reordering.
- Upload JPG/JPEG/PNG/WebP maksimal 2 MB; periksa extension, MIME, signature, pixel limit, lalu decode/re-encode dengan Sharp.
- Hasil foto 600×600 WebP dan thumbnail 160×160; randomized filename; replace/delete yang aman.
- Status workflow DRAFT → ACTIVE/INACTIVE/ARCHIVED dan aturan publish.
- Preview mobile/tablet/desktop dengan draft data sebelum disimpan bila feasible.
- Visibility toggles dan section order.
- Transaction untuk update profil + social links + audit log.
- `companyId` diturunkan dari authorization context, tidak dipercaya dari body/form client.
- Audit old/new values dengan redaction untuk data yang tidak perlu direkam.

Pengujian:

- CRUD, validation boundary, duplicate slug, reserved slug, invalid protocol, dan nomor tidak valid.
- Search/filter/sort/pagination pada data yang cukup besar untuk melewati satu halaman.
- Upload file palsu, MIME mismatch, oversized file, decompression/pixel bomb, replace, dan orphan cleanup.
- Perpindahan status dan hak akses per role.
- Cross-company IDOR test untuk list, detail, edit, archive, upload, social link, preview, dan QR endpoint.
- Unsaved preview dan responsive layout pada 360/768/1280 px.

Exit criteria:

- Seluruh acceptance criteria Profile, Media Sosial, dan bagian relevan Admin Panel terpenuhi.
- Profile ACTIVE dapat menjadi sumber data publik; status lain mengikuti policy yang diputuskan.

### Fase 4 — Public profile dan contact actions

Status: **SELESAI [VERIFIED]**. Bukti implementasi dan pengujian tercatat di `docs/PHASE_4_COMPLETION.md`.

Estimasi: **5–7 hari kerja [ESTIMATED]**  
Dependensi: Fase 3.

Pekerjaan:

- Halaman `/c/[slug]` dengan server rendering/cache strategy dan invalidation setelah profil atau perusahaan berubah.
- Layout max-width 520 px memakai branding dari perusahaan pemilik profil, responsive, accessible, dan tanpa pola visual yang dilarang PRD.
- Language switcher Bahasa Indonesia/English untuk label, action, status, error, dan privacy UI; data profil tetap apa adanya.
- Hanya field aktif dan diizinkan visibility yang dikirim/render.
- Aksi `tel:`, `mailto:`, WhatsApp `wa.me`, website, social links, save contact placeholder, dan share dengan fallback copy link.
- Halaman inactive dan not-found semantics untuk Draft/Archived.
- Metadata title/description, canonical URL, Open Graph yang tidak membocorkan data tersembunyi, dan `noindex` sesuai status.
- Privacy page berdasarkan analytics policy.
- Gunakan `next/image` atau output image teroptimasi dengan alt text dan ukuran eksplisit.

Pengujian:

- Render setiap kombinasi visibility dan data opsional.
- Semua URL action ter-encode dengan benar dan tidak menerima protokol berbahaya.
- Keyboard, screen-reader labels, color contrast, focus, serta reduced motion.
- Cache invalidation: edit profil terlihat tanpa menunggu cache stale yang tidak dapat diprediksi.
- Cache invalidation: perubahan logo/warna/nama Company A tidak memengaruhi Company B.
- Performance budget untuk target buka kurang dari 2 detik diuji pada environment yang disepakati; hasil pengujian menyebut jaringan, device, dan percentile.

Exit criteria:

- Halaman ACTIVE dapat dipakai di mobile/desktop dan semua action utama berfungsi.
- Draft/Archived tidak membocorkan data; Inactive mengikuti tampilan yang disetujui.

### Fase 5 — vCard dan QR generator

Status: **SELESAI IMPLEMENTASI [VERIFIED]**. Automated round-trip, integration, build, dan HTTP smoke lulus; matriks perangkat fisik tercatat di `docs/PHASE_5_DEVICE_UAT.md`. Bukti lengkap ada di `docs/PHASE_5_COMPLETION.md`.

Estimasi: **3–4 hari kerja [ESTIMATED]**  
Dependensi: Fase 4 untuk final public URL.

Pekerjaan:

- Utility vCard 3.0 dengan escaping newline, comma, semicolon, backslash, CRLF, dan line folding yang konsisten.
- Mapping `N`, `FN`, `ORG`, `TITLE`, `ROLE`, multiple `TEL`, `EMAIL`, structured `ADR`, `URL`, `NOTE`, dan photo policy.
- Endpoint download dengan Content-Type, Content-Disposition, filename slug yang aman, dan cache policy.
- Dynamic URL QR memakai base URL dari environment, bukan hard-coded domain.
- Production dynamic URL memakai `https://vcard.wijayainovasi.co.id/c/{slug}`.
- Direct-vCard QR dari payload yang sama dengan generator download.
- Export PNG/SVG, parameter size/margin/error correction/color, logo opsional, dan preview.
- Tetapkan error correction H saat logo aktif; validasi kontras serta quiet zone.
- Cache QR menggunakan payload/options fingerprint; invalidasi otomatis bila data yang relevan berubah.
- Download filename mengikuti PRD dan SVG disanitasi/di-generate server-side.

Pengujian:

- Unit golden files untuk escaping, Unicode, nama satu kata, beberapa telepon, alamat parsial, dan field kosong.
- QR round-trip decode untuk PNG/SVG dan semua level/options yang diizinkan.
- Scan manual Android dan iOS dengan serta tanpa logo.
- Import `.vcf` pada Android Contacts, iOS Contacts, Outlook, dan Google Contacts; catat perbedaan mapping.
- Pastikan perubahan profil tidak mengubah Dynamic URL QR, tetapi memperbarui direct-vCard payload.
- Pastikan field tersembunyi tidak ada di `.vcf`/direct QR sesuai keputusan visibility.

Exit criteria:

- Seluruh acceptance criteria QR dan vCard terpenuhi dengan evidence test matrix.

### Fase 6 — Analytics, dashboard, audit log, dan security hardening

Estimasi: **5–7 hari kerja [ESTIMATED]**  
Dependensi: Fase 2–5.

Pekerjaan:

- Activity event untuk view, vCard download, phone, WhatsApp, email, social, dan share tanpa IP/IP hash.
- Validasi event type/action target di server; anonymous endpoint dirate-limit dan tidak menerima arbitrary metadata.
- Aturan pencegahan hit akibat prefetch, duplicate UI dispatch, dan bot yang jelas.
- Atomic counter + event transaction atau satu sumber agregasi yang konsisten.
- Dashboard per company: total/aktif/nonaktif, profil terbaru, total events, top profiles, dan satu grafik sederhana hanya bila informatif. Super Admin dapat melihat agregat global secara terpisah.
- Analytics list/filter dengan definisi metrik tertulis.
- Audit log read-only untuk Super Admin, filter, redaction, dan pagination.
- Security headers: CSP, frame protection, nosniff, referrer policy, permissions policy, dan HSTS pada HTTPS produksi.
- URL allowlist/sanitization review, upload hardening, error redaction, dependency audit, dan authorization matrix review.
- Rate limiting public endpoints/login; tentukan centralized store jika deploy multi-instance.
- Retention/cleanup job untuk event dan session expired.
- Backup/restore script serta runbook; lakukan satu restore drill, bukan hanya membuat backup.

Pengujian:

- Event tidak dapat mengakses/mengubah profil dan menolak event/slug invalid.
- Dashboard cocok dengan fixture event yang diketahui.
- Dashboard dan export/filter analytics tidak mencampur data antarperusahaan.
- Concurrent event tidak kehilangan increment.
- Audit log mencatat actor, aksi, target, waktu, dan perubahan yang sudah diredaksi.
- Security regression: auth bypass, IDOR, CSRF, XSS payload, malicious URL, unsafe upload, rate-limit, sensitive error.
- Restore backup ke database bersih dan jalankan smoke test aplikasi.

Exit criteria:

- Dashboard dan audit memenuhi role rules.
- Security checklist dan restore drill lulus tanpa temuan blocker/high severity.

### Fase 7 — QA end-to-end, UAT, dokumentasi, dan deployment

Estimasi: **5–7 hari kerja [ESTIMATED]**  
Dependensi: seluruh fase fitur selesai.

Pekerjaan:

- E2E critical path: login → create draft → upload → add social → preview → publish → public page → vCard → QR → edit → QR URL lama tetap valid → deactivate/archive.
- Cross-browser test pada Chrome, Edge, Firefox, Safari, Android, dan iOS sesuai matrix.
- Accessibility audit otomatis + manual keyboard/screen reader smoke test.
- Performance/load smoke test public profile dan analytics endpoint.
- UAT dengan data representatif, perbaikan defect, dan sign-off acceptance criteria.
- Production env validation pada Ubuntu, secret provisioning, TLS untuk `vcard.wijayainovasi.co.id`, reverse proxy, process/container manager, persistent storage/object storage, database app user least-privilege, dan migration procedure.
- Dokumentasi install, env, operational checks, log location, backup/restore, user management, dan rollback.
- Deployment rehearsal pada staging, lalu cutover production dengan backup dan rollback point.

Exit criteria / Definition of Done:

- Semua acceptance criteria memiliki bukti pass atau waiver tertulis.
- Production build tanpa TypeScript error.
- Migration dari kondisi kosong dan migration upgrade keduanya lulus.
- QR diuji Android+iOS; vCard diuji sedikitnya tiga aplikasi target.
- Tidak ada defect blocker/high, raw error, secret, stack trace, atau data tersembunyi yang terekspos.
- Backup/restore dan rollback sudah direhearsal.
- Dokumentasi instalasi/operasional diserahkan.

## 7. Milestone dan urutan ketergantungan

| Milestone | Fase | Hasil yang dapat didemokan |
|---|---|---|
| M0 — Scope locked | 0 | PRD/decision gate disetujui. |
| M1 — Secure skeleton | 1–2 | Aplikasi jalan, DB termigrasi, login dan admin shell aman. |
| M2 — Content management | 3 | Admin dapat mengelola profil lengkap sampai publish. |
| M3 — Public contact card | 4 | Profil publik dan contact actions berfungsi. |
| M4 — Distribution | 5 | QR dan vCard dapat diunduh dan diuji perangkat. |
| M5 — Operational MVP | 6 | Analytics, dashboard, audit, hardening, dan backup tersedia. |
| M6 — Release candidate | 7 | UAT sign-off dan siap production. |

## 8. Strategi test minimum

| Level | Fokus |
|---|---|
| Unit | Validation, slug, phone normalization, URL policy, vCard escaping/folding, QR payload/options, permission rules. |
| Integration | Prisma/service transaction, auth/session, status transition, profile API, event/counter, upload lifecycle. |
| E2E | Seluruh user flow utama admin dan publik. |
| Security | Authorization matrix, IDOR, CSRF, XSS, upload, URL scheme, session, rate limit, error leakage. |
| Compatibility | Android/iOS QR scan dan vCard import; Outlook/Google Contacts. |
| Accessibility | Keyboard, focus, labels, semantics, contrast, screen-reader smoke test. |
| Performance | Public profile pada profile data/foto representatif dan kondisi jaringan yang didefinisikan. |
| Reliability | Concurrent event, upload failure rollback, QR retry, DB backup/restore, migration rollback procedure. |

## 9. Risiko utama dan mitigasi

| Risiko | Level | Mitigasi |
|---|---|---|
| Kebocoran data antarperusahaan akibat tenant filter terlupakan | Critical | Company scope dari session server-side, repository guard, authorization matrix, dan cross-company IDOR test pada semua endpoint. |
| Cache key tidak memasukkan company/profile identity | High | Gunakan cache key/tag eksplisit per company/profile dan uji invalidation lintas perusahaan. |
| MariaDB lokal berbeda dengan database produksi | Medium | Samakan engine/version sedini mungkin atau jalankan CI integration test pada engine produksi. |
| Local uploads hilang pada redeploy/multi-instance | High | Gunakan object storage atau persistent shared storage sebelum production. |
| vCard berbeda perilaku antar contact app | High | Golden files + test device/app nyata; dokumentasikan compatibility exception. |
| Direct-vCard QR terlalu padat | Medium | Batasi field, sediakan preview/scan validation, gunakan error correction sesuai logo, utamakan dynamic URL QR. |
| Analytics mudah double-count/bot | Medium | Definisi metrik sederhana, dedupe UI, abaikan prefetch/bot jelas, jangan klaim unique users. |
| Visibility hanya diterapkan di UI | High | Bentuk public DTO server-side dan pakai payload tersaring yang sama untuk page, API, vCard, dan QR. |
| Root DB tanpa password | High untuk production | Hanya lokal; produksi wajib secret kuat, app user least-privilege, TLS/network restriction, dan backup. |
| Cached public page stale setelah edit/deactivate | High | Tag/key-based invalidation dan E2E status/update test. |
| Rate limiting in-memory gagal pada multi-instance | Medium | Centralized store atau enforcement di reverse proxy/gateway. |

## 10. Keputusan terjawab dan pertanyaan tersisa

Sudah terjawab **[CONFIRMED]**:

- Multi-company; setiap perusahaan dapat dikustomisasi.
- Field tersembunyi dan social link nonaktif tidak muncul di output publik mana pun.
- Statistik berupa total event tanpa IP.
- Development Windows dan target produksi Ubuntu Server.
- Base URL `https://vcard.wijayainovasi.co.id`.
- Super Admin awal memakai username `root`; password diberikan terpisah dan tidak dicatat di dokumen/source.
- UI Bahasa Indonesia/English dengan timezone `Asia/Jakarta`.
- Email kontak profil boleh dipakai oleh lebih dari satu profil.

Pertanyaan tersisa, dengan default agar tidak menghambat pengerjaan:

1. Apa perusahaan pertama yang perlu dibuat beserta nama legal, slug, logo, favicon, warna, website, email, telepon, dan alamatnya? **Default:** seed hanya membuat Super Admin; perusahaan dibuat melalui admin panel.
2. Apakah Admin boleh ditugaskan ke beberapa perusahaan? **Default:** ya, memakai tabel membership; Super Admin selalu global.
3. Apakah akun `root` perlu memiliki email untuk notifikasi/pemulihan berikutnya? **Default:** email nullable pada seed awal, tetapi wajib untuk akun Admin biasa.
4. Apakah language switch hanya menerjemahkan UI, atau job title/bio perlu mempunyai versi Indonesia dan English? **Default:** hanya UI; data profil ditampilkan sesuai input.
5. Apakah upload produksi memakai object storage atau persistent disk Ubuntu? **Default:** object storage; jika persistent disk, deployment wajib single-instance dan file masuk backup harian.
6. Berapa lama ActivityEvent, Session expired, dan AuditLog disimpan? **Default:** ActivityEvent 12 bulan, session expired 30 hari setelah expiry, AuditLog minimal 24 bulan.
7. Apakah foto dimasukkan ke file vCard? **Default:** tidak embed binary photo; gunakan URL hanya setelah compatibility test dan bila foto memang publik.

## 11. Referensi teknis

- Prisma MySQL/MariaDB connector: https://docs.prisma.io/docs/orm/v6/overview/databases/mysql
- Prisma supported databases: https://docs.prisma.io/docs/orm/reference/supported-databases
- Next.js App Router: https://nextjs.org/docs/app
- Next.js production checklist: https://nextjs.org/docs/app/guides/production-checklist
- Next.js self-hosting: https://nextjs.org/docs/app/guides/self-hosting
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- RFC 6350 vCard Format Specification: https://www.rfc-editor.org/info/rfc6350/
