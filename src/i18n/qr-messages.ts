import type { Locale } from "@/i18n/messages";

const id = {
  title: "QR Code & vCard",
  subtitle: "Preview dan unduh QR dinamis, QR direct-vCard, serta file kontak.",
  back: "Kembali ke profil",
  preview: "Preview QR",
  settings: "Pengaturan QR",
  qrType: "Jenis QR",
  dynamic: "Dynamic Profile URL",
  direct: "Direct vCard",
  dynamicHint: "Direkomendasikan. Data profil dapat berubah tanpa mengganti QR.",
  directHint: "Data kontak tertanam langsung. QR perlu dibuat ulang ketika data berubah.",
  format: "Format file",
  size: "Ukuran",
  margin: "Margin / quiet zone",
  correction: "Error correction",
  foreground: "Warna QR",
  background: "Warna latar",
  logo: "Logo perusahaan di tengah",
  logoUnavailable: "Unggah logo perusahaan untuk memakai opsi ini.",
  logoCorrection: "Logo aktif: error correction otomatis H.",
  downloadQr: "Unduh QR",
  downloadVcard: "Unduh vCard",
  source: "Isi QR dinamis",
  visiblePolicy: "Direct-vCard dan file kontak hanya memuat field yang diizinkan oleh pengaturan visibilitas.",
  draftWarning: "Profil belum aktif. QR dinamis dapat diunduh, tetapi URL publik akan mengembalikan 404 sampai profil dipublikasikan.",
  inactiveWarning: "Profil sedang nonaktif. QR dinamis tetap sama, tetapi halaman publik menampilkan status nonaktif.",
  archivedWarning: "Profil diarsipkan. URL publik tidak tersedia sampai profil dipulihkan dan dipublikasikan kembali.",
  previewError: "Preview QR gagal dibuat. Periksa kombinasi data dan opsi QR.",
  openPublic: "Buka profil publik",
} as const;

export type QrCopy = { [Key in keyof typeof id]: string };

const en: QrCopy = {
  title: "QR Code & vCard",
  subtitle: "Preview and download dynamic QR, direct-vCard QR, and contact files.",
  back: "Back to profile",
  preview: "QR Preview",
  settings: "QR Settings",
  qrType: "QR type",
  dynamic: "Dynamic Profile URL",
  direct: "Direct vCard",
  dynamicHint: "Recommended. Profile data can change without replacing the QR code.",
  directHint: "Contact data is embedded directly. The QR must be regenerated after data changes.",
  format: "File format",
  size: "Size",
  margin: "Margin / quiet zone",
  correction: "Error correction",
  foreground: "QR color",
  background: "Background color",
  logo: "Company logo in the center",
  logoUnavailable: "Upload a company logo to use this option.",
  logoCorrection: "Logo enabled: error correction is automatically set to H.",
  downloadQr: "Download QR",
  downloadVcard: "Download vCard",
  source: "Dynamic QR content",
  visiblePolicy: "Direct-vCard and contact files only include fields permitted by the visibility settings.",
  draftWarning: "The profile is not active. The dynamic QR can be downloaded, but its public URL returns 404 until publication.",
  inactiveWarning: "The profile is inactive. The dynamic QR stays unchanged, but the public page shows the inactive state.",
  archivedWarning: "The profile is archived. Its public URL remains unavailable until the profile is restored and published again.",
  previewError: "The QR preview could not be generated. Check the contact data and QR options.",
  openPublic: "Open public profile",
};

export function qrMessages(locale: Locale): QrCopy {
  return locale === "en" ? en : id;
}
