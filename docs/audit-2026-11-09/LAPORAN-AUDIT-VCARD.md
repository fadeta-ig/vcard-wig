# Audit sistem Corporate vCard WIG

Tanggal: **9 November 2026 (Asia/Jakarta)**  
Sumber: checkout lokal `C:\Users\IT WIG\Desktop\vcard-wig`, HEAD `c694a3f`.  
Tujuan: menentukan perbaikan sistem, pengembangan produk, dan arah UI/UX yang elegan, bersih, profesional.

**Catatan lanjutan:** Dokumen ini mempertahankan kondisi saat audit sebelum perbaikan. Status implementasi terkini dan hasil pemeriksaan setelah perbaikan tersedia dalam [laporan implementasi](../remediation-2026-11-09/IMPLEMENTASI-PERBAIKAN-VCARD.md).

## 1. Kesimpulan untuk pengambilan keputusan

**[HIGH CONFIDENCE] Fondasi sistem layak dilanjutkan. Prioritas pengembangan adalah memperkuat keamanan, ketepatan konteks perusahaan, kestabilan identitas QR, serta kejelasan proses edit/publikasi; kemudian menyempurnakan UI secara konsisten.** Kesimpulan ini merupakan penilaian berdasarkan temuan di bagian 4, bukan sertifikasi kesiapan produksi.

**[VERIFIED] Sistem sudah memiliki** multi-company, keanggotaan admin, profil dan status Draft/Aktif/Nonaktif/Arsip, profil publik, kontrol visibilitas, foto, media sosial, QR dinamis/direct-vCard, unduhan `.vcf`, analitik, audit log, serta skrip pemeliharaan dan backup/restore. Jadi modul tersebut perlu disempurnakan, bukan dibuat ulang. Bukti utama: schema Prisma, route aplikasi, dan service terkait pada daftar sumber kode di bagian 9.

**[VERIFIED] Pemeriksaan dependensi saat audit menghasilkan 18 entri paket terdampak: 1 critical, 11 high, 6 moderate, 0 low.** Angka ini adalah agregat paket dari `npm audit --omit=dev`, bukan jumlah celah independen yang semuanya terbukti dapat dieksploitasi. Next.js terpasang 16.2.10; Sharp langsung 0.35.3; Zod 4.4.3. Hasil registry tersimpan dalam [dependency-audit.json](<C:/Users/IT WIG/Desktop/vcard-wig/docs/audit-2026-11-09/dependency-audit.json>). Semua entri tersebut melaporkan `fixAvailable: true`; pembaruan tetap perlu ditinjau kompatibilitas dan keterjangkauan jalur rentannya.

**[UNCERTAIN] Kualitas visual hasil render, keamanan konfigurasi server produksi, performa pengguna nyata, serta kompatibilitas perangkat fisik belum terverifikasi dalam audit ini.** Tidak diberikan skor visual atau klaim sistem sudah aman/siap produksi.

## 2. Metode dan batas audit

- **[VERIFIED]** Telaah source code route, service, schema, validasi, komponen, CSS, dan dokumentasi operasional. Worktree bersih saat mulai.
- **[VERIFIED]** Pemeriksaan lint, TypeScript, pengujian unit yang tersedia, pemeriksaan komponen editor, probe service terisolasi, serta audit dependensi registry npm.
- **[VERIFIED]** Probe perilaku mengganti semua operasi Prisma dengan data dalam memori dan memakai satu gambar sintetis lokal. Probe tidak membaca/mengubah database aplikasi. Metodenya tersedia dalam [behavior-probes.mjs](<C:/Users/IT WIG/Desktop/vcard-wig/docs/audit-2026-11-09/behavior-probes.mjs>).
- **[VERIFIED]** Dua probe editor memakai jsdom dan API mock. Keduanya memeriksa pergantian props perusahaan dan publikasi saat formulir belum disimpan; bukan pengujian navigasi browser end-to-end.
- **[VERIFIED]** Preflight koneksi database khusus tes mengembalikan `Unknown database 'vcard_wig_test'`. Suite integrasi tidak dijalankan dan database baru tidak dibuat. Database aplikasi tidak diubah.
- **[VERIFIED]** Tool inspeksi browser menghentikan akses karena URL aktif Windows tidak dapat dipastikan. Penilaian UI di bawah bersumber dari komponen/CSS, bukan inspeksi screenshot atau usability test pengguna.
- **[VERIFIED]** Tidak dilakukan perubahan source aplikasi, dependensi, deployment, data kontak, akun, maupun pengaturan produksi. Penambahan hanya berkas audit dan hasil pemeriksaan; build memperbarui artefak lokal `.next`.

Arti status: **[VERIFIED]** dibuktikan langsung pada sumber/hasil pemeriksaan yang disebutkan; **[HIGH CONFIDENCE]** implikasi kuat dari bukti tetapi belum diuji pada kondisi operasional penuh; **[ESTIMATED]** usulan/asumsi perencanaan; **[UNCERTAIN]** bukti belum tersedia. Tidak digunakan estimasi waktu/biaya karena volume data, tim, dan target rilis belum diketahui.

## 3. Kemampuan yang sudah baik dan perlu dipertahankan

