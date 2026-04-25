import { NextResponse } from "next/server";
import { trackSearch } from "@/lib/analytics";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 400 });
  }

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json({ detail: "url は必須です" }, { status: 400 });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: body.url }),
    });

    const data = await res.json().catch(() => ({ detail: "Backend returned invalid response" }));
    if (res.ok) {
      // fire-and-forget — pass seed track info + uid cookie for unique user count
      const uid = request.headers.get("cookie")
        ?.split(";")
        .find((c) => c.trim().startsWith("uid="))
        ?.split("=")[1]
        ?.trim();
      trackSearch({
        videoId: data.seed?.video_id,
        title: data.seed?.title,
        uid,
      });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { detail: `バックエンドに接続できませんでした: ${message}` },
      { status: 502 },
    );
  }
}
