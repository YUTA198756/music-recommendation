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

export async function trackSearch(): Promise<void> {
  const redis = getClient();
  if (!redis) return;

  const now = new Date();
  const day = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const week = isoWeek(now); // YYYY-Www
  const month = now.toISOString().slice(0, 7); // YYYY-MM

  try {
    await Promise.all([
      redis.incr(`recs:day:${day}`),
      redis.incr(`recs:week:${week}`),
      redis.incr(`recs:month:${month}`),
      redis.incr("recs:total"),
      // Expire day keys after 400 days, week after 700 days, month after 1800 days
      redis.expire(`recs:day:${day}`, 60 * 60 * 24 * 400),
      redis.expire(`recs:week:${week}`, 60 * 60 * 24 * 700),
      redis.expire(`recs:month:${month}`, 60 * 60 * 24 * 1800),
    ]);
  } catch {
    // Never block the main request
  }
}

type DayStat = { label: string; count: number };

export async function getStats(): Promise<{
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  last30Days: DayStat[];
  last12Weeks: DayStat[];
  last12Months: DayStat[];
} | null> {
  const redis = getClient();
  if (!redis) return null;

  const now = new Date();

  // Build date keys
  const dayKeys: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  const weekKeys: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekKeys.push(isoWeek(d));
  }

  const monthKeys: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(d.toISOString().slice(0, 7));
  }

  try {
    const [dayVals, weekVals, monthVals, total] = await Promise.all([
      redis.mget<(number | null)[]>(...dayKeys.map((k) => `recs:day:${k}`)),
      redis.mget<(number | null)[]>(...weekKeys.map((k) => `recs:week:${k}`)),
      redis.mget<(number | null)[]>(
        ...monthKeys.map((k) => `recs:month:${k}`)
      ),
      redis.get<number>("recs:total"),
    ]);

    const last30Days = dayKeys.map((k, i) => ({
      label: k,
      count: dayVals[i] ?? 0,
    }));
    const last12Weeks = weekKeys.map((k, i) => ({
      label: k,
      count: weekVals[i] ?? 0,
    }));
    const last12Months = monthKeys.map((k, i) => ({
      label: k,
      count: monthVals[i] ?? 0,
    }));

    return {
      total: total ?? 0,
      today: last30Days[0].count,
      thisWeek: last12Weeks[0].count,
      thisMonth: last12Months[0].count,
      last30Days,
      last12Weeks,
      last12Months,
    };
  } catch {
    return null;
  }
}