| Area | Bukti implementasi yang diperiksa | Penilaian |
|---|---|---|
| Autentikasi | Argon2id; token sesi/CSRF berbeda dan hash di DB; expiry dan pencabutan sesi | [VERIFIED] kontrol ada; bukan bukti seluruh deployment aman |
| Otorisasi perusahaan | Membership aktif dan perusahaan aktif diperiksa server; Super Admin dipisahkan | [VERIFIED] pola kontrol ada; pengujian integrasi terkini belum dilakukan |
| Mutasi API | Origin, Fetch Metadata, header penanda, CSRF, schema Zod | [VERIFIED] kontrol ada pada jalur yang ditelaah |
| Data publik | DTO terpisah; Draft/Arsip tidak dikembalikan; Nonaktif hanya branding; field tersembunyi difilter | [VERIFIED] pada jalur DTO; akses file foto merupakan temuan terpisah F02 |
| Upload | MIME/signature, ukuran/dimensi, re-encoding Sharp, nama acak, pembatasan path | [VERIFIED] kontrol implementasi; dependensi decoder tetap harus diperbarui |
| QR/vCard | Generator khusus, quiet zone, validasi kontras QR, logo dengan correction H, escaping/folding vCard | [VERIFIED] implementasi dan sebagian unit test diperiksa; UAT perangkat belum selesai |
| Akuntabilitas | Mutasi beserta audit log berada dalam transaksi; redaksi key sensitif saat ditampilkan | [VERIFIED] pada service yang ditelaah; belum berarti log tahan manipulasi oleh operator DB |
| Gaya dasar UI | Token navy/putih/abu, border tipis, radius moderat, focus-visible, reduced motion | [VERIFIED] dari CSS; menjadi dasar arah desain lanjutan |

Sumber: [auth.service.ts](<C:/Users/IT WIG/Desktop/vcard-wig/src/services/auth.service.ts>), [authorization.service.ts](<C:/Users/IT WIG/Desktop/vcard-wig/src/services/authorization.service.ts>), [request.ts](<C:/Users/IT WIG/Desktop/vcard-wig/src/lib/security/request.ts>), [public-profile.service.ts](<C:/Users/IT WIG/Desktop/vcard-wig/src/services/public-profile.service.ts>), [profile-photo.service.ts](<C:/Users/IT WIG/Desktop/vcard-wig/src/services/profile-photo.service.ts>), [qr.service.ts](<C:/Users/IT WIG/Desktop/vcard-wig/src/services/qr.service.ts>), [vcard.ts](<C:/Users/IT WIG/Desktop/vcard-wig/src/lib/vcard.ts>), [globals.css](<C:/Users/IT WIG/Desktop/vcard-wig/src/app/globals.css>).

## 4. Temuan dan tindakan yang disarankan

Prioritas merupakan penilaian audit, bukan skor CVSS: **P0** pembaruan/triase keamanan mendesak; **P1** koreksi sebelum perluasan penggunaan; **P2** penyempurnaan rilis berikut; **P3** pengembangan sesuai kebutuhan bisnis.

### F01 — P0: laporan kerentanan dependensi lama sudah tidak mewakili kondisi sekarang

**[VERIFIED]** Dokumen keamanan 15 Juli 2026 menyebut 6 moderate tanpa high/critical. Hasil registry 9 November 2026 berbeda sebagaimana dirinci di bagian 1. Advisory resmi Next.js `GHSA-2464-fhr4-w9xw` menyebut risiko RCE pada Image Optimization di Linux berbasis glibc; patched version seri 16 adalah **16.4.1**, dengan workaround Sharp yang dipakai Next.js **>=0.35.5**. Sumber: [advisory penerbit Next.js](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw).

**Tindakan [HIGH CONFIDENCE]:** buat pembaruan dependensi terkontrol; cocokkan Next/React, Prisma Client/adapter/generator, Sharp langsung dan transitif, Zod, serta driver database. Pastikan semua advisory relevan tertangani; jangan menganggap satu versi patched otomatis menyelesaikan seluruh laporan. Ulangi audit, build, pengujian isolasi perusahaan, foto, QR, dan vCard. Perbarui catatan keamanan sesudah hasil baru tersedia. Acuan: OWASP ASVS dan advisory penerbit. **[UNCERTAIN]** exploitability setiap advisory dan versi yang berjalan di produksi belum diperiksa; tidak ditemukan bukti insiden/kompromi dari audit ini.

### F02 — P1: menyembunyikan profil/foto belum mencabut akses URL gambar

**[VERIFIED]** Route upload hanya memeriksa kategori/path/file, tidak memeriksa profil, `showPhoto`, atau status perusahaan. Gambar sintetis dikembalikan **HTTP 200**, tanpa query profil, dengan `public, max-age=31536000, immutable`. DTO memang menyembunyikan URL foto ketika `showPhoto=false`, tetapi penerima URL sebelumnya dapat tetap meminta file yang belum dihapus. Bukti: [route.ts:35](<C:/Users/IT WIG/Desktop/vcard-wig/src/app/uploads/[...path]/route.ts:35>) dan hasil `PUBLIC_ASSET_NO_PROFILE_CHECK` dalam [behavior-probes.json](<C:/Users/IT WIG/Desktop/vcard-wig/docs/audit-2026-11-09/behavior-probes.json>).

**Tindakan [HIGH CONFIDENCE]:** pisahkan aset logo publik dari foto profil yang mengikuti status/visibilitas; simpan foto terkendali di luar direktori publik; layani akses publik hanya bila profil dan perusahaan aktif serta foto diizinkan, atau izinkan akses admin yang berwenang. Sesuaikan cache dan invalidasi saat nonaktif/arsip/sembunyi. Terapkan juga pada thumbnail dan jalur optimasi gambar. Acuan: OWASP File Upload/ASVS. **Batas:** salinan yang sudah diunduh orang lain tidak dapat ditarik kembali.

### F03 — P1: pergantian perusahaan dapat mempertahankan data formulir perusahaan sebelumnya

