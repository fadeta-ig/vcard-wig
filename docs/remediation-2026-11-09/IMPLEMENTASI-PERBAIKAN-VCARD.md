# Implementasi perbaikan audit vCard

Tanggal: 9 November 2026, Asia/Jakarta. Dasar pekerjaan: laporan audit lokal 9 November 2026 dan tambahan pengguna mengenai hapus permanen profil Arsip. **Full test suite tidak dijalankan.**

**[VERIFIED]** Pernyataan implementasi di bawah bersumber dari source workspace dan artefak pemeriksaan yang ditautkan. **[UNCERTAIN]** Keadaan server produksi, konfigurasi proxy/storage, hasil CI GitHub, UAT perangkat fisik, serta kapasitas beban produksi belum diverifikasi. Penilaian kesederhanaan/elegansi UI merupakan pertimbangan desain, bukan hasil studi pengguna.

## Perubahan sistem

| Temuan | Perbaikan source | Verifikasi dan batas |
|---|---|---|
| F01 dependensi | Next.js 16.4.5, React 19.3.1, Prisma/adapter/client 7.10.1, Sharp 0.35.5, Zod 4.6.7, MariaDB driver 3.5.5, pembaruan transitif dan alat pengujian | Hasil audit registry final disimpan terpisah. Prisma tetap pada seri stabil 7. Override minimatch hanya untuk typescript-estree; lint/typecheck digunakan untuk memeriksa kompatibilitas |
| F02 akses foto | Foto dan thumbnail disimpan di storage privat; route memeriksa status, visibilitas, perusahaan, serta sesi admin. Cache foto no-store; image optimizer hanya menerima aset perusahaan | Pengujian integrasi akses anonim Draft/Aktif/Nonaktif/tersembunyi; konfigurasi reverse proxy/storage produksi tetap perlu mengikuti panduan rilis |
| F03 konteks perusahaan | Header pemilik editor dibandingkan dengan perusahaan terpilih dan perusahaan record. Switcher melindungi perubahan belum disimpan dan membuka daftar perusahaan baru. Editor baru memakai key perusahaan | Uji komponen dan integrasi konteks; mutasi dengan konteks lama ditolak 409 |
| F04 URL QR | firstPublishedAt terpisah dari publishedAt; slug terkunci setelah pernah terbit. Reservasi hash slug bertahan setelah arsip, pemulihan, dan penghapusan permanen. Migrasi juga mereservasi slug lama yang ditemukan dalam audit | Uji lifecycle; drill upgrade dari dua migrasi lama menggunakan profil contoh dan riwayat rename |
| F05 konflik edit | Kolom version dan pembaruan versi bersyarat dalam transaksi. Berlaku pada isi profil, status, foto, dan social-link API | Uji editor lama, status lama, serta konteks salah; konflik mendapat 409 dan pengguna diminta meninjau data terbaru |
| F06 CSV | Semua field teks dikutip; awalan formula dan kontrol berbahaya dinetralkan; nilai angka tetap angka | Pengujian prefiks ASCII/full-width, spasi/kontrol, separator, dan kutip. Perilaku simpan ulang aplikasi spreadsheet eksternal belum diuji |
| F07 simpan/publikasi | Simpan & publikasikan menyimpan isi dan menyelesaikan upload/penghapusan foto sebelum menerbitkan. Penanda dirty state, guard navigasi/keluar, validasi dekat field, serta penjelasan dampak profil aktif | Uji urutan permintaan dan kegagalan simpan. Foto yang dihapus dari editor kini menunggu aksi Simpan. Setiap langkah memakai versi terbaru; kegagalan upload tidak memublikasikan draft |
| F08 navigasi | Drawer mobile memuat seluruh menu berwenang dan Keluar; tombol Keluar juga dapat dijangkau dari header tablet/mobile. Nama aksesibel dan aria-current ditambahkan | Pemeriksaan browser pada data contoh lokal dan pemeriksaan source; bukan UAT perangkat fisik |
| F09 preview | Satu renderer dan mapper presentasi dipakai kartu publik serta preview. Preview tidak mengirim analitik dan aksinya inert. Pada layar sempit tersedia dialog Pratinjau tanpa harus menggulir seluruh form | Uji nama/gelar dan visibilitas; review browser desktop/mobile |
| F10 aksesibilitas/UI | Foreground dan warna teks brand yang terbaca; minimum halaman 360 px dihapus; dialog native untuk fokus/keyboard; skip link; field error terasosiasi. Perapihan brand lockup, filter, aksi baris, warna, dan komponen | Pemeriksaan browser terarah pada 320 px dan desktop; tidak mengklaim sertifikasi WCAG penuh |
| F11 autentikasi/abuse | Penghitung gagal login atomik, limiter global sebelum password hashing, pembatasan konkurensi, pembacaan body bounded, limiter halaman publik melalui proxy. MFA TOTP opsional, secret terenkripsi AES-GCM, pencegahan replay, dan recovery code hash sekali pakai | Vektor RFC 6238 dan pengujian integrasi MFA. MFA memerlukan kunci server stabil dan enrollment akun; tidak otomatis diaktifkan pada akun pengguna |
| F12 analitik | Deduplikasi event atomik di database, TTL penanda browser selaras 30 menit, agregasi hari Jakarta, pagination laporan dalam SQL, batas ekspor, serta batas pilihan profil | Uji request konkuren satu visitor dan batas hari Jakarta. Tidak dilakukan load test produksi |
| F13 privasi | Visibilitas nomor kantor/mobile/WhatsApp terpisah, pilihan indexing, default profil baru unlisted, kebijakan menjelaskan baris event, cookie, user-agent/referrer, retensi, dan kontak koreksi opsional | Pengaturan indexing profil lama dipertahankan oleh migrasi. Unlisted/noindex tidak sama dengan profil privat |
| F14 operasional | Setup database tes dengan guard, health live/ready, correlation ID error, antrean cleanup foto yang persisten, cleanup enrollment MFA kedaluwarsa, workflow CI terarah, build Webpack stabil, dan panduan rilis | Migrasi bersih dan upgrade legacy diuji lokal. Workflow GitHub dan infrastruktur produksi belum dijalankan/diperiksa |

