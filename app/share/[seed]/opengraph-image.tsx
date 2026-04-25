import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export default async function Image({
  params,
}: {
  params: Promise<{ seed: string }>;
}) {
  const { seed } = await params;

  let title = "Music Recommendation";
  let artist = "";
  let recTitles: string[] = [];
  const thumbnail = `https://i.ytimg.com/vi/${seed}/hqdefault.jpg`;

  try {
    const res = await fetch(`${BACKEND_URL}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: seed }),
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      title = data.seed?.title ?? title;
      artist = data.seed?.artists?.[0] ?? "";
      recTitles = (data.recommendations as { title: string }[])
        .slice(0, 5)
        .map((r) => r.title);
    }
  } catch {}

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#06060f",
          display: "flex",
          flexDirection: "column",
          padding: "60px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* Purple glow top-left */}
        <div
          style={{
            position: "absolute",
            top: -150,
            left: -150,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(124,58,237,0.35) 0%, transparent 70%)",
          }}
        />
        {/* Indigo glow bottom-right */}
        <div
          style={{
            position: "absolute",
            bottom: -100,
            right: -100,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(79,70,229,0.25) 0%, transparent 70%)",
          }}
        />

        {/* App badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 48,
          }}
        >
          <div style={{ fontSize: 26 }}>🎵</div>
          <div
            style={{
              color: "#a78bfa",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: -0.5,
            }}
          >
            Music Recommendation
          </div>
        </div>

        {/* Main row */}
        <div
          style={{
            display: "flex",
            gap: 48,
            alignItems: "flex-start",
            flex: 1,
          }}
        >
          {/* Thumbnail */}
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 20,
              overflow: "hidden",
              flexShrink: 0,
              border: "2px solid rgba(139,92,246,0.5)",
              boxShadow: "0 0 40px rgba(124,58,237,0.4)",
              display: "flex",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnail}
              width={220}
              height={220}
              alt=""
              style={{ objectFit: "cover" }}
            />
          </div>

          {/* Info */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                color: "#7c3aed",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              この曲に似た曲を発見！
            </div>
            <div
              style={{
                color: "white",
                fontSize: 44,
                fontWeight: 800,
                lineHeight: 1.1,
                marginBottom: 14,
              }}
            >
              {title.length > 36 ? title.slice(0, 36) + "…" : title}
            </div>
            {artist && (
              <div style={{ color: "#a78bfa", fontSize: 22 }}>{artist}</div>
            )}
          </div>
        </div>

        {/* Rec chips */}
        {recTitles.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {recTitles.map((r, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(139,92,246,0.2)",
                  border: "1px solid rgba(139,92,246,0.35)",
                  borderRadius: 8,
                  padding: "6px 14px",
                  color: "#c4b5fd",
                  fontSize: 14,
                }}
              >
                {r.length > 24 ? r.slice(0, 24) + "…" : r}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  );
}
