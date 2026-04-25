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

// JST = UTC+9
function nowJST(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

export async function trackSearch(opts?: {
  videoId?: string;
  title?: string;
}): Promise<void> {
  const redis = getClient();
  if (!redis) return;

  const now = nowJST();
  const day = now.toISOString().slice(0, 10);
  const week = isoWeek(now);
  const month = now.toISOString().slice(0, 7);
  const hour = String(now.getUTCHours()).padStart(2, "0");

  try {
    const cmds: Promise<unknown>[] = [
      redis.incr(`recs:day:${day}`),
      redis.incr(`recs:week:${week}`),
      redis.incr(`recs:month:${month}`),
      redis.incr(`recs:total`),
      redis.incr(`recs:hour:${hour}`),
      redis.expire(`recs:day:${day}`, 60 * 60 * 24 * 400),
      redis.expire(`recs:week:${week}`, 60 * 60 * 24 * 700),
      redis.expire(`recs:month:${month}`, 60 * 60 * 24 * 1800),
    ];

    if (opts?.videoId) {
      // Song ranking via sorted set
      cmds.push(redis.zincrby("recs:songs:ranking", 1, opts.videoId));
      // Title lookup map
      if (opts.title) {
        cmds.push(redis.hset("recs:songs:titles", { [opts.videoId]: opts.title }));
      }
      // Recent searches list (keep last 50)
      const entry = JSON.stringify({
        videoId: opts.videoId,
        title: opts.title ?? opts.videoId,
        ts: Date.now(),
      });
      cmds.push(
        redis.lpush("recs:recent", entry).then(() =>
          redis.ltrim("recs:recent", 0, 49)
        )
      );
    }

    await Promise.all(cmds);
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
  last30Days: DayStat[];
  last12Weeks: DayStat[];
  last12Months: DayStat[];
  hourly: DayStat[];        // index 0-23
  topSongs: SongStat[];
  recent: RecentEntry[];
};

export async function getStats(): Promise<AnalyticsStats | null> {
  const redis = getClient();
  if (!redis) return null;

  const now = nowJST();

  // Day keys (30)
  const dayKeys = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().slice(0, 10);
  });

  // Week keys (14 — extra for last week comparison)
  const weekKeys = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    return isoWeek(d);
  });

  // Month keys (13 — extra for last month)
  const monthKeys = Array.from({ length: 13 }, (_, i) => {
    const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
    return d.toISOString().slice(0, 7);
  });

  const hourKeys = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, "0")
  );

  try {
    const [dayVals, weekVals, monthVals, hourVals, total, topSongRaw, recentRaw] =
      await Promise.all([
        redis.mget<(number | null)[]>(...dayKeys.map((k) => `recs:day:${k}`)),
        redis.mget<(number | null)[]>(...weekKeys.map((k) => `recs:week:${k}`)),
        redis.mget<(number | null)[]>(...monthKeys.map((k) => `recs:month:${k}`)),
        redis.mget<(number | null)[]>(...hourKeys.map((k) => `recs:hour:${k}`)),
        redis.get<number>("recs:total"),
        redis.zrange("recs:songs:ranking", 0, 9, { rev: true, withScores: true }),
        redis.lrange("recs:recent", 0, 19),
      ]);

    // Top songs — zrange withScores returns [member, score, member, score, ...]
    const topSongIds: string[] = [];
    const topSongScores: Record<string, number> = {};
    for (let i = 0; i < topSongRaw.length; i += 2) {
      const id = topSongRaw[i] as string;
      const score = Number(topSongRaw[i + 1]);
      topSongIds.push(id);
      topSongScores[id] = score;
    }
    let titleMap: Record<string, string> = {};
    if (topSongIds.length > 0) {
      const titles = (await redis.hmget(
        "recs:songs:titles",
        ...topSongIds
      ) as unknown) as (string | null)[];
      topSongIds.forEach((id, i) => {
        titleMap[id] = titles[i] ?? id;
      });
    }
    const topSongs: SongStat[] = topSongIds.map((id) => ({
      videoId: id,
      title: titleMap[id] ?? id,
      count: topSongScores[id] ?? 0,
    }));

    // Recent
    const recent: RecentEntry[] = (recentRaw as string[]).map((s) => {
      try { return JSON.parse(s) as RecentEntry; }
      catch { return { videoId: "", title: s, ts: 0 }; }
    });

    const last30Days = dayKeys.map((k, i) => ({ label: k, count: dayVals[i] ?? 0 }));
    const last12Weeks = weekKeys.slice(0, 12).map((k, i) => ({ label: k, count: weekVals[i] ?? 0 }));
    const last12Months = monthKeys.slice(0, 12).map((k, i) => ({ label: k, count: monthVals[i] ?? 0 }));
    const hourly = hourKeys.map((k, i) => ({ label: `${k}時`, count: hourVals[i] ?? 0 }));

    return {
      total: total ?? 0,
      today: last30Days[0].count,
      yesterday: last30Days[1].count,
      thisWeek: last12Weeks[0].count,
      lastWeek: weekVals[1] ?? 0,
      thisMonth: last12Months[0].count,
      lastMonth: monthVals[1] ?? 0,
      last30Days,
      last12Weeks,
      last12Months,
      hourly,
      topSongs,
      recent,
    };
  } catch {
    return null;
  }
}
