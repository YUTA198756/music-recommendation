import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Music Recommendation",
  description: "YouTubeリンクを入れるだけで似た曲を10曲発見。類似度・人気度でソート、掘り下げ探索も。",
  openGraph: {
    title: "Music Recommendation",
    description: "YouTubeリンクを入れるだけで似た曲を10曲発見。",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Music Recommendation",
    description: "YouTubeリンクを入れるだけで似た曲を10曲発見。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
