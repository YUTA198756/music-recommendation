"use client";

import { useMemo, useState } from "react";

type Track = {
  video_id: string;
  title: string;
  artists: string[];
  album: string | null;
  thumbnail: string | null;
  length: string | null;
  youtube_url: string;
  similarity_rank: number;
  view_count: number;
};

type RecommendResponse = {
  seed: Track;
  recommendations: Track[];
};

type SortMode = "similarity" | "popularity";

function formatViews(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecommendResponse | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("similarity");
  const [history, setHistory] = useState<string[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const sortedRecs = useMemo(() => {
    if (!data) return [];
    const recs = [...data.recommendations];
    if (sortMode === "similarity") {
      recs.sort((a, b) => a.similarity_rank - b.similarity_rank);
    } else {
      recs.sort((a, b) => b.view_count - a.view_count);
    }
    return recs;
  }, [data, sortMode]);

  async function fetchRecommendations(inputUrl: string) {
    setLoading(true);
    setError(null);
    setPlayingId(null);

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.detail ?? `エラーが発生しました (${res.status})`);
      } else {
        setData(body as RecommendResponse);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ネットワークエラー");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setHistory([]);
    fetchRecommendations(trimmed);
  }

  function exploreFromTrack(track: Track) {
    if (data) setHistory((h) => [...h, data.seed.youtube_url]);
    setUrl(track.youtube_url);
    fetchRecommendations(track.youtube_url);
  }

  function goBack() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setUrl(prev);
    fetchRecommendations(prev);
  }

  function togglePlay(videoId: string) {
    setPlayingId((id) => (id === videoId ? null : videoId));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-black">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            🎵 Music Recommendation
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            YouTube / YouTube Music のリンクを入れると、似てるおすすめ曲を10個返します
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "取得中..." : "おすすめを見る"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 text-sm">
            {error}
          </div>
        )}

        {data && (
          <>
            {history.length > 0 && (
              <button
                type="button"
                onClick={goBack}
                disabled={loading}
                className="mb-3 inline-flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
              >
                ← 前の曲に戻る ({history.length})
              </button>
            )}

            <section className="mb-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="p-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500 mb-3">元の曲</div>
                <TrackRow
                  track={data.seed}
                  isPlaying={playingId === data.seed.video_id}
                  onTogglePlay={() => togglePlay(data.seed.video_id)}
                />
              </div>
              {playingId === data.seed.video_id && (
                <YouTubeEmbed videoId={data.seed.video_id} />
              )}
            </section>

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                おすすめ {sortedRecs.length} 曲
              </h2>
              <div className="inline-flex rounded-lg border border-zinc-300 dark:border-zinc-700 p-0.5 bg-white dark:bg-zinc-900">
                <FilterButton active={sortMode === "similarity"} onClick={() => setSortMode("similarity")}>
                  類似度順
                </FilterButton>
                <FilterButton active={sortMode === "popularity"} onClick={() => setSortMode("popularity")}>
                  人気度順
                </FilterButton>
              </div>
            </div>

            <ul className="space-y-2">
              {sortedRecs.map((t, i) => (
                <li
                  key={t.video_id}
                  className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition overflow-hidden"
                >
                  <div className="p-3 flex items-center gap-3">
                    <div className="w-7 text-center text-sm font-semibold text-zinc-400 shrink-0">
                      {i + 1}
                    </div>
                    <TrackRow
                      track={t}
                      showMeta
                      sortMode={sortMode}
                      isPlaying={playingId === t.video_id}
                      onTogglePlay={() => togglePlay(t.video_id)}
                    />
                    <button
                      type="button"
                      onClick={() => exploreFromTrack(t)}
                      disabled={loading}
                      title="この曲から更に掘る"
                      className="shrink-0 px-2 sm:px-3 py-2 rounded-lg text-sm bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 disabled:opacity-50 transition"
                    >
                      🔍<span className="hidden sm:inline ml-1">掘る</span>
                    </button>
                  </div>
                  {playingId === t.video_id && <YouTubeEmbed videoId={t.video_id} />}
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
      <iframe
        className="absolute inset-0 w-full h-full"
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

function TrackRow({
  track,
  showMeta = false,
  sortMode,
  isPlaying,
  onTogglePlay,
}: {
  track: Track;
  showMeta?: boolean;
  sortMode?: SortMode;
  isPlaying: boolean;
  onTogglePlay: () => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <button
        type="button"
        onClick={onTogglePlay}
        className="relative shrink-0 w-16 h-16 rounded-md overflow-hidden bg-zinc-200 dark:bg-zinc-800 group/thumb"
        title={isPlaying ? "閉じる" : "プレビュー再生"}
      >
        {track.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition">
          <span className="text-white text-xl">{isPlaying ? "■" : "▶"}</span>
        </div>
        {isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-white text-xl">■</span>
          </div>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <a
          href={track.youtube_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block font-medium text-zinc-900 dark:text-zinc-50 truncate hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          {track.title}
        </a>
        <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
          {track.artists.join(", ")}
          {track.album ? ` · ${track.album}` : ""}
        </div>
        {showMeta && (
          <div className="mt-1 flex gap-3 text-xs text-zinc-500">
            {track.length && <span>{track.length}</span>}
            <span className={sortMode === "popularity" ? "font-semibold text-indigo-600 dark:text-indigo-400" : ""}>
              👁 {formatViews(track.view_count)}
            </span>
            <span className={sortMode === "similarity" ? "font-semibold text-indigo-600 dark:text-indigo-400" : ""}>
              類似度 #{track.similarity_rank}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
        active
          ? "bg-indigo-600 text-white"
          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}
