import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getLocale } from "@/i18n/server";

export const metadata: Metadata = {
  title: {
    default: "Corporate vCard",
    template: "%s | Corporate vCard",
  },
  description: "Corporate digital contact card administration",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