**[VERIFIED]** Editor menginisialisasi `draft` melalui `useState` sekali. Probe pergantian props A → B menunjukkan heading sudah Company B, tetapi nama/perusahaan dalam formulir masih milik A. Switcher menggunakan `router.refresh()`. Sementara POST create menentukan perusahaan tujuan dari konteks cookie pada waktu submit. Bukti: [profile-editor.tsx:207](<C:/Users/IT WIG/Desktop/vcard-wig/src/components/admin/profile-editor.tsx:207>), [company-switcher.tsx:24](<C:/Users/IT WIG/Desktop/vcard-wig/src/components/admin/company-switcher.tsx:24>), [route.ts:25](<C:/Users/IT WIG/Desktop/vcard-wig/src/app/api/admin/profiles/route.ts:25>), [editor-probes.json](<C:/Users/IT WIG/Desktop/vcard-wig/docs/audit-2026-11-09/editor-probes.json>).

**[HIGH CONFIDENCE] Dampak:** profil berisiko tersimpan pada perusahaan yang berbeda dari konteks saat pengguna mulai mengetik, termasuk jika cookie perusahaan berubah di tab lain. Ini masalah konsistensi konteks antarperusahaan yang dapat sama-sama diizinkan untuk admin, bukan bukti bypass membership.

**Tindakan:** tetapkan perusahaan pemilik pada sesi editor; tampilkan secara jelas; lindungi perpindahan saat ada perubahan; reset/remount editor secara terkendali. Sertakan konteks perusahaan yang diharapkan pada permintaan dan tolak ketidakcocokan di server setelah otorisasi. Acuan: ASVS otorisasi dan Nielsen error prevention. Uji A/B di tab yang sama serta dua tab sebelum dinyatakan selesai.

### F04 — P1: slug dapat berubah setelah profil terbit diarsipkan lalu dipulihkan

**[VERIFIED]** ACTIVE → ARCHIVED → DRAFT mengosongkan `publishedAt`; larangan mengubah slug hanya berlaku bila `publishedAt` terisi. Probe kemudian berhasil mengganti slug. Bukti: [profile.service.ts:511](<C:/Users/IT WIG/Desktop/vcard-wig/src/services/profile.service.ts:511>), [profile.service.ts:594](<C:/Users/IT WIG/Desktop/vcard-wig/src/services/profile.service.ts:594>), probe `SLUG_AFTER_RESTORE`.

**[HIGH CONFIDENCE] Dampak:** QR/link yang sudah dicetak bisa putus. Karena reservasi saat ini melekat pada slug aktif record, slug lama juga berpotensi dipakai profil lain sesudah dilepas.

**Tindakan:** pisahkan riwayat pernah terbit dari status publikasi sekarang; pertahankan identifier permanen dan reservasi slug historis. Jika rename dibutuhkan, buat alias/redirect yang tetap mengikuti status dan kebijakan privasi pemiliknya. Acuan: Nielsen consistency/error prevention dan integritas identitas produk. Kriteria: QR lama tetap menuju identitas yang sama setelah arsip/pemulihan; tidak pernah berpindah ke orang lain.

### F05 — P1: penyimpanan dari editor lama dapat menimpa perubahan baru

**[VERIFIED]** Payload editor mengirim seluruh `draft`; update service memakai `where: { id }` tanpa prasyarat versi. Probe editor A menyimpan jabatan baru lalu editor B mengirim data lama berhasil mengembalikan jabatan lama tanpa konflik. Bukti: [profile-editor.tsx:339](<C:/Users/IT WIG/Desktop/vcard-wig/src/components/admin/profile-editor.tsx:339>), [profile.service.ts:536](<C:/Users/IT WIG/Desktop/vcard-wig/src/services/profile.service.ts:536>), probe `STALE_EDITOR_OVERWRITE`.

**Tindakan [HIGH CONFIDENCE]:** optimistic concurrency dengan kolom versi atau timestamp yang diperiksa atomik di database, respons konflik 409, dan pilihan muat ulang/bandingkan perubahan. Terapkan pula pada status dan operasi foto bila menyentuh record yang sama. Acuan: ASVS business logic dan Nielsen error prevention. Dampak potensial termasuk field visibilitas lama mengaktifkan kembali informasi yang baru disembunyikan admin lain.

### F06 — P1: ekspor CSV belum menetralkan formula spreadsheet

**[VERIFIED]** `csvCell()` hanya mengutip koma/petik/newline. Input nama `=1+1` keluar sebagai awalan formula yang sama dalam CSV. Tidak dilakukan eksekusi formula di Excel. Bukti: [analytics.service.ts:296](<C:/Users/IT WIG/Desktop/vcard-wig/src/services/analytics.service.ts:296>) dan probe `CSV_FORMULA`.

**Tindakan [HIGH CONFIDENCE]:** sanitasi field teks dengan strategi yang diuji pada aplikasi spreadsheet target; pertimbangkan ekspor XLSX dengan tipe sel string eksplisit. Uji prefiks formula, separator, kutip, tab/newline, dan simpan/buka ulang. CSV quoting saja tidak menyelesaikan masalah ini, dan perilaku Excel dapat mengubah mitigasi saat simpan ulang. Acuan: [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection). **[UNCERTAIN]** dampak eksploitasi bergantung input yang dapat dimasukkan admin dan perilaku aplikasi pembuka.

### F07 — P2: simpan, terbitkan, dan meninggalkan editor belum menjadi alur yang jelas

**[VERIFIED]** Tombol Publikasikan hanya POST status, tanpa menyimpan perubahan formulir. Probe judul belum disimpan memastikan satu-satunya permintaan adalah status ACTIVE. Editor juga belum memiliki dirty-state/navigation guard; update profil ACTIVE langsung mengubah record yang dibaca publik. Bukti: [profile-editor.tsx:386](<C:/Users/IT WIG/Desktop/vcard-wig/src/components/admin/profile-editor.tsx:386>), [editor-probes.test.jsx](<C:/Users/IT WIG/Desktop/vcard-wig/docs/audit-2026-11-09/editor-probes.test.jsx>), `updateProfile()` dan `getPublicProfileBySlug()`.

