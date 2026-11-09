import type { Locale } from "@/i18n/messages";

const id = {
  contact: "Kontak",
  social: "Media sosial",
  address: "Alamat",
  about: "Tentang",
  saveContact: "Simpan ke Kontak",
  call: "Hubungi",
  workPhone: "Telepon kantor",
  mobilePhone: "Handphone",
  whatsapp: "WhatsApp",
  email: "Kirim email",
  website: "Buka website",
  share: "Bagikan",
  shareTitle: "Bagikan kartu kontak",
  shareText: "Kartu kontak digital",
  linkCopied: "Tautan berhasil disalin.",
  shareFailed: "Tautan tidak dapat dibagikan. Silakan salin dari bilah alamat.",
  opensNewTab: "membuka tab baru",
  profilePhotoAlt: "Foto profil",
  companyLogoAlt: "Logo perusahaan",
  inactiveTitle: "Profil kontak tidak aktif",
  inactiveDescription:
    "Profil ini sedang tidak tersedia. Silakan hubungi perusahaan terkait untuk informasi terbaru.",
  notFoundTitle: "Profil tidak ditemukan",
  notFoundDescription:
    "Tautan profil tidak tersedia atau belum dipublikasikan.",
  privacy: "Privasi",
  privacyTitle: "Kebijakan Privasi",
  privacyIntro:
    "Halaman kartu kontak menampilkan informasi profesional yang dipublikasikan oleh administrator perusahaan.",
  privacyAnalyticsTitle: "Data penggunaan",
  privacyAnalytics:
    "Aplikasi menyimpan catatan kunjungan dan interaksi, jenis aktivitas, waktu, hash token browser acak, user-agent, dan origin/path perujuk yang dibatasi panjangnya; query URL perujuk dibuang. Catatan ini dipakai untuk laporan agregat, deduplikasi, dan pembatasan penyalahgunaan. Token mentah berada di cookie browser HttpOnly; database hanya menyimpan hash. Aplikasi tidak menyimpan alamat IP atau hash IP pada catatan ini. Log infrastruktur dikelola terpisah.",
  privacyControlTitle: "Kontrol informasi",
  privacyControl:
    "Informasi kontak hanya ditampilkan sesuai pengaturan visibilitas profil. Profil Draft dan Arsip tidak dapat diakses publik. Pengaturan indeks mesin pencari tidak membatasi akses: siapa pun yang memiliki tautan profil aktif tetap dapat membukanya. Salinan kontak atau gambar yang sudah diunduh orang lain tidak dapat ditarik kembali.",
  privacyContactTitle: "Tautan eksternal",
  privacyContact:
    "Tautan telepon, email, WhatsApp, website, dan media sosial akan membuka aplikasi atau layanan pihak ketiga yang dipilih pengguna.",
  backToProfile: "Kembali ke profil",
} as const;

export type PublicProfileCopy = { [Key in keyof typeof id]: string };

const en: PublicProfileCopy = {
  contact: "Contact",
  social: "Social media",
  address: "Address",
  about: "About",
  saveContact: "Save to Contacts",
  call: "Call",
  workPhone: "Work phone",
  mobilePhone: "Mobile phone",
  whatsapp: "WhatsApp",
  email: "Send email",
  website: "Open website",
  share: "Share",
  shareTitle: "Share contact card",
  shareText: "Digital contact card",
  linkCopied: "Link copied successfully.",
  shareFailed:
    "The link could not be shared. Please copy it from the address bar.",
  opensNewTab: "opens a new tab",
  profilePhotoAlt: "Profile photo",
  companyLogoAlt: "Company logo",
  inactiveTitle: "Contact profile is inactive",
  inactiveDescription:
    "This profile is currently unavailable. Please contact the company for the latest information.",
  notFoundTitle: "Profile not found",
  notFoundDescription:
    "This profile link is unavailable or has not been published.",
  privacy: "Privacy",
  privacyTitle: "Privacy Policy",
  privacyIntro:
    "Contact-card pages display professional information published by the company administrator.",
  privacyAnalyticsTitle: "Usage data",
  privacyAnalytics:
    "The application stores individual visit and interaction records, event types, timestamps, a hash of a random browser token, and length-limited user-agent and referrer origin/path. Referrer URL queries are discarded. Records support aggregate reports, deduplication and abuse prevention. The raw token is kept in an HttpOnly browser cookie; only its hash is stored in the database. These application records contain no IP address or IP hash. Infrastructure logs are managed separately.",
  privacyControlTitle: "Information control",
  privacyControl:
    "Contact information is displayed according to profile visibility settings. Draft and Archived profiles are not publicly accessible. Search-engine indexing settings do not restrict access: anyone with an active profile link can still open it. Previously downloaded contacts or images cannot be recalled.",
  privacyContactTitle: "External links",
  privacyContact:
    "Phone, email, WhatsApp, website, and social links open the application or third-party service selected by the user.",
  backToProfile: "Back to profile",
};

export function publicProfileMessages(locale: Locale): PublicProfileCopy {
  return locale === "en" ? en : id;
}
