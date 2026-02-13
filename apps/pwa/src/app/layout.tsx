import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { Toaster } from 'sonner';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AutoDesign Cloud System v3.5",
  description: "Automatizácia personalizácie grafiky a tlačového vyraďovania",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        <div className="bg-halo" />
        <Toaster position="top-right" richColors />
        <Sidebar />
        <main className="ml-[280px] min-h-screen p-8">
          {children}
        </main>
      </body>
    </html>
  );
}
