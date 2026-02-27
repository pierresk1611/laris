import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { Toaster } from 'sonner';
import AuthProvider from "@/components/AuthProvider";
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LARIS AUTOMAT",
  description: "Automatizácia personalizácie grafiky a tlačového vyraďovania",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="sk">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        <AuthProvider>
          <div className="bg-halo" />
          <Toaster position="top-right" richColors />
          {session && <Sidebar />}
          <main className={`${session ? 'ml-[280px] p-8' : ''} min-h-screen`}>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