**Tindakan [HIGH CONFIDENCE]:** status “Belum disimpan/Tersimpan”; footer simpan yang mudah dijangkau; error dekat field dengan fokus ke kesalahan pertama; lindungi aksi kembali/ganti konteks. Untuk draft, sediakan “Simpan draft” dan “Simpan & publikasikan” dengan semantik transaksi jelas. Untuk ACTIVE, tampilkan dampak publik sebelum simpan. **[ESTIMATED]** bila HR memerlukan persetujuan, tambahkan revisi draft terpisah dari versi publik; kebutuhan approval merupakan pilihan proses bisnis, bukan kewajiban semua instalasi. Acuan: Nielsen system status, error prevention, user control.

### F08 — P2: navigasi mobile/tablet kehilangan fungsi penting

**[VERIFIED]** CSS <=760 px menyembunyikan link navigasi urutan kelima dan seterusnya; untuk Super Admin ini mencakup pengaturan perusahaan, admin, dan audit. Footer berisi tombol keluar disembunyikan mulai <=1000 px, tanpa pengganti di header pada layout yang ditelaah. Pada rentang tablet, label link disembunyikan sementara SVG `aria-hidden` dan Link tidak punya `aria-label`. Bukti: [globals.css:1452](<C:/Users/IT WIG/Desktop/vcard-wig/src/app/globals.css:1452>), [globals.css:1575](<C:/Users/IT WIG/Desktop/vcard-wig/src/app/globals.css:1575>), [admin-navigation.tsx:55](<C:/Users/IT WIG/Desktop/vcard-wig/src/components/admin/admin-navigation.tsx:55>), [layout.tsx](<C:/Users/IT WIG/Desktop/vcard-wig/src/app/(dashboard)/admin/layout.tsx>).

**Tindakan [HIGH CONFIDENCE]:** gunakan drawer dengan seluruh menu sesuai hak akses; bila memakai bottom navigation, sediakan “Lainnya”. Pindahkan profil akun dan Keluar ke menu yang selalu terjangkau. Tambahkan accessible name dan penanda halaman aktif. Acuan: WCAG 2.2 dan Nielsen recognition/user control. Verifikasi nyata keyboard, layar sempit, dan zoom masih diperlukan.

### F09 — P2: preview editor bukan representasi yang sama dengan kartu publik

**[VERIFIED]** Preview memakai `contact-preview-card`, sedangkan publik memakai `PublicProfileCard`; struktur, ukuran foto, aksi simpan/bagikan, dan format nama berbeda. Preview menyembunyikan blok foto saat showPhoto false; kartu publik tetap dapat menampilkan inisial. Format gelar preview dirangkai sendiri, publik memakai helper deduplikasi. Bukti: [profile-editor.tsx:551](<C:/Users/IT WIG/Desktop/vcard-wig/src/components/admin/profile-editor.tsx:551>), [public-profile-card.tsx](<C:/Users/IT WIG/Desktop/vcard-wig/src/components/public-profile/public-profile-card.tsx>), [public-profile.ts](<C:/Users/IT WIG/Desktop/vcard-wig/src/lib/public-profile.ts>).

**Tindakan [HIGH CONFIDENCE]:** pakai satu renderer kartu dan satu pemetaan visibilitas/nama; sediakan mode preview nonaktif untuk aksi kontak/tracking. Gunakan container/iframe dengan viewport representatif untuk mode perangkat. Nama, gelar, data tersembunyi, urutan bagian, foto, dan CTA harus identik antara preview dan hasil publik. Acuan: Nielsen consistency/standards.

### F10 — P2: aksesibilitas dan warna brand belum aman untuk seluruh konfigurasi

**[VERIFIED]** Global `html { min-width:360px }` membatasi reflow 320 CSS px. Warna primer menerima seluruh hex, sementara tombol primer admin selalu bertulisan putih; kombinasi yang valid `#FFFFFF` menghasilkan kontras **1:1**. Teks nama/perusahaan publik juga memakai warna brand pada permukaan putih. Modal company/admin memiliki `role=dialog` dan `aria-modal`, tetapi pada komponen yang ditelaah belum terdapat pengelolaan fokus, focus trap, dan Escape. Bukti: [globals.css:29](<C:/Users/IT WIG/Desktop/vcard-wig/src/app/globals.css:29>), [globals.css:129](<C:/Users/IT WIG/Desktop/vcard-wig/src/app/globals.css:129>), [validation.ts:97](<C:/Users/IT WIG/Desktop/vcard-wig/src/lib/validation.ts:97>), komponen modal, probe `BRAND_TEXT_CONTRAST`.

**Tindakan [HIGH CONFIDENCE]:** foreground otomatis/validasi kontras seluruh penggunaan brand; reflow konten 320 CSS px; modal dengan manajemen fokus; skip link; error terasosiasi lewat `aria-describedby`/`aria-invalid`. Target tombol sentuh **44 px merupakan pilihan desain yang diusulkan**, bukan klaim minimum WCAG AA. WCAG 2.2 AA menetapkan target minimum **24×24 CSS px beserta pengecualian**, kontras teks normal **4.5:1** dan teks besar **3:1**. Acuan: W3C Reflow, Contrast, Target Size, dan APG Dialog. **[UNCERTAIN]** kesesuaian WCAG penuh belum diuji atau disertifikasi.

### F11 — P2: perlu perluasan perlindungan login dan batas permintaan

**[VERIFIED]** Login memiliki throttle berdasarkan identifier; pembaruan jumlah gagal adalah read-modify-write. Belum ada MFA/recovery flow pengguna dalam schema/route yang ditelaah. JSON dibaca penuh sebelum validasi; form upload dibaca sebelum validasi ukuran file. Limiter profil publik dipanggil pada API, sedangkan halaman SSR `/c/[slug]` langsung memanggil service publik. Bukti: [auth.service.ts:86](<C:/Users/IT WIG/Desktop/vcard-wig/src/services/auth.service.ts:86>), [api.ts:35](<C:/Users/IT WIG/Desktop/vcard-wig/src/lib/api.ts:35>), route foto dan halaman publik.

