import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sanat Yapıları Yönetim Sistemi",
  description: "Şantiye üretim, planlama ve teknik ofis yönetimi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
