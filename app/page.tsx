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

const staggerClass = (i: number) => `stagger-${Math.min(i + 1, 10)}`;

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
    setData(null);
    fetchRecommendations(trimmed);
  }

  function exploreFromTrack(track: Track) {
    if (data) setHistory((h) => [...h, data.seed.youtube_url]);
    setUrl(track.youtube_url);
    setData(null);
    fetchRecommendations(track.youtube_url);
  }

  function goBack() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setUrl(prev);
    setData(null);
    fetchRecommendations(prev);
  }

  function togglePlay(videoId: string) {
    setPlayingId((id) => (id === videoId ? null : videoId));
  }

  const pageBg = {
    background: `
      radial-gradient(ellipse at 20% 50%, rgba(124,58,237,0.10) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 20%, rgba(79,70,229,0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 60% 85%, rgba(192,132,252,0.06) 0%, transparent 50%),
      #06060f
    `,
  };

  return (
    <div className="min-h-screen text-white" style={pageBg}>
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-white/5 backdrop-blur-xl" style={{ backgroundColor: 'rgba(6,6,15,0.7)' }}>
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
          <span className="text-2xl">🎵</span>
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">Music Recommendation</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {/* hero */}
        <div className="mb-10 text-center animate-fade-up">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
            <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-indigo-400 bg-clip-text text-transparent">Discover Music</span>
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base">
            YouTubeリンクを入力すると、似てる曲を10曲見つけます
          </p>
        </div>

        {/* search form */}
        <form onSubmit={handleSubmit} className="mb-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="曲名・アーティスト名 または YouTubeリンク"
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition-all duration-300 backdrop-blur-md"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3.5 rounded-xl text-white font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-violet-500/30 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <LoadingDots /> 取得中
                </span>
              ) : (
                "おすすめを見る"
              )}
            </button>
          </div>
        </form>

        {/* error */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm animate-fade-in">
            {error}
          </div>
        )}

        {/* loading skeleton */}
        {loading && (
          <div className="space-y-3 animate-fade-in">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl skeleton" />
            ))}
          </div>
        )}

        {/* results */}
        {!loading && data && (
          <>
            {/* back button */}
            {history.length > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="mb-4 inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors animate-fade-in"
              >
                <span className="text-lg">←</span>
                前の曲に戻る
                <span className="px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-xs">
                  {history.length}
                </span>
              </button>
            )}

            {/* seed card */}
            <div className="mb-6 animate-fade-up">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 ml-1">Now Playing</p>
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(139,92,246,0.15)]">
                <div className="p-4">
                  <TrackRow
                    track={data.seed}
                    isPlaying={playingId === data.seed.video_id}
                    onTogglePlay={() => togglePlay(data.seed.video_id)}
                    large
                  />
                </div>
                {playingId === data.seed.video_id && <YouTubeEmbed videoId={data.seed.video_id} />}
              </div>
            </div>

            {/* sort toggle + count */}
            <div className="flex items-center justify-between mb-4 animate-fade-in">
              <p className="text-sm text-zinc-400">
                <span className="text-white font-semibold">{sortedRecs.length}</span> 曲のおすすめ
              </p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex gap-1">
                <SortButton active={sortMode === "similarity"} onClick={() => setSortMode("similarity")}>
                  類似度順
                </SortButton>
                <SortButton active={sortMode === "popularity"} onClick={() => setSortMode("popularity")}>
                  人気度順
                </SortButton>
              </div>
            </div>

            {/* rec list */}
            <ul className="space-y-2">
              {sortedRecs.map((t, i) => (
                <li
                  key={t.video_id}
                  className={`bg-white/[0.04] border border-white/[0.07] hover:border-violet-500/40 hover:bg-white/[0.07] hover:shadow-[0_0_20px_rgba(139,92,246,0.1)] rounded-2xl overflow-hidden transition-all duration-300 animate-fade-up ${staggerClass(i)}`}
                >
                  <div className="p-3 flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-bold text-zinc-600 shrink-0">
                      {i + 1}
                    </span>
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
                      title="この曲から更に掘る"
                      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 hover:text-violet-300 transition-all duration-200 text-sm"
                    >
                      🔍
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

function LoadingDots() {
  return (
    <span className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="relative w-full border-t border-white/5" style={{ paddingBottom: "56.25%" }}>
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
  large = false,
}: {
  track: Track;
  showMeta?: boolean;
  sortMode?: SortMode;
  isPlaying: boolean;
  onTogglePlay: () => void;
  large?: boolean;
}) {
  const thumbSize = large ? "w-20 h-20" : "w-14 h-14";

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      {/* thumbnail / play toggle */}
      <button
        type="button"
        onClick={onTogglePlay}
        className={`relative shrink-0 ${thumbSize} rounded-xl overflow-hidden bg-white/5 group/thumb`}
        title={isPlaying ? "閉じる" : "プレビュー再生"}
      >
        {track.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-200">
          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <span className="text-white text-sm">{isPlaying ? "■" : "▶"}</span>
          </div>
        </div>
        {isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-violet-900/60">
            <div className="w-8 h-8 rounded-full bg-violet-500/40 flex items-center justify-center">
              <span className="text-white text-sm">■</span>
            </div>
          </div>
        )}
      </button>

      {/* info */}
      <div className="flex-1 min-w-0">
        <a
          href={track.youtube_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`block font-semibold truncate hover:text-violet-300 transition-colors ${large ? "text-base" : "text-sm"}`}
        >
          {track.title}
        </a>
        <p className="text-xs text-zinc-400 truncate mt-0.5">
          {track.artists.join(", ")}
          {track.album ? ` · ${track.album}` : ""}
        </p>
        {showMeta && (
          <div className="flex gap-3 mt-1 text-xs text-zinc-600">
            {track.length && <span>{track.length}</span>}
            <span className={sortMode === "popularity" ? "text-violet-400 font-semibold" : ""}>
              {formatViews(track.view_count)} views
            </span>
            <span className={sortMode === "similarity" ? "text-violet-400 font-semibold" : ""}>
              #{track.similarity_rank}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function SortButton({
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
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
        active
          ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30"
          : "text-zinc-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
