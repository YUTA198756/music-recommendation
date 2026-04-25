import { redirect } from "next/navigation";
import type { Metadata } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

type Props = { params: Promise<{ seed: string }> };

async function fetchSeedData(seed: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: seed }),
      next: { revalidate: 3600 },
    });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seed } = await params;
  const data = await fetchSeedData(seed);

  if (!data) {
    return {
      title: "Music Recommendation",
      description: "YouTubeリンクから似た曲を10曲見つけます",
    };
  }

  const seedTrack = data.seed as { title: string; artists: string[] };
  const recs = (data.recommendations as { title: string }[]).slice(0, 5);
  const ogTitle = `「${seedTrack.title}」に似た曲を発見！`;
  const description = recs.map((r) => r.title).join(" / ");

  return {
    title: `${ogTitle} | Music Recommendation`,
    description,
    openGraph: {
      title: ogTitle,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { seed } = await params;
  redirect(`/?seed=${seed}`);
}
