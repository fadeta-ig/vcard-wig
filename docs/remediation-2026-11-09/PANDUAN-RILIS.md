# Panduan rilis perbaikan vCard 9 November 2026

**Lingkup:** aplikasi Next.js/Prisma yang sudah ada. Tidak ada deployment produksi yang dilakukan dari workspace ini. Jangan menjalankan migrate reset atau mengganti database produksi dengan database tes.

## Persiapan

1. Tentukan direktori aplikasi, database, service account, URL HTTPS, dan lokasi upload persisten yang benar di server. Simpan konfigurasi/secret di luar Git.
2. Hentikan sementara penulisan profil/upload selama backup dan pemindahan foto, atau gunakan maintenance window yang disepakati.
3. Buat backup database dengan `npm run db:backup`; pastikan hasil SQL dan checksum tersimpan. Buat pula backup `UPLOAD_DIR` yang lama dan `PRIVATE_UPLOAD_DIR` bila sudah dipakai. SQL tidak berisi gambar.
4. Simpan artefak rilis sebelumnya. Verifikasi kemampuan restore database dan gambar ke lingkungan terpisah sebelum cutover yang sebenarnya.

Pada Windows, bila mysqldump tidak berada di PATH, atur `MYSQL_DUMP_BIN` ke executable yang memang terpasang. Pada Ubuntu skrip memakai mariadb-dump secara default. Jangan menyalin password ke command arguments.

## Konfigurasi runtime

```dotenv
APP_URL="https://DOMAIN-PRODUKSI-YANG-BENAR"
NEXT_PUBLIC_APP_URL="https://DOMAIN-PRODUKSI-YANG-BENAR"
UPLOAD_DIR="./public/uploads"
PRIVATE_UPLOAD_DIR="./storage/private/profile-photos"
PRIVACY_CONTACT_EMAIL=""
MFA_ENCRYPTION_KEY=""
```

Contoh path di atas relatif terhadap direktori aplikasi. Untuk deployment dengan folder release berganti, gunakan lokasi persisten yang dibagikan antar-release dan berada di luar web root publik. Jangan membiarkan nginx melayani direktori foto privat langsung. Direktori privat dan backup harus dimiliki service account aplikasi dengan izin terbatas.

`MFA_ENCRYPTION_KEY` opsional, berupa 32 byte acak dalam 64 karakter hex. Jika MFA akan digunakan, operator membuat kunci di lingkungan terlindungi, memasangnya melalui konfigurasi service, dan menyimpan backup kunci secara aman. Kunci harus sama pada semua instance dan tetap tersedia saat restore. Jangan merotasi/menghapusnya tanpa prosedur migrasi secret. Jangan menggunakan nilai kunci test fixture. Enrollment dilakukan pemilik akun dari menu Keamanan akun; tidak ada akun yang otomatis diaktifkan MFA.

## Migrasi database

```bash
npm ci
npm run db:generate
npm run db:deploy
```

Tiga migrasi baru menambahkan version/firstPublishedAt/visibilitas/indexing, reservasi hash slug, dedupe event, antrean penghapusan aset, serta MFA/recovery opsional. Profil lama dan pengaturan indexing lama dipertahankan. Profil baru default tidak diindeks mesin pencari. Profil legacy Arsip dikunci URL secara konservatif bila riwayat penerbitannya tidak lengkap.

Perubahan database bersifat menambah tabel/kolom serta backfill; tidak menghapus kontak yang ada. Fitur hapus permanen hanya berjalan ketika administrator melakukan tindakan tersebut pada profil Arsip.

## Pindahkan foto lama

Jalankan dari direktori fisik release yang benar, bukan melalui path symlink, dengan environment runtime yang sama. Skrip menolak symlink dan root yang saling tumpang tindih.

```bash
node scripts/migrate-private-photos.mjs
node scripts/migrate-private-photos.mjs --apply
```

Perintah pertama hanya dry-run dan menampilkan jumlah file serta source/destination. Perintah kedua membuat backup per file, menyalin file ke storage privat, memeriksa SHA-256 kedua salinan, mencatat manifest, lalu menghapus file sumber individual yang sudah terverifikasi. URL yang tersimpan di database tidak berubah. Skrip dapat dijalankan ulang untuk sumber yang masih tersisa; jika file tujuan berbeda checksum, skrip berhenti tanpa menggantinya.

