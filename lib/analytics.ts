import { Redis } from "@upstash/redis";

function getClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function isoWeek(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function nowJST(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

export async function trackSearch(opts?: {
  videoId?: string;
  title?: string;
  uid?: string;
}): Promise<void> {
  const redis = getClient();
  if (!redis) return;

  const now = nowJST();
  const day = now.toISOString().slice(0, 10);
  const week = isoWeek(now);
  const month = now.toISOString().slice(0, 7);
  const hour = String(now.getUTCHours()).padStart(2, "0");

  try {
    const pipe = redis.pipeline();
    pipe.incr(`recs:day:${day}`);
    pipe.incr(`recs:week:${week}`);
    pipe.incr(`recs:month:${month}`);
    pipe.incr("recs:total");
    pipe.incr(`recs:hour:${hour}`);
    pipe.expire(`recs:day:${day}`, 60 * 60 * 24 * 400);
    pipe.expire(`recs:week:${week}`, 60 * 60 * 24 * 700);
    pipe.expire(`recs:month:${month}`, 60 * 60 * 24 * 1800);

    if (opts?.uid) {
      pipe.pfadd(`recs:uniq:day:${day}`, opts.uid);
      pipe.pfadd(`recs:uniq:week:${week}`, opts.uid);
      pipe.pfadd(`recs:uniq:month:${month}`, opts.uid);
      pipe.pfadd("recs:uniq:total", opts.uid);
      pipe.expire(`recs:uniq:day:${day}`, 60 * 60 * 24 * 400);
      pipe.expire(`recs:uniq:week:${week}`, 60 * 60 * 24 * 700);
      pipe.expire(`recs:uniq:month:${month}`, 60 * 60 * 24 * 1800);
    }

    if (opts?.videoId) {
      pipe.zincrby("recs:songs:ranking", 1, opts.videoId);
      if (opts.title) {
        pipe.hset("recs:songs:titles", { [opts.videoId]: opts.title });
      }
    }

    await pipe.exec();

    // Store recent search separately (needs sequential ops)
    if (opts?.videoId) {
      const entry = JSON.stringify({
        videoId: opts.videoId,
        title: opts.title ?? opts.videoId,
        ts: Date.now(),
      });
      await redis.lpush("recs:recent", entry);
      await redis.ltrim("recs:recent", 0, 49);
    }
  } catch {
    // Never block the main request
  }
}

export type DayStat = { label: string; count: number };
export type SongStat = { videoId: string; title: string; count: number };
export type RecentEntry = { videoId: string; title: string; ts: number };

export type AnalyticsStats = {
  total: number;
  today: number;
  yesterday: number;
  thisWeek: number;
  lastWeek: number;
  thisMonth: number;
  lastMonth: number;
  uniqToday: number;
  uniqThisWeek: number;
  uniqThisMonth: number;
  uniqTotal: number;
  last30Days: DayStat[];
  last12Weeks: DayStat[];
  last12Months: DayStat[];
  hourly: DayStat[];
  topSongs: SongStat[];
  recent: RecentEntry[];
};

export async function getStats(): Promise<AnalyticsStats | null> {
  const redis = getClient();
  if (!redis) return null;

  const now = nowJST();
  const todayKey = now.toISOString().slice(0, 10);
  const thisWeekKey = isoWeek(now);
  const thisMonthKey = now.toISOString().slice(0, 7);

  const dayKeys = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().slice(0, 10);
  });
  const weekKeys = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    return isoWeek(d);
  });
  const monthKeys = Array.from({ length: 13 }, (_, i) => {
    const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
    return d.toISOString().slice(0, 7);
  });
  const hourKeys = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, "0")
  );

  try {
    // Pipeline for counters (day/week/month/hour/total/recent/uniq)
    const pipe = redis.pipeline();
    dayKeys.forEach((k) => pipe.get(`recs:day:${k}`));
    weekKeys.forEach((k) => pipe.get(`recs:week:${k}`));
    monthKeys.forEach((k) => pipe.get(`recs:month:${k}`));
    hourKeys.forEach((k) => pipe.get(`recs:hour:${k}`));
    pipe.get("recs:total");
    pipe.lrange("recs:recent", 0, 19);
    pipe.pfcount(`recs:uniq:day:${todayKey}`);
    pipe.pfcount(`recs:uniq:week:${thisWeekKey}`);
    pipe.pfcount(`recs:uniq:month:${thisMonthKey}`);
    pipe.pfcount("recs:uniq:total");

    const results = await pipe.exec();

    // Parse pipeline results in order
    let idx = 0;
    const dayVals = dayKeys.map(() => (results[idx++] as number | null) ?? 0);
    const weekVals = weekKeys.map(() => (results[idx++] as number | null) ?? 0);
    const monthVals = monthKeys.map(() => (results[idx++] as number | null) ?? 0);
    const hourVals = hourKeys.map(() => (results[idx++] as number | null) ?? 0);
    const total = (results[idx++] as number | null) ?? 0;
    const recentRaw = (results[idx++] as string[]) ?? [];
    const uniqToday = (results[idx++] as number | null) ?? 0;
    const uniqThisWeek = (results[idx++] as number | null) ?? 0;
    const uniqThisMonth = (results[idx++] as number | null) ?? 0;
    const uniqTotal = (results[idx++] as number | null) ?? 0;

    // Top songs — fetched separately to avoid zrange+withScores pipeline quirks
    let topSongs: SongStat[] = [];
    try {
      const rawIds = await redis.zrange("recs:songs:ranking", 0, 9, { rev: true });
      if (Array.isArray(rawIds) && rawIds.length > 0) {
        const ids = rawIds as string[];
        const scorePipe = redis.pipeline();
        ids.forEach((id) => scorePipe.zscore("recs:songs:ranking", id));
        const scoreResults = await scorePipe.exec();
        const allTitles = await redis.hgetall("recs:songs:titles") as Record<string, string> | null;
        topSongs = ids.map((id, i) => ({
          videoId: id,
          title: allTitles?.[id] ?? id,
          count: Number(scoreResults[i] ?? 0),
        }));
      }
    } catch {
      // topSongs stays empty — not critical
    }

    // Parse recent — Upstash REST auto-parses JSON, so items may already be objects
    const recent: RecentEntry[] = recentRaw.map((s) => {
      if (typeof s === "object" && s !== null) return s as unknown as RecentEntry;
      try { return JSON.parse(s) as RecentEntry; }
      catch { return { videoId: "", title: String(s), ts: 0 }; }
    });

    return {
      total,
      today: dayVals[0],
      yesterday: dayVals[1],
      thisWeek: weekVals[0],
      lastWeek: weekVals[1],
      thisMonth: monthVals[0],
      lastMonth: monthVals[1],
      uniqToday,
      uniqThisWeek,
      uniqThisMonth,
      uniqTotal,
      last30Days: dayKeys.map((k, i) => ({ label: k, count: dayVals[i] })),
      last12Weeks: weekKeys.slice(0, 12).map((k, i) => ({ label: k, count: weekVals[i] })),
      last12Months: monthKeys.slice(0, 12).map((k, i) => ({ label: k, count: monthVals[i] })),
      hourly: hourKeys.map((k, i) => ({ label: `${k}時`, count: hourVals[i] })),
      topSongs,
      recent,
    };
  } catch {
    return null;
  }
}
