import { getStats, type AnalyticsStats } from "@/lib/analytics";

type Props = { searchParams: Promise<{ key?: string }> };

/* ── helpers ── */
function growth(current: number, prev: number): string {
  if (prev === 0) return current > 0 ? "+100%" : "—";
  const pct = Math.round(((current - prev) / prev) * 100);
  return (pct >= 0 ? "+" : "") + pct + "%";
}
function growthColor(current: number, prev: number): string {
  if (prev === 0) return "text-zinc-500";
  return current >= prev ? "text-emerald-400" : "text-red-400";
}
function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

/* ── sub-components ── */
function SummaryCard({
  label, value, sub, subColor,
}: {
  label: string; value: number; sub: string; subColor: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
        {value.toLocaleString()}
      </p>
      <p className={`text-xs mt-1 font-semibold ${subColor}`}>{sub}</p>
    </div>
  );
}

function Bar({ count, max, highlight }: { count: number; max: number; highlight?: boolean }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full ${highlight ? "bg-gradient-to-r from-violet-500 to-pink-500" : "bg-gradient-to-r from-violet-600 to-indigo-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-white w-8 text-right tabular-nums">{count}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-zinc-300 mb-4">{title}</h2>
      {children}
    </div>
  );
}

/* ── main ── */
export default async function AdminPage({ searchParams }: Props) {
  const { key } = await searchParams;
  const secret = process.env.ADMIN_SECRET;

  if (!secret || !key || key !== secret) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#06060f" }}>
        <div className="text-center space-y-2">
          <p className="text-4xl">🔒</p>
          <p className="text-zinc-500 text-sm">アクセス拒否</p>
        </div>
      </div>
    );
  }

  const stats: AnalyticsStats | null = await getStats();

  const pageBg = {
    background: "radial-gradient(ellipse at 20% 20%, rgba(124,58,237,0.07) 0%, transparent 60%), #06060f",
  };

  return (
    <div className="min-h-screen text-white" style={pageBg}>
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">

        {/* Header */}
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">管理者専用</p>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Analytics Dashboard
          </h1>
        </div>

        {!stats ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-300 text-sm">
            Redis が未設定です。Upstash の環境変数を設定してください。
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard
                label="今日"
                value={stats.today}
                sub={`前日比 ${growth(stats.today, stats.yesterday)}`}
                subColor={growthColor(stats.today, stats.yesterday)}
              />
              <SummaryCard
                label="今週"
                value={stats.thisWeek}
                sub={`前週比 ${growth(stats.thisWeek, stats.lastWeek)}`}
                subColor={growthColor(stats.thisWeek, stats.lastWeek)}
              />
              <SummaryCard
                label="今月"
                value={stats.thisMonth}
                sub={`前月比 ${growth(stats.thisMonth, stats.lastMonth)}`}
                subColor={growthColor(stats.thisMonth, stats.lastMonth)}
              />
              <SummaryCard
                label="累計"
                value={stats.total}
                sub="全期間"
                subColor="text-zinc-500"
              />
            </div>

            {/* Top songs + Recent — side by side on wide screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Top songs */}
              <Section title="🏆 人気曲トップ10">
                {stats.topSongs.length === 0 ? (
                  <p className="text-xs text-zinc-600">データがまだありません</p>
                ) : (
                  <div className="space-y-2">
                    {stats.topSongs.map((s, i) => {
                      const max = stats.topSongs[0]?.count ?? 1;
                      return (
                        <div key={s.videoId} className="grid grid-cols-[18px_1fr] gap-2 items-center">
                          <span className="text-[10px] text-zinc-600 font-bold text-center">{i + 1}</span>
                          <div>
                            <div className="text-xs text-zinc-300 truncate mb-0.5">{s.title}</div>
                            <Bar count={s.count} max={max} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* Recent searches */}
              <Section title="🕐 最近の検索">
                {stats.recent.length === 0 ? (
                  <p className="text-xs text-zinc-600">データがまだありません</p>
                ) : (
                  <div className="space-y-2">
                    {stats.recent.map((r, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <p className="text-xs text-zinc-300 truncate flex-1">{r.title}</p>
                        <span className="text-[10px] text-zinc-600 shrink-0">{timeAgo(r.ts)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>

            {/* Hourly heatmap */}
            <Section title="⏰ 時間帯分析（JST）">
              <div className="grid grid-cols-12 gap-1">
                {stats.hourly.map(({ label, count }) => {
                  const max = Math.max(...stats.hourly.map((h) => h.count), 1);
                  const intensity = max > 0 ? count / max : 0;
                  const bg = intensity === 0
                    ? "bg-white/5"
                    : intensity < 0.33
                    ? "bg-violet-900/60"
                    : intensity < 0.66
                    ? "bg-violet-600/70"
                    : "bg-violet-400/90";
                  return (
                    <div key={label} className="flex flex-col items-center gap-1" title={`${label}: ${count}回`}>
                      <div className={`w-full h-8 rounded ${bg} flex items-center justify-center`}>
                        <span className="text-[9px] text-white/60 font-semibold">{count || ""}</span>
                      </div>
                      <span className="text-[8px] text-zinc-600">{label.replace("時", "")}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-3 justify-end">
                <span className="text-[9px] text-zinc-600">少ない</span>
                {["bg-white/5", "bg-violet-900/60", "bg-violet-600/70", "bg-violet-400/90"].map((c, i) => (
                  <div key={i} className={`w-3 h-3 rounded ${c}`} />
                ))}
                <span className="text-[9px] text-zinc-600">多い</span>
              </div>
            </Section>

            {/* Daily chart */}
            <Section title="📅 直近30日（日別）">
              <div className="space-y-1">
                {stats.last30Days.map(({ label, count }) => {
                  const max = Math.max(...stats.last30Days.map((d) => d.count), 1);
                  const isToday = label === stats.last30Days[0].label;
                  return (
                    <div key={label} className="grid grid-cols-[96px_1fr] gap-3 items-center">
                      <span className={`text-xs tabular-nums ${isToday ? "text-violet-400 font-semibold" : "text-zinc-500"}`}>
                        {label}
                      </span>
                      <Bar count={count} max={max} highlight={isToday} />
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* Weekly chart */}
            <Section title="📆 直近12週（週別）">
              <div className="space-y-1">
                {stats.last12Weeks.map(({ label, count }) => {
                  const max = Math.max(...stats.last12Weeks.map((d) => d.count), 1);
                  const isThis = label === stats.last12Weeks[0].label;
                  return (
                    <div key={label} className="grid grid-cols-[96px_1fr] gap-3 items-center">
                      <span className={`text-xs tabular-nums ${isThis ? "text-violet-400 font-semibold" : "text-zinc-500"}`}>
                        {label}
                      </span>
                      <Bar count={count} max={max} highlight={isThis} />
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* Monthly chart */}
            <Section title="🗓 直近12ヶ月（月別）">
              <div className="space-y-1">
                {stats.last12Months.map(({ label, count }) => {
                  const max = Math.max(...stats.last12Months.map((d) => d.count), 1);
                  const isThis = label === stats.last12Months[0].label;
                  return (
                    <div key={label} className="grid grid-cols-[96px_1fr] gap-3 items-center">
                      <span className={`text-xs tabular-nums ${isThis ? "text-violet-400 font-semibold" : "text-zinc-500"}`}>
                        {label}
                      </span>
                      <Bar count={count} max={max} highlight={isThis} />
                    </div>
                  );
                })}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
