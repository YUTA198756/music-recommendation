"use client";

import { useMemo, useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

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

type HistoryEntry = {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string | null;
  timestamp: number;
};

const HISTORY_KEY = "music-rec-history";
const MAX_HISTORY = 20;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToHistory(seed: Track) {
  try {
    const existing = loadHistory().filter((h) => h.videoId !== seed.video_id);
    const entry: HistoryEntry = {
      videoId: seed.video_id,
      title: seed.title,
      artist: seed.artists[0] ?? "",
      thumbnail: seed.thumbnail,
      timestamp: Date.now(),
    };
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([entry, ...existing].slice(0, MAX_HISTORY))
    );
  } catch {}
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "今";
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  return `${Math.floor(hr / 24)}日前`;
}

function formatViews(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

const staggerClass = (i: number) => `stagger-${Math.min(i + 1, 10)}`;

function HomeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecommendResponse | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("similarity");
  const [history, setHistory] = useState<string[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [recentHistory, setRecentHistory] = useState<HistoryEntry[]>([]);
  const [copied, setCopied] = useState(false);

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

  const fetchRecommendations = useCallback(async (inputUrl: string) => {
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
  }, []);

  // Auto-fetch from ?seed= query param on mount
  useEffect(() => {
    const seed = searchParams.get("seed");
    if (seed) {
      setUrl(seed);
      fetchRecommendations(seed);
    }
    setRecentHistory(loadHistory());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to localStorage when results arrive
  useEffect(() => {
    if (data?.seed) {
      saveToHistory(data.seed);
      setRecentHistory(loadHistory());
    }
  }, [data]);

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

  function handleHome() {
    setData(null);
    setHistory([]);
    setUrl("");
    setError(null);
    setPlayingId(null);
    router.push("/");
  }

  async function handleShare() {
    if (!data) return;
    const shareUrl = `${window.location.origin}/share/${data.seed.video_id}`;
    const shareText = `「${data.seed.title}」に似た曲を10曲発見！🎵`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: shareText, url: shareUrl });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
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
      <header
        className="sticky top-0 z-20 border-b border-white/5 backdrop-blur-xl"
        style={{ backgroundColor: "rgba(6,6,15,0.7)" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleHome}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <span className="text-2xl">🎵</span>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Music Recommendation
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {/* hero */}
        <div className="mb-10 text-center animate-fade-up">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
            <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-indigo-400 bg-clip-text text-transparent">
              Discover Music
            </span>
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base">
            YouTubeリンクを入力すると、似てる曲を10曲見つけます
          </p>
        </div>

        {/* search form */}
        <form
          onSubmit={handleSubmit}
          className="mb-8 animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
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

        {/* recent history (shown on home screen) */}
        {!loading && !data && recentHistory.length > 0 && (
          <div className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3 ml-1">
              最近の検索
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {recentHistory.map((entry) => (
                <button
                  key={`${entry.videoId}-${entry.timestamp}`}
                  type="button"
                  onClick={() => {
                    setUrl(entry.videoId);
                    setData(null);
                    fetchRecommendations(entry.videoId);
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-violet-500/40 hover:bg-white/[0.07] transition-all duration-200 text-left"
                >
                  {entry.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.thumbnail}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white/5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-white">
                      {entry.title}
                    </p>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">
                      {entry.artist}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-600 shrink-0">
                    {timeAgo(entry.timestamp)}
                  </span>
                </button>
              ))}
            </div>
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
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 ml-1">
                Now Playing
              </p>
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(139,92,246,0.15)]">
                <div className="p-4">
                  <TrackRow
                    track={data.seed}
                    isPlaying={playingId === data.seed.video_id}
                    onTogglePlay={() => togglePlay(data.seed.video_id)}
                    showStreaming
                    large
                  />
                </div>
                {playingId === data.seed.video_id && (
                  <YouTubeEmbed videoId={data.seed.video_id} />
                )}
              </div>
            </div>

            {/* sort toggle + count + share */}
            <div className="flex items-center justify-between mb-4 animate-fade-in">
              <p className="text-sm text-zinc-400">
                <span className="text-white font-semibold">
                  {sortedRecs.length}
                </span>{" "}
                曲のおすすめ
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 hover:text-violet-300 transition-all duration-200"
                >
                  {copied ? (
                    <>✓ コピーしました</>
                  ) : (
                    <>
                      <span>↗</span> シェア
                    </>
                  )}
                </button>
                <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex gap-1">
                  <SortButton
                    active={sortMode === "similarity"}
                    onClick={() => setSortMode("similarity")}
                  >
                    類似度順
                  </SortButton>
                  <SortButton
                    active={sortMode === "popularity"}
                    onClick={() => setSortMode("popularity")}
                  >
                    人気度順
                  </SortButton>
                </div>
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
                      showStreaming
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
                  {playingId === t.video_id && (
                    <YouTubeEmbed videoId={t.video_id} />
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
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
    <div
      className="relative w-full border-t border-white/5"
      style={{ paddingBottom: "56.25%" }}
    >
      <iframe
        className="absolute inset-0 w-full h-full"
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

function StreamingLinks({ title, artist }: { title: string; artist: string }) {
  const q = encodeURIComponent(`${title} ${artist}`);
  return (
    <div className="flex gap-2 mt-1.5">
      <a
        href={`https://open.spotify.com/search/${q}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-green-400 transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
        Spotify
      </a>
      <a
        href={`https://music.apple.com/search?term=${q}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-pink-400 transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.064-2.31-2.19-3.04a5.022 5.022 0 00-1.535-.66c-.69-.15-1.39-.2-2.09-.2H6.06c-.7 0-1.4.05-2.09.2-.66.14-1.28.39-1.83.77C1.1 1.73.47 2.54.17 3.5c-.2.63-.17 1.29-.17 1.95v13.1c0 .66-.03 1.32.17 1.95.3.96.93 1.77 1.97 2.46.55.38 1.17.63 1.83.77.69.15 1.39.2 2.09.2H17.94c.7 0 1.4-.05 2.09-.2a5.022 5.022 0 001.535-.66c1.126-.73 1.873-1.73 2.19-3.04.15-.69.24-1.39.24-2.09V8.214c0-.7-.09-1.4-.015-2.09zM16.404 8.37v7.09c0 1.72-1.39 3.11-3.11 3.11s-3.11-1.39-3.11-3.11 1.39-3.11 3.11-3.11c.69 0 1.32.23 1.83.6V7.2l-6.22 1.5v8.76c0 1.72-1.39 3.11-3.11 3.11S2.68 19.18 2.68 17.46s1.39-3.11 3.11-3.11c.69 0 1.32.23 1.83.6V5.76l8.784-2.12z"/>
        </svg>
        Apple Music
      </a>
      <a
        href={`https://music.amazon.co.jp/search/${q}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-sky-400 transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.699-3.182v.685zm3.186 7.705c-.209.189-.512.201-.745.074-1.052-.872-1.238-1.276-1.814-2.106-1.733 1.767-2.96 2.297-5.207 2.297-2.657 0-4.726-1.641-4.726-4.927 0-2.565 1.391-4.309 3.37-5.164 1.715-.754 4.11-.891 5.942-1.095V6.41c0-.7.053-1.528-.356-2.133-.358-.545-1.042-.77-1.646-.77-1.117 0-2.116.577-2.359 1.77-.05.264-.245.523-.513.537l-2.872-.309c-.242-.054-.51-.249-.441-.618C7.028 2.724 9.56 2 11.842 2c1.166 0 2.689.31 3.609 1.192C16.561 4.297 16.45 5.8 16.45 7.43v4.211c0 1.265.524 1.822 1.017 2.504.173.246.211.54-.008.719l-2.315 1.931zm3.603 1.542c-2.547 1.88-6.242 2.88-9.428 2.88-4.46 0-8.475-1.651-11.514-4.397-.239-.216-.026-.51.261-.342 3.278 1.906 7.328 3.054 11.515 3.054 2.823 0 5.929-.585 8.786-1.798.431-.183.791.283.38.603zm1.088-1.239c-.326-.418-2.155-.198-2.977-.1-.25.031-.288-.188-.063-.346 1.459-1.027 3.853-.731 4.133-.386.28.346-.074 2.742-1.441 3.887-.211.176-.41.082-.317-.148.308-.77.997-2.494.665-2.907z"/>
        </svg>
        Amazon Music
      </a>
    </div>
  );
}

function TrackRow({
  track,
  showMeta = false,
  showStreaming = false,
  sortMode,
  isPlaying,
  onTogglePlay,
  large = false,
}: {
  track: Track;
  showMeta?: boolean;
  showStreaming?: boolean;
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
          <img
            src={track.thumbnail}
            alt=""
            className="w-full h-full object-cover"
          />
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
            <span
              className={
                sortMode === "popularity" ? "text-violet-400 font-semibold" : ""
              }
            >
              {formatViews(track.view_count)} views
            </span>
            <span
              className={
                sortMode === "similarity" ? "text-violet-400 font-semibold" : ""
              }
            >
              #{track.similarity_rank}
            </span>
          </div>
        )}
        {showStreaming && (
          <StreamingLinks
            title={track.title}
            artist={track.artists[0] ?? ""}
          />
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