**Tindakan [HIGH CONFIDENCE]:** penghitung gagal atomik, proteksi abuse sebelum pekerjaan password yang mahal, batas body/request dan konkurensi di aplikasi/proxy, perlindungan juga untuk halaman SSR. Dahulukan MFA Super Admin, recovery yang diaudit, dan reautentikasi untuk aksi akun penting bila admin diakses melalui internet. Acuan: OWASP Authentication/ASVS/File Upload. **[UNCERTAIN]** WAF, limit nginx, MFA di lapisan akses eksternal, dan keterpaparan admin produksi belum diperiksa; absence di repo bukan bukti kontrol infrastruktur tidak ada.

### F12 — P2: definisi, deduplikasi, dan skala analitik perlu diperjelas

**[VERIFIED]** Cek duplikat event berada sebelum transaksi insert. Controlled interleaving dua request pengunjung yang sama dapat menerima dua event. Tracker browser menyimpan penanda view sepanjang sessionStorage, sementara deduplikasi server 30 menit; kunjungan ulang tab yang sama tidak selalu sesuai definisi dokumentasi. Grafik mengelompokkan `DATE(createdAt)` dengan waktu DB UTC sementara filter/label memakai Jakarta. Laporan mengagregasi hasil dan mengambil seluruh daftar profil sebelum memotong halaman di memori. Bukti: [analytics-event.service.ts:29](<C:/Users/IT WIG/Desktop/vcard-wig/src/services/analytics-event.service.ts:29>), [public-event-tracker.tsx](<C:/Users/IT WIG/Desktop/vcard-wig/src/components/public-profile/public-event-tracker.tsx>), [analytics.service.ts:129](<C:/Users/IT WIG/Desktop/vcard-wig/src/services/analytics.service.ts:129>), [analytics.service.ts:234](<C:/Users/IT WIG/Desktop/vcard-wig/src/services/analytics.service.ts:234>), probe `EVENT_DEDUPE_RACE`.

**Tindakan [HIGH CONFIDENCE]:** deduplikasi atomik sesuai definisi jendela waktu, samakan penanda browser dengan TTL definisi, kelompokkan hari secara konsisten dalam Asia/Jakarta, dan tambahkan uji batas tengah malam. Sebut unduhan sebagai “permintaan unduh vCard”, bukan kontak pasti tersimpan; klik WhatsApp bukan bukti pesan terkirim. Untuk volume besar, ukur query dengan data representatif sebelum memindahkan pagination/agregasi ke DB atau membuat ringkasan harian. **[UNCERTAIN]** laju double-count pada DB nyata dan besaran dampak performa belum diukur. Acuan: ASVS business logic, Nielsen system status, dan definisi produk yang terdokumentasi.

### F13 — P2: kebijakan visibilitas dan transparansi privasi perlu diperinci

**[VERIFIED]** Halaman aktif mengizinkan indexing secara otomatis; belum ada pilihan unlisted/indexing per profil. `showPhone` mengendalikan beberapa nomor sekaligus. Teks privasi menyebut agregat dan hash token, sedangkan schema/service menyimpan baris event, user-agent, serta referrer yang dipotong. Default retensi event 365 hari adalah konfigurasi, bukan bukti cleanup terjadwal benar berjalan. Bukti: [page.tsx:60](<C:/Users/IT WIG/Desktop/vcard-wig/src/app/(public)/c/[slug]/page.tsx:60>), [schema.prisma](<C:/Users/IT WIG/Desktop/vcard-wig/prisma/schema.prisma>), [public-request.ts:114](<C:/Users/IT WIG/Desktop/vcard-wig/src/lib/security/public-request.ts:114>), [public-profile-messages.ts:30](<C:/Users/IT WIG/Desktop/vcard-wig/src/i18n/public-profile-messages.ts:30>), [maintenance.service.ts](<C:/Users/IT WIG/Desktop/vcard-wig/src/services/maintenance.service.ts>).

**Tindakan [HIGH CONFIDENCE]:** tentukan field publik/opsional per perusahaan; pisahkan visibilitas nomor kerja/mobile/WhatsApp jika diperlukan; jelaskan field analitik, tujuan, cookie, retensi, serta kontak permintaan koreksi. **[ESTIMATED]** tawarkan pilihan index/unlisted bila dibutuhkan bisnis. `noindex` hanya mengarahkan crawler dan tidak membatasi akses; profil privat memerlukan otorisasi tersendiri. Acuan: ASVS data protection dan Nielsen match/clarity. Ini audit teknis, bukan kesimpulan kepatuhan hukum.

### F14 — P2: bukti operasional dan gerbang rilis perlu diperbarui

**[VERIFIED]** Tersedia runbook backup/restore dan cleanup, tetapi bukti drill yang tertulis berasal dari 15 Juli 2026. Database khusus tes tidak tersedia saat audit; build standar mengalami error junction Turbopack Windows. Dokumen operasional tidak membuktikan backup off-host, restore terbaru, uptime monitoring, persistent uploads, atau versi paket produksi saat ini.

**Tindakan [HIGH CONFIDENCE]:** siapkan database tes yang terlindungi guard nama/host melalui workflow khusus; pipeline lint/typecheck/unit/integrasi/build; smoke test versi release; verifikasi backup database bersama upload dan restore di lingkungan terpisah; health check/readiness, alert kegagalan, serta log dengan correlation ID tanpa secret. Jika tetap satu instance, disk upload persisten dan backup teruji dapat digunakan; object storage dibutuhkan sesuai pola deployment, tidak wajib hanya untuk mengganti teknologi. Acuan: ASVS konfigurasi/logging dan runbook repo. **[UNCERTAIN]** implementasi di server nyata perlu bukti terpisah.