Pilihan profil pada filter laporan dibatasi 500 agar halaman tetap terbatas; agregasi dan ekspor tetap menghitung seluruh profil sesuai scope. Ekspor dibatasi 10.000 profil per permintaan dan meminta filter dipersempit bila terlampaui. Angka ini merupakan batas implementasi, bukan hasil benchmark kapasitas.

## Hapus permanen profil Arsip

Tindakan tersedia dari menu lainnya pada daftar Arsip dan dari editor profil Arsip. Dialog meminta pengguna mengetik slug profil yang tepat, menjelaskan bahwa tindakan tidak dapat dibatalkan, dan baru mengaktifkan tombol hapus setelah konfirmasi sesuai.

Server mengharuskan sesi valid, CSRF/Origin yang benar, perusahaan yang cocok, versi terbaru, serta status ARCHIVED yang diperiksa di server. Data profil, social link, dan activity event dihapus melalui transaksi. Foto/thumbnail masuk antrean penghapusan persisten di transaksi yang sama dan segera dicoba dibersihkan sesudah commit. Bila berkas terkunci sementara, aksesnya sudah ditolak oleh route dan UI menjelaskan cleanup yang masih tertunda; job pemeliharaan akan mencoba kembali.

Reservasi hash URL dipertahankan tanpa data nama/email/telepon. Audit perubahan profil lama dibersihkan dari snapshot informasi kontak saat hapus permanen; audit peristiwa penghapusan tetap menyimpan aktor, perusahaan, ID record, dan penanda penghapusan. Riwayat administratif tersebut bukan pemulihan profil. Backup yang sudah ada tidak ditulis ulang oleh fitur ini dan mengikuti kebijakan retensi backup perusahaan.

Tidak ada profil pengguna/produksi yang dihapus saat implementasi ini. Pengujian penghapusan menggunakan record contoh di database terisolasi.

## Bukti pemeriksaan

