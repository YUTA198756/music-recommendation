import os
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
from urllib.parse import parse_qs, urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ytmusicapi import YTMusic

app = FastAPI(title="Music Recommendation API")

_allowed = os.environ.get("ALLOWED_ORIGIN", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

yt = YTMusic()


class RecommendRequest(BaseModel):
    url: str


class Track(BaseModel):
    video_id: str
    title: str
    artists: list[str]
    album: Optional[str]
    thumbnail: Optional[str]
    length: Optional[str]
    youtube_url: str
    similarity_rank: int
    view_count: int


class RecommendResponse(BaseModel):
    seed: Track
    recommendations: list[Track]


def extract_video_id(url: str) -> Optional[str]:
    url = url.strip()
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", url):
        return url
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if host.endswith("youtu.be"):
        vid = parsed.path.lstrip("/").split("/")[0]
        return vid if re.fullmatch(r"[A-Za-z0-9_-]{11}", vid) else None
    if "youtube.com" in host or "youtube-nocookie.com" in host:
        qs = parse_qs(parsed.query)
        if "v" in qs and re.fullmatch(r"[A-Za-z0-9_-]{11}", qs["v"][0]):
            return qs["v"][0]
        m = re.search(r"/(?:embed|shorts|v|live)/([A-Za-z0-9_-]{11})", parsed.path)
        if m:
            return m.group(1)
    return None


def pick_thumbnail(thumbnails) -> Optional[str]:
    if not thumbnails:
        return None
    if isinstance(thumbnails, dict) and "thumbnails" in thumbnails:
        thumbnails = thumbnails["thumbnails"]
    if isinstance(thumbnails, list) and thumbnails:
        return thumbnails[-1].get("url")
    return None


def fetch_view_count(video_id: str) -> int:
    try:
        song = yt.get_song(video_id)
        vc = song.get("videoDetails", {}).get("viewCount")
        return int(vc) if vc else 0
    except Exception:
        return 0


def track_from_watch_item(item: dict, rank: int, view_count: int) -> Track:
    video_id = item.get("videoId") or ""
    artists = [a.get("name", "") for a in (item.get("artists") or []) if a.get("name")]
    album_obj = item.get("album")
    album = album_obj.get("name") if isinstance(album_obj, dict) else None
    return Track(
        video_id=video_id,
        title=item.get("title") or "",
        artists=artists,
        album=album,
        thumbnail=pick_thumbnail(item.get("thumbnail")),
        length=item.get("length"),
        youtube_url=f"https://www.youtube.com/watch?v={video_id}" if video_id else "",
        similarity_rank=rank,
        view_count=view_count,
    )


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest):
    video_id = extract_video_id(req.url)
    if not video_id:
        raise HTTPException(status_code=400, detail="有効なYouTube URLまたはvideo IDを入力してください")

    try:
        watch = yt.get_watch_playlist(videoId=video_id, limit=25)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"YouTube Musicからの取得に失敗しました: {e}")

    tracks = watch.get("tracks") or []
    if not tracks:
        raise HTTPException(status_code=404, detail="この曲に対する関連曲が見つかりませんでした")

    seed_item = tracks[0]
    rec_items = [t for t in tracks[1:] if t.get("videoId")][:10]

    if not rec_items:
        raise HTTPException(status_code=404, detail="関連曲が見つかりませんでした")

    seed_video_id = seed_item.get("videoId") or video_id
    all_ids = [seed_video_id] + [t["videoId"] for t in rec_items]
    with ThreadPoolExecutor(max_workers=8) as ex:
        view_counts = list(ex.map(fetch_view_count, all_ids))

    seed_track = track_from_watch_item(seed_item, rank=0, view_count=view_counts[0])
    recs = [
        track_from_watch_item(item, rank=i + 1, view_count=view_counts[i + 1])
        for i, item in enumerate(rec_items)
    ]

    return RecommendResponse(seed=seed_track, recommendations=recs)