## 5. Arah UI/UX yang diusulkan

**[ESTIMATED — usulan desain]** Karakter yang disarankan: **corporate minimal**. Pertahankan identitas navy/charcoal dengan putih dan abu lembut, lalu gunakan warna perusahaan secara terkendali. Warna, ukuran, dan susunan di bawah adalah keputusan desain usulan berdasarkan preferensi pengguna; bukan hasil eksperimen A/B.

| Elemen | Arah penyempurnaan | Dasar keputusan |
|---|---|---|
| Warna | Kanvas off-white, panel putih, teks charcoal; satu aksen utama; status memakai warna semantik | Preferensi pengguna + Nielsen minimalist design; semua pasangan wajib lolos kontras |
| Tipografi | Satu keluarga sans-serif, hierarki nama/judul/label jelas, teks isi nyaman dibaca | Konsistensi dan keterbacaan; loading font harus direncanakan, jangan hanya mengandalkan nama font di CSS |
| Spasi | Skala spacing konsisten, grouping form jelas, ruang lega di area identitas dan CTA | Nielsen recognition/consistency |
| Komponen | Button/input/select/dialog/table/badge/empty/loading/error memakai varian yang sama | Mengurangi ketidakkonsistenan dan biaya pemeliharaan |
| Ikon | Satu gaya ikon; label pada aksi penting; warna brand media sosial dibatasi sebagai aksen kecil | Keterkenalan fungsi dan preferensi tampilan tenang |
| Efek | Border tipis, bayangan ringan, radius moderat, animasi hanya untuk feedback dan menghormati reduced motion | Preferensi pengguna + aksesibilitas |

### Kartu publik

Urutan usulan: **logo dan pilihan bahasa → foto/identitas → nama, jabatan, perusahaan → Simpan Kontak → aksi kontak → rincian → footer privasi**. Struktur dasarnya sudah ada; penyempurnaan berfokus pada kualitas hierarki, format data, dan konsistensi.

- Satu CTA utama “Simpan Kontak”; secondary action WhatsApp/Telepon/Email sesuai field yang tersedia, lalu Bagikan dengan bobot visual lebih ringan.
- Nama dan jabatan menjadi pusat perhatian. Sediakan perilaku untuk nama panjang, gelar, logo beragam rasio, tanpa foto, serta field minimal.
- Kontak cukup ditampilkan sebagai baris yang rapi; tautan custom menggunakan label agar tidak menjadi beberapa ikon generik yang sulit dibedakan.
- Beri petunjuk singkat cara impor kontak sesuai platform setelah download bila dibutuhkan; jangan menampilkan status “berhasil disimpan” hanya karena request `.vcf` selesai.
- Jika CTA dibuat sticky pada mobile, uji keyboard/zoom dan pastikan tidak menutupi konten. Implementasinya merupakan pilihan desain setelah peninjauan layar.

### Dashboard dan daftar profil

- Sidebar desktop sederhana; drawer mobile lengkap. Konteks perusahaan selalu jelas di header dan editor.
- Dashboard menonjolkan profil aktif, draft yang perlu dituntaskan, aktivitas periode terpilih, serta akses cepat Tambah Profil. Definisi metrik harus terlihat.
- Daftar profil mengutamakan pencarian, status, nama/jabatan, perusahaan/konteks, dan last updated; filter tanggal/departemen lanjutan dapat dilipat.
- Kurangi deretan aksi per baris: tampilkan Edit dan QR sebagai aksi utama, lalu menu tindakan lain dengan label. Pisahkan arsip dari publikasi untuk mengurangi salah tekan.
- Empty state membedakan belum ada profil dari tidak ada hasil filter. Tautan nama membuka editor/detail secara konsisten.

### Editor profil

- Kelompokkan menjadi Identitas, Pekerjaan & Kontak, Informasi Tambahan, dan Tampilan & Privasi. Gunakan navigasi bagian/accordion bila uji layar menunjukkan formulir terlalu panjang.
- Preview renderer yang sama berada di samping pada desktop dan menjadi panel/aksi preview pada mobile; jangan memaksa pengguna menggulir seluruh formulir untuk melihat hasil.
- Tampilkan perusahaan pemilik, status publikasi, perubahan belum disimpan, dan waktu simpan terakhir dengan bahasa sederhana.
- Footer aksi tetap mudah dijangkau; validasi per field, pilihan “gunakan nomor mobile untuk WhatsApp”, crop foto yang dapat ditinjau, dan default perusahaan dengan override yang jelas.
- Format nomor dapat membantu input lokal dengan normalisasi eksplisit ke format internasional; jangan mengubah nomor ambigu secara diam-diam.

### Workspace QR

- Default pada QR dinamis karena alamatnya dapat membuka data terbaru setelah pembaruan profil. Direct-vCard adalah snapshot; tampilkan perbedaannya secara ringkas.
- Tampilkan pengaturan umum terlebih dahulu; quiet zone/error correction menjadi pengaturan lanjutan dengan preset yang aman.
- Saat preview gagal, beri penyebab yang dapat ditindaklanjuti dan nonaktifkan unduhan konfigurasi yang sama sampai valid. Saat ini pesan error generik dan tautan unduh tetap aktif; lihat [qr-manager.tsx:83](<C:/Users/IT WIG/Desktop/vcard-wig/src/components/admin/qr-manager.tsx:83>).
- Setelah F04 diselesaikan, sediakan paket cetak profesional dengan nama, perusahaan, label scan, dan QR. Ukuran cetak dipilih melalui uji scan fisik, tidak dijamin oleh ukuran pixel saja.

