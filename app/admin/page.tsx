import { getStats } from "@/lib/analytics";

type Props = { searchParams: Promise<{ key?: string }> };

function Bar({ count, max }: { count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-white w-10 text-right">
        {count}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">
        {label}
      </p>
      <p className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export default async function AdminPage({ searchParams }: Props) {
  const { key } = await searchParams;
  const secret = process.env.ADMIN_SECRET;

  // Block if no secret configured or wrong key
  if (!secret || !key || key !== secret) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-white"
        style={{ background: "#06060f" }}
      >
        <div className="text-center space-y-3">
          <p className="text-4xl">🔒</p>
          <p className="text-zinc-400 text-sm">アクセス拒否</p>
        </div>
      </div>
    );
  }

  const stats = await getStats();

  const pageBg = {
    background: `
      radial-gradient(ellipse at 20% 30%, rgba(124,58,237,0.08) 0%, transparent 60%),
      #06060f
    `,
  };

  return (
    <div className="min-h-screen text-white" style={pageBg}>
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">
            管理者専用
          </p>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Analytics Dashboard
          </h1>
        </div>

        {!stats ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-300 text-sm">
            Redis が未設定です。Upstash の環境変数を設定してください。
          </div>
        ) : (
          <div className="space-y-8">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="今日" value={stats.today} />
              <StatCard label="今週" value={stats.thisWeek} />
              <StatCard label="今月" value={stats.thisMonth} />
              <StatCard label="累計" value={stats.total} />
            </div>

            {/* Last 30 days */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">
                直近30日（日別）
              </h2>
              <div className="space-y-1.5">
                {stats.last30Days.map(({ label, count }) => {
                  const max = Math.max(...stats.last30Days.map((d) => d.count), 1);
                  return (
                    <div key={label} className="grid grid-cols-[90px_1fr] gap-3 items-center">
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {label}
                      </span>
                      <Bar count={count} max={max} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Last 12 weeks */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">
                直近12週（週別）
              </h2>
              <div className="space-y-1.5">
                {stats.last12Weeks.map(({ label, count }) => {
                  const max = Math.max(...stats.last12Weeks.map((d) => d.count), 1);
                  return (
                    <div key={label} className="grid grid-cols-[90px_1fr] gap-3 items-center">
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {label}
                      </span>
                      <Bar count={count} max={max} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Last 12 months */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">
                直近12ヶ月（月別）
              </h2>
              <div className="space-y-1.5">
                {stats.last12Months.map(({ label, count }) => {
                  const max = Math.max(...stats.last12Months.map((d) => d.count), 1);
                  return (
                    <div key={label} className="grid grid-cols-[90px_1fr] gap-3 items-center">
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {label}
                      </span>
                      <Bar count={count} max={max} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
