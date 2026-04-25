import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = "https://music-recommendation-fawn.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Music Recommendation — YouTubeで似た曲を発見",
    template: "%s | Music Recommendation",
  },
  description:
    "YouTubeのリンクや曲名・アーティスト名を入れるだけで、似ている曲を10曲まとめて発見。類似度順・人気度順で並べ替え、Spotify・Apple Music・Amazon Musicで今すぐ聴ける。",
  keywords: [
    "音楽レコメンド",
    "似てる曲",
    "YouTube 音楽",
    "曲 おすすめ",
    "music recommendation",
    "similar songs",
    "曲探し",
    "音楽発見",
    "プレイリスト",
  ],
  authors: [{ name: "Music Recommendation" }],
  openGraph: {
    title: "Music Recommendation — YouTubeで似た曲を発見",
    description:
      "YouTubeのリンクや曲名を入れるだけで似た曲を10曲発見。Spotify・Apple Music・Amazon Musicへのリンクも。",
    type: "website",
    url: BASE_URL,
    siteName: "Music Recommendation",
  },
  twitter: {
    card: "summary_large_image",
    title: "Music Recommendation — YouTubeで似た曲を発見",
    description:
      "YouTubeのリンクや曲名を入れるだけで似た曲を10曲発見。Spotify・Apple Music・Amazon Musicへのリンクも。",
  },
  alternates: {
    canonical: BASE_URL,
  },
  verification: {
    google: "gqM3dBW1f-LDqaHoZeIbvRISZ0tNfd-XvuPzFzr_LHQ",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Music Recommendation",
  url: BASE_URL,
  description:
    "YouTubeのリンクや曲名・アーティスト名を入れるだけで似た曲を10曲発見できる音楽レコメンドサービス。",
  applicationCategory: "MusicApplication",
  operatingSystem: "Web",
  inLanguage: "ja",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "JPY",
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