Acuan UI/UX keseluruhan: [10 Usability Heuristics Nielsen](https://www.nngroup.com/articles/ten-usability-heuristics/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), serta [WAI-ARIA Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Preferensi visual pengguna tetap menjadi arah artistik utama.

## 6. Pengembangan fitur yang layak dibangun

**[ESTIMATED — prioritas produk berdasarkan bukti audit dan asumsi penggunaan internal perusahaan]**

| Urutan | Pengembangan | Manfaat dan syarat penerimaan |
|---|---|---|
| 1 | Guard perusahaan, konflik versi, identitas URL permanen, akses foto terkendali | Menyelesaikan F02–F05; kriteria uji tercantum pada tiap temuan |
| 2 | Editor terpadu dengan preview akurat, save/publish yang jelas, navigasi mobile lengkap | Menyelesaikan F07–F10; alur admin dan kartu publik konsisten |
| 3 | Impor kontak massal | Jika data karyawan dikelola dalam spreadsheet: template, preview mapping, validasi per baris, deteksi duplikat, pilihan update/create, batas perusahaan, dan hasil impor yang dapat ditelusuri. Default tidak langsung memublikasikan |
| 4 | Template brand perusahaan dan duplikasi profil | Default logo/warna/kontak perusahaan sudah ada sebagian; perlu konfigurasi layout terbatas, default field yang jelas, dan duplicate-to-draft agar onboarding konsisten |
| 5 | Ekspor QR massal, lembar cetak, dan signature email | Dibangun sesudah URL permanen aman; uji nama file, perusahaan, data tersembunyi, dan kualitas cetak. NFC dapat memakai URL profil dinamis yang sama bila dibutuhkan |
| 6 | Review/peran Editor–Publisher dan self-service terbatas | Hanya bila ada kebutuhan HR/marketing: edit hanya profil/field yang diizinkan, usulan perubahan, persetujuan, riwayat revisi; jangan memberikan hak admin luas kepada semua karyawan |
| 7 | Analitik operasional yang akurat | Samakan definisi view/unduh/klik, perbaiki timezone/deduplikasi; baru tambahkan perbandingan periode dan ukuran rasio yang berlabel benar |
| 8 | Integrasi master karyawan/SSO | Jika sistem master dan pemilik data sudah disepakati: pemetaan ID stabil, field owner, offboarding otomatis, rekonsiliasi, serta audit. Hindari dua master yang saling menimpa |

Butir 3–8 bergantung proses bisnis dan volume aktual. Dasar kontrolnya tetap ASVS untuk hak akses/integritas serta Nielsen untuk alur kerja. Tidak ada bukti kebutuhan saat ini untuk menambahkan chatbot, jejaring sosial internal, gamifikasi, aplikasi native, atau sistem CRM penuh; fitur tersebut memerlukan kebutuhan pengguna yang terpisah sebelum masuk backlog.

## 7. Urutan implementasi dan penerimaan

| Tahap | Lingkup yang disarankan | Bukti selesai yang diperlukan |
|---|---|---|
| A — stabilisasi | F01–F06; proteksi konteks, versi, URL, file, dan ekspor | Audit paket ulang; tes akses publik/admin pada foto; tes dua editor/dua tab; QR lama tetap ke identitas sama; ekspor teks aman di aplikasi target |
| B — perapihan pengalaman | F07–F10; design tokens/komponen; navigasi; editor; kartu publik; QR | Peninjauan render desktop/mobile, keyboard/zoom, pesan error, save/publish, preview identik, pengujian regresi profil yang dipakai |
| C — operasional | F11–F14; setup tes/CI, pemulihan, monitoring, metrik, kebijakan publik | Suite integrasi, smoke test staging, restore database+upload, bukti job berjalan, pemeriksaan header/akses server dan baseline performa |
| D — produktivitas | Impor, template, batch QR, signature; approval/integrasi sesuai proses | UAT admin/HR, validasi duplikat dan scope, rollback impor, offboarding, dokumen pemilik data |

Tahap A dan penentuan design system dapat berjalan beriringan, tetapi perluasan publikasi dan fitur massal sebaiknya menunggu koreksi identitas/konteks. Urutan ini merupakan rekomendasi audit; estimasi durasi/biaya memerlukan ukuran tim, volume profil, serta kebijakan akses dan approval.

Kriteria UI yang diusulkan: seluruh menu berwenang dapat dicapai pada mobile; form error terasosiasi; tidak kehilangan perubahan tanpa penjelasan; konten reflow pada 320 CSS px; pengujian keyboard dan zoom; nama panjang/gelar/field tersembunyi tetap benar. Pengecualian reflow pada tabel dua dimensi mengikuti WCAG dan tidak membenarkan overflow seluruh halaman.

Target performa rilis publik yang disarankan mengikuti Google: **LCP <=2.5 detik, INP <=200 milidetik, CLS <=0.1 pada persentil ke-75**, dievaluasi mobile/desktop terpisah. Angka ini adalah target dari [Web Vitals](https://web.dev/articles/vitals), bukan hasil pengukuran aplikasi ini. Pengukuran lab tidak menggantikan bukti pengguna nyata.

UAT perangkat harus mencakup scan QR dan impor `.vcf` pada Android, iPhone, Google Contacts, dan Outlook dengan pencatatan field nama/gelar/foto/nomor/alamat. Daftar di [PHASE_5_DEVICE_UAT.md](<C:/Users/IT WIG/Desktop/vcard-wig/docs/PHASE_5_DEVICE_UAT.md>) masih mencantumkan pending; audit ini tidak mengubah status tersebut. vCard 3.0 tidak perlu diganti hanya karena 4.0 tersedia: tetapkan format berdasarkan kebutuhan kompatibilitas yang diuji; [RFC 2426](https://www.rfc-editor.org/info/rfc2426/) adalah spesifikasi lama yang telah digantikan RFC 6350.

## 8. Hasil pemeriksaan saat audit

| Pemeriksaan | Hasil | Batas interpretasi |
|---|---|---|
| ESLint | PASS, exit 0 | Awalnya satu warning pada export config probe audit; sudah diperbaiki dan diperiksa ulang secara terarah. Source aplikasi tidak memiliki error lint pada pemeriksaan ini |
| TypeScript `tsc --noEmit` | PASS, exit 0 | Pemeriksaan tipe lokal; lihat typecheck.log |
| Unit test tersedia `vitest run src` | PASS: 35 dari 35, 11 file | Tidak mencakup suite integrasi database |
| Probe komponen editor | PASS: 2 dari 2 | PASS berarti dua perilaku bermasalah berhasil direproduksi, bukan sudah diperbaiki |
| Probe CSV, slug, stale edit, event race, file, kontras | 6 pemeriksaan berhasil mereproduksi kondisi | Operasi Prisma dimock; bukan load test atau UAT produksi |
| Audit dependensi `--omit=dev` | 18 entri paket: 1 critical, 11 high, 6 moderate | Detail dan advisory ada di dependency-audit.json; bukan bukti kompromi |
| Build standar `npm run build` | Gagal | Turbopack junction Prisma pada Windows: `The file exists (os error 80)`; bukan bukti error logika bisnis |
| Build alternatif `npm run build -- --webpack` | PASS, exit 0 | Kompilasi, TypeScript, generasi halaman, dan build traces selesai; tidak menggantikan UAT atau membuktikan build Turbopack sudah pulih |
| Suite integrasi DB | Tidak dijalankan | `vcard_wig_test` belum tersedia; preflight baca-saja gagal dengan ER_BAD_DB_ERROR |
| Review visual browser | Tidak terlaksana | Tool tidak dapat memastikan URL aktif Windows |
| Produksi, perangkat fisik, performa nyata | Belum diverifikasi | Memerlukan akses/lingkungan dan bukti pengujian tersendiri |

Bukti mesin: [unit-tests.json](<C:/Users/IT WIG/Desktop/vcard-wig/docs/audit-2026-11-09/unit-tests.json>), [editor-probes.json](<C:/Users/IT WIG/Desktop/vcard-wig/docs/audit-2026-11-09/editor-probes.json>), [behavior-probes.json](<C:/Users/IT WIG/Desktop/vcard-wig/docs/audit-2026-11-09/behavior-probes.json>), [lint.log](<C:/Users/IT WIG/Desktop/vcard-wig/docs/audit-2026-11-09/lint.log>), [typecheck.log](<C:/Users/IT WIG/Desktop/vcard-wig/docs/audit-2026-11-09/typecheck.log>).

## 9. Acuan dan sumber

Sumber aplikasi utama sudah ditautkan dekat setiap temuan. Dokumentasi repo dipakai sebagai catatan implementasi sebelumnya, bukan bukti keadaan server terkini: [README.md](<C:/Users/IT WIG/Desktop/vcard-wig/README.md>), [ARCHITECTURE.md](<C:/Users/IT WIG/Desktop/vcard-wig/docs/ARCHITECTURE.md>), [PHASE_6_SECURITY_REVIEW.md](<C:/Users/IT WIG/Desktop/vcard-wig/docs/PHASE_6_SECURITY_REVIEW.md>), [PHASE_6_OPERATIONS.md](<C:/Users/IT WIG/Desktop/vcard-wig/docs/PHASE_6_OPERATIONS.md>).

Acuan primer yang diperiksa 9 November 2026:

- [OWASP ASVS 5.0.0](https://asvs.owasp.org/) — acuan kontrol keamanan aplikasi; versi stabil yang ditampilkan situs resmi, terbit 30 Mei 2025. Audit ini bukan verifikasi seluruh persyaratan ASVS.
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) — autentikasi, recovery, MFA, throttling, dan monitoring.
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) — lokasi penyimpanan, kontrol akses, serta batas upload/download.
- [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection) — formula spreadsheet dan keterbatasan mitigasi CSV.
- [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) — kriteria aksesibilitas yang dirujuk.
- [WAI-ARIA Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — perilaku fokus/keyboard dialog.
- [Nielsen: 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) — prinsip evaluasi UX, terakhir ditinjau pada halaman sumber 30 Januari 2024; bukan bukti hasil usability test aplikasi ini.
- [Google Web Vitals](https://web.dev/articles/vitals) — ambang target LCP/INP/CLS dan persentil ke-75; halaman sumber mencantumkan pembaruan 31 Oktober 2024.
- [Next.js advisory GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) — informasi penerbit tentang risiko, prasyarat platform, dan versi patched untuk advisory tersebut.

## 10. Langkah berikut yang konkret

**[HIGH CONFIDENCE] Paket kerja pertama yang direkomendasikan:** pembaruan dependensi disertai triase advisory, koreksi akses foto, penguncian konteks perusahaan, identitas QR permanen, konflik versi penyimpanan, dan ekspor aman. Sesudah itu, implementasikan design system sederhana, navigasi responsif lengkap, serta satu renderer kartu publik/preview. Fitur produktivitas massal menyusul setelah jalur dasar dapat diuji ulang.

Sebelum menentukan estimasi proyek, bukti tambahan yang diperlukan adalah jumlah perusahaan/profil/admin dan pertumbuhannya; peran HR/marketing dalam approval; perangkat kontak target; konfigurasi dan versi server aktual; target publik/indexing; serta hasil review render yang belum dapat dilakukan. Informasi ini tidak menghalangi perbaikan temuan terverifikasi di atas.