- `critical-tests.json`: pengujian terarah perbaikan keamanan, komponen editor, dan integrasi database.
- `qr-vcard-tests.json`: pengujian QR/vCard serta route aset yang terdampak.
- `migration-drill.json`: upgrade profil contoh dari schema lama, preservasi firstPublishedAt/indexing, dan reservasi slug historis.
- `dependency-audit-final.json`: hasil registry npm setelah pembaruan final.
- `dependency-audit-production.json`: pemeriksaan terpisah dependensi produksi.
- `lint.log`, `typecheck.log`, `build.log`: hasil pemeriksaan kualitas lokal.
- `browser-verification.json`: observasi render/alur browser lokal dan batasnya.
- `runtime-health.json`: respons 200 liveness/readiness pada build lokal dengan database tes.
- `verification-summary.json`: ringkasan pemeriksaan final dan scope yang belum diverifikasi.

Screenshot data contoh: [desktop](./ui-desktop.jpg), [dashboard mobile](./ui-dashboard-mobile.jpg), [kartu publik mobile](./ui-public-mobile.jpg), [pratinjau mobile](./ui-preview-mobile.jpg), serta [dialog hapus permanen](./ui-permanent-delete.jpg). Dashboard dan kartu publik pada viewport 320 CSS px mempunyai lebar dokumen 305 px setelah jatah scrollbar vertikal 15 px; tabel daftar pada viewport 1440 px mempunyai area 1114 px tanpa overflow internal. Angka ini observasi render lokal, bukan benchmark.

Pembatalan guard navigasi melalui dialog konfirmasi browser belum berhasil diverifikasi lewat automasi karena kontrol dialog/input mengalami timeout. Guard pada source tetap mencakup link internal, pergantian perusahaan, Keluar, dan beforeunload; pengujian browser Back/Forward serta pembatalan prompt perlu diperiksa saat UAT. Tab development sempat memakai aset terjemahan client lama ketika berganti server; origin build produksi baru menampilkan label terkini tanpa error konsol yang tertangkap. Screenshot mendahului koreksi akhir teks bantuan media sosial dan label Pratinjau; perubahan teks tersebut diperiksa lint/build.

Perintah yang dipakai untuk pengujian adalah daftar berkas yang eksplisit; `npm run verify`, `npm test` tanpa filter, serta full test suite tidak dijalankan. Status PASS suatu pemeriksaan tidak mewakili kondisi produksi atau kompatibilitas semua aplikasi kontak.

## Rilis dan data yang ada

Gunakan [PANDUAN-RILIS.md](./PANDUAN-RILIS.md). Source baru memerlukan tiga migrasi tambahan sebelum dijalankan terhadap database lama. Foto lama harus dipindahkan dari folder publik menggunakan langkah terverifikasi; mengubah source saja tidak menyingkirkan file statis lama atau salinan yang sudah di-cache/diunduh.

Database aplikasi lokal `vcard_wig` tidak tersedia saat pekerjaan dimulai; percobaan backup mengembalikan Unknown database. Verifikasi dilakukan di `vcard_wig_test` dan database drill yang namanya tercatat dalam bukti, bukan di database aplikasi atau produksi. Preview browser memakai akun dan kontak contoh pada database tes lokal.

Impor massal, integrasi master karyawan/SSO, approval HR, dan paket cetak massal dalam bagian backlog audit tetap merupakan pengembangan terpisah yang bergantung proses bisnis. Pekerjaan ini menyelesaikan perbaikan source temuan audit dan fitur hapus permanen yang diminta.

## Acuan

Dasar kontrol dan UI: OWASP ASVS, OWASP File Upload/Authentication/CSV Injection, WCAG 2.2, dan Nielsen sebagaimana dirinci pada laporan audit awal. Implementasi TOTP diperiksa terhadap [RFC 6238](https://www.rfc-editor.org/info/rfc6238/) dan [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html). Upgrade mengikuti dokumentasi resmi [Next.js 16](https://nextjs.org/docs/app/guides/upgrading/version-16) dan Prisma seri 7. Ini bukan sertifikasi kepatuhan standar atau audit penetrasi produksi.