Jika UPLOAD_DIR/PRIVATE_UPLOAD_DIR memang di luar direktori aplikasi, tinjau dahulu path absolutnya dan gunakan `--allow-external-storage` pada dry-run serta apply. Flag ini tidak mengizinkan root yang bertumpang tindih atau symlink. Pastikan source adalah folder foto aplikasi tersebut dan destination adalah storage privat aplikasi tersebut.

Setelah migrasi, jangan menyisakan salinan foto lama di web root publik. Invalidate cache gambar/proxy/CDN lama, termasuk image optimization cache dari rilis lama. File yang sudah diunduh pengunjung tidak dapat ditarik kembali. Backup berisi informasi kontak harus mengikuti retensi dan pembatasan akses yang ditetapkan perusahaan.

## Build dan restart

```bash
npm run lint
npm run typecheck
npm run build
```

Build default sekarang menggunakan Webpack agar stabil di lingkungan Windows yang mengalami masalah junction Turbopack. `npm run build:turbo` tersedia sebagai opsi terpisah; keberhasilannya belum menjadi klaim rilis ini. Build yang sama tetap memerlukan konfigurasi runtime yang benar ketika aplikasi dijalankan.

Restart process manager/container dengan environment produksi. Jangan mengekspos development server atau Prisma development tooling ke internet.

## Pemeriksaan setelah restart

- `/api/health/live` harus 200; `/api/health/ready` harus 200 jika database tersedia dan 503 bila tidak siap.
- Login, perusahaan terpilih, daftar profil, simpan perubahan, serta deteksi konflik dua editor.
- Profil publik aktif, vCard, QR dinamis lama, dan logo perusahaan.
- Foto profil Draft/Nonaktif/Arsip/tersembunyi harus ditolak untuk anonim; admin berwenang masih dapat meninjau file yang terikat pada profilnya. Foto publik harus no-store.
- Endpoint `/_next/image` tidak boleh dipakai untuk meng-cache foto profil; hanya aset perusahaan yang diizinkan oleh konfigurasi lokal.
- Menu lengkap dan Keluar pada mobile; dialog keyboard/fokus; tidak ada overflow seluruh halaman pada 320 CSS px. Tabel/grafik dapat memiliki area scroll sendiri.
- Uji hapus permanen dengan profil contoh Arsip yang memang boleh dibuang, bukan kontak nyata tanpa persetujuan pemilik data. Periksa foto/data relasi, audit minimal, dan penolakan penggunaan kembali slug.
- Jika memakai MFA, lakukan enrollment akun uji, simpan recovery code, dan uji login/recovery sebelum rollout ke akun penting. Recovery code sekali pakai; kode TOTP yang sudah diterima tidak dapat dipakai ulang dalam jendela yang sama.

## Pemeliharaan dan pemulihan

Jadwalkan `npm run maintenance:cleanup` dengan service account aplikasi dan pantau exit status/log. Job mencakup retensi event/sesi/throttle, dedupe kedaluwarsa, enrollment MFA kedaluwarsa, dan percobaan ulang penghapusan foto yang tertunda. Pantau antrean `AssetDeletionTask`, khususnya attempts yang terus naik.

Simpan backup database, foto perusahaan, foto privat, dan kunci MFA dalam recovery set yang konsisten dan terenkripsi di target off-host. Keberadaan skrip/cron contoh bukan bukti backup/cleanup benar berjalan: verifikasi eksekusi dan alert pada server yang sebenarnya.

Untuk rollback aplikasi, gunakan artefak sebelumnya beserta konfigurasi storage yang sesuai. Jika rollback ke source lama yang hanya membaca foto dari public/uploads, pertimbangkan dampak privasi sebelum menyalin ulang gambar ke lokasi publik. Bila database perlu dipulihkan, gunakan database pemulihan baru dan recovery set yang konsisten, bukan overwrite spontan terhadap database aktif.

## Verifikasi pengembang tanpa full suite

```bash
npm run db:test:prepare
npm run test:critical
```

Perintah pertama hanya mengizinkan database khusus `vcard_*test` di loopback, berbeda dari database aplikasi. Kredensial tes dapat memakai `TEST_DATABASE_USER` dan `TEST_DATABASE_PASSWORD`; jangan mengarahkan test runner ke server produksi. Workflow CI yang ditambahkan menjalankan verifikasi terarah, bukan full suite. Workflow tersebut belum dijalankan pada GitHub dari pekerjaan lokal ini.
