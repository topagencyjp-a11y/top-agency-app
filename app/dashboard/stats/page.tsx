'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBERS, TEAM_TARGET as BASE_TEAM_TARGET } from '@/lib/members';
import { loadMembers } from '@/lib/memberStore';
import { getReports, getMonthlySummary, getAvailableMonths } from '@/lib/api';
import { calcMemberStats, calcTeamStats, getPeriodReports, MemberStats } from '@/lib/calcStats';

type Period = 'month' | 'week' | string;

// ── helpers ─────────────────────────────────────────────────────────────────

function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return `${y}年${parseInt(m)}月`;
}

function sign(v: number): string {
  return v >= 0 ? `+${v}` : `${v}`;
}

function signF(v: number, digits = 1): string {
  const s = v.toFixed(digits);
  return v >= 0 ? `+${s}` : s;
}

function neededColor(v: number): string {
  if (v > 1.5) return 'text-red-600';
  if (v > 1.0) return 'text-amber-600';
  return 'text-green-600';
}

function barColor(forecast: number, target: number): string {
  if (forecast >= target)        return '#22c55e';
  if (forecast >= target * 0.8)  return '#f59e0b';
  return '#ef4444';
}

function RankCircle({ rank }: { rank: number }) {
  const cls =
    rank === 1 ? 'bg-yellow-400 text-yellow-900' :
    rank === 2 ? 'bg-gray-300 text-gray-700' :
    rank === 3 ? 'bg-amber-600 text-amber-100' :
                 'bg-gray-200 text-gray-500';
  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${cls}`}>
      {rank}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${
      role === 'closer' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
    }`}>
      {role === 'closer' ? 'CL' : 'AP'}
    </span>
  );
}

function GoalGapBadge({ gap }: { gap: number }) {
  const cls = gap >= 0
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-600';
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 font-medium ${cls}`}>
      {sign(gap)}件
    </span>
  );
}

function SkeletonView() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
      <div className="skeleton h-64 rounded-2xl" />
      <div className="skeleton h-44 rounded-2xl" />
      <div className="skeleton h-52 rounded-2xl" />
    </div>
  );
}

function EmptyState({ period }: { period: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <div className="text-4xl mb-3">📭</div>
      <p className="text-base">{period}のデータがありません</p>
    </div>
  );
}

// ── main component ───────────────────────────────────────────────────────────

export default function StatsPage() {
  const router = useRouter();
  const [allReports, setAllReports] = useState<Record<string, unknown>[]>([]);
  const [members, setMembers] = useState(MEMBERS);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [animated, setAnimated] = useState(false);
  const initialDone = useRef(false);

  const loadData = useCallback(async () => {
    if (!initialDone.current) setLoading(true);
    try {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      // Warm up GAS monthlySummary endpoint in parallel
      const [reports] = await Promise.all([
        getReports(),
        getMonthlySummary(currentMonth),
      ]);
      setAllReports(reports);
      setAvailableMonths(getAvailableMonths(reports));
      localStorage.setItem('reports', JSON.stringify(reports));
    } finally {
      setLoading(false);
      initialDone.current = true;
    }
  }, []);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }

    const m = loadMembers();
    setMembers(m);

    const stored = localStorage.getItem('reports');
    if (stored) {
      try {
        const r = JSON.parse(stored) as Record<string, unknown>[];
        setAllReports(r);
        setAvailableMonths(getAvailableMonths(r));
        setLoading(false);
        initialDone.current = true;
      } catch { /* ignore */ }
    }
    loadData();

    const interval = setInterval(loadData, 20000);
    const onVisible = () => { if (document.visibilityState === 'visible') loadData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [loadData]);

  // Re-trigger bar animation on period change
  useEffect(() => {
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, [period]);

  // ── derived stats ──────────────────────────────────────────────────────────

  const periodReports = getPeriodReports(allReports, period);
  const memberStats   = members.map(m => calcMemberStats(periodReports, m, period));
  const teamTarget    = memberStats.reduce((s, m) => s + m.target, 0) || BASE_TEAM_TARGET;
  const teamStats     = calcTeamStats(memberStats, teamTarget);

  const sortedForecast = [...memberStats].sort((a, b) => b.forecast - a.forecast);
  const sortedAcquired = [...memberStats].sort((a, b) => b.acquired - a.acquired);
  const maxForecast    = Math.max(...memberStats.map(m => m.forecast), 1);
  const maxAcquired    = Math.max(...memberStats.map(m => m.acquired), 1);

  const isEmpty = periodReports.length === 0 && !loading;

  const periodLabel =
    period === 'month' ? '今月' :
    period === 'week'  ? '今週' :
    fmtMonth(period);

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-bold text-blue-400">件数管理</div>
          <span className="text-sm bg-gray-700 px-2 py-0.5 rounded-lg">{periodLabel}</span>
        </div>
        <button onClick={loadData} className="text-gray-400 active:opacity-60 transition-opacity select-none">🔄</button>
      </div>

      {/* Period Selector — sticky */}
      <div className="sticky top-0 z-10 bg-gray-100 px-4 pt-2 pb-2">
        <div className="flex items-stretch bg-gray-200 rounded-xl p-1 gap-1 max-w-xs">
          {(['month', 'week'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 select-none ${
                period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 active:bg-white/60'
              }`}
            >
              {p === 'month' ? '今月' : '今週'}
            </button>
          ))}
          <div className={`flex-1 rounded-lg transition-all duration-150 ${
            !['month', 'week'].includes(period) ? 'bg-white shadow-sm' : ''
          }`}>
            <select
              value={!['month', 'week'].includes(period) ? period : ''}
              onChange={e => { if (e.target.value) setPeriod(e.target.value); }}
              className="w-full h-full py-1.5 text-sm font-medium text-center bg-transparent outline-none cursor-pointer appearance-none"
              style={{ color: !['month', 'week'].includes(period) ? '#111827' : '#6b7280' }}
            >
              <option value="">月選択</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{fmtMonth(m)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-3xl mx-auto">
        {loading ? (
          <SkeletonView />
        ) : isEmpty ? (
          <EmptyState period={periodLabel} />
        ) : (
          <div key={period} className="space-y-4 page-animate">

            {/* ── Section 1: Team Summary Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

              {/* Card 1: 現状獲得 */}
              <div
                className="bg-gray-900 text-white rounded-2xl p-4 flex flex-col gap-1"
                style={{ opacity: animated ? 1 : 0, transform: animated ? 'none' : 'translateY(6px)', transition: 'opacity 300ms ease-out, transform 300ms ease-out' }}
              >
                <div className="text-xs text-gray-400">現状獲得</div>
                <div className="text-3xl font-bold text-blue-400">{teamStats.totalAcquired}</div>
                <div className="text-xs text-gray-400">目標 {teamTarget}件</div>
                <div className="mt-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all duration-[400ms] ease-out"
                    style={{ width: animated ? `${Math.min(100, teamStats.totalAcquired / teamTarget * 100)}%` : '0%' }}
                  />
                </div>
              </div>

              {/* Card 2: 着地予想 ★ (dominant) */}
              <div
                className="bg-white rounded-2xl p-4 flex flex-col gap-1 border-2 border-amber-400"
                style={{ opacity: animated ? 1 : 0, transform: animated ? 'none' : 'translateY(6px)', transition: 'opacity 300ms ease-out 50ms, transform 300ms ease-out 50ms' }}
              >
                <div className="text-xs text-gray-500 font-medium">着地予想 ★</div>
                <div className="text-3xl font-bold text-amber-500">{teamStats.teamForecast}</div>
                {teamStats.goalGap >= 0 ? (
                  <span className="text-xs px-1.5 py-0.5 self-start rounded-full bg-green-100 text-green-700 font-medium">
                    {sign(Math.round(teamStats.goalGap))}件 達成見込み
                  </span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 self-start rounded-full bg-red-100 text-red-600 font-medium">
                    {Math.round(teamStats.goalGap)}件 未達見込み
                  </span>
                )}
              </div>

              {/* Card 3: ペース判定 */}
              <div
                className="bg-white rounded-2xl p-4 flex flex-col gap-1 shadow-sm"
                style={{ opacity: animated ? 1 : 0, transform: animated ? 'none' : 'translateY(6px)', transition: 'opacity 300ms ease-out 100ms, transform 300ms ease-out 100ms' }}
              >
                <div className="text-xs text-gray-500 font-medium">ペース判定</div>
                <div className={`text-2xl font-bold ${teamStats.paceGap >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {signF(teamStats.paceGap, 1)}件
                </div>
                <div className="text-xs text-gray-400">今日時点の進捗</div>
              </div>

              {/* Card 4: 平均必要/日 */}
              <div
                className="bg-white rounded-2xl p-4 flex flex-col gap-1 shadow-sm"
                style={{ opacity: animated ? 1 : 0, transform: animated ? 'none' : 'translateY(6px)', transition: 'opacity 300ms ease-out 150ms, transform 300ms ease-out 150ms' }}
              >
                <div className="text-xs text-gray-500 font-medium">平均必要/日</div>
                <div className={`text-2xl font-bold ${neededColor(teamStats.avgNeededPerDay)}`}>
                  {teamStats.avgNeededPerDay.toFixed(1)}件
                </div>
                <div className="text-xs text-gray-400">残り{teamStats.avgRemainDays}日</div>
              </div>
            </div>

            {/* ── Section 2: 着地予想ランキング ── */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-l-4 border-l-amber-400">
                <div className="font-bold text-gray-900">着地予想ランキング</div>
                <div className="text-xs text-gray-400 mt-0.5">このペースで月末に何件取れるか</div>
              </div>
              <div className="p-4 space-y-3">
                {sortedForecast.map((m, i) => {
                  const pct = (m.forecast / maxForecast) * 100;
                  const targetPct = Math.min(100, (m.target / maxForecast) * 100);
                  const color = barColor(m.forecast, m.target);
                  return (
                    <div
                      key={m.name}
                      className="flex items-center gap-2"
                      style={{ height: 52 }}
                    >
                      {/* Left: rank + name + role */}
                      <div className="flex items-center gap-1.5 w-28 shrink-0">
                        <RankCircle rank={i + 1} />
                        <span className="text-sm font-bold text-gray-900 truncate">{m.name}</span>
                        <RoleBadge role={m.role} />
                      </div>

                      {/* Center: bar */}
                      <div className="relative flex-1 h-6">
                        <div className="absolute inset-0 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: animated ? `${pct}%` : '0%',
                              backgroundColor: color,
                              transition: `width 400ms ease-out ${i * 40}ms`,
                            }}
                          />
                        </div>
                        {/* Target line */}
                        <div
                          className="absolute top-0 bottom-0 w-px"
                          style={{
                            left: `${targetPct}%`,
                            borderLeft: '2px dashed #9ca3af',
                          }}
                        />
                      </div>

                      {/* Right: forecast + gap */}
                      <div className="flex items-center gap-1 shrink-0 w-20 justify-end">
                        <span className="text-sm font-bold text-gray-900">{m.forecast}件</span>
                        <GoalGapBadge gap={m.goalGap} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Section 3: 現状件数ランキング ── */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b">
                <div className="font-bold text-gray-900 text-sm">現状獲得ランキング</div>
              </div>
              <div className="p-4 space-y-2">
                {sortedAcquired.map((m, i) => {
                  const pct = (m.acquired / maxAcquired) * 100;
                  return (
                    <div key={m.name} className="flex items-center gap-2" style={{ height: 40 }}>
                      <div className="flex items-center gap-1.5 w-28 shrink-0">
                        <RankCircle rank={i + 1} />
                        <span className="text-sm font-medium text-gray-800 truncate">{m.name}</span>
                      </div>
                      <div className="flex-1 h-[22px] bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{
                            width: animated ? `${pct}%` : '0%',
                            transition: `width 400ms ease-out ${i * 40}ms`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-bold text-blue-600 w-12 text-right shrink-0">
                        {m.acquired}件
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Section 4: Detail Table ── */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b font-bold text-gray-900 text-sm">メンバー詳細</div>
              <div className="relative">
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        {['氏名', '目標', '現状', '着地★', '目標差', '実稼働', '残稼働', '生産性', '必要/日', 'ペース'].map(h => (
                          <th
                            key={h}
                            className={`px-2 py-2 text-left whitespace-nowrap ${h === '氏名' ? 'sticky left-0 z-10 bg-gray-800' : ''}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {memberStats.map((m, i) => {
                        const rowBg =
                          m.forecast >= m.target ? 'bg-green-50' :
                          m.paceGap < -2          ? 'bg-red-50' :
                          i % 2 === 0             ? 'bg-white' : 'bg-gray-50';
                        return (
                          <tr key={m.name} className={`border-b ${rowBg}`}>
                            <td className={`px-2 py-2.5 font-bold text-gray-900 whitespace-nowrap sticky left-0 z-10 ${rowBg}`}>
                              {m.name}
                            </td>
                            <td className="px-2 py-2.5 text-gray-600 whitespace-nowrap">{m.target}</td>
                            <td className="px-2 py-2.5 font-bold text-blue-600 whitespace-nowrap">{m.acquired}</td>
                            <td className="px-2 py-2.5 font-bold text-amber-600 whitespace-nowrap">{m.forecast}</td>
                            <td className={`px-2 py-2.5 font-bold whitespace-nowrap ${m.goalGap >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {sign(m.goalGap)}
                            </td>
                            <td className="px-2 py-2.5 text-gray-600 whitespace-nowrap">{m.workedDays}日</td>
                            <td className="px-2 py-2.5 text-gray-600 whitespace-nowrap">{m.remainDays}日</td>
                            <td className="px-2 py-2.5 text-gray-700 whitespace-nowrap">{m.productivity.toFixed(2)}</td>
                            <td className={`px-2 py-2.5 font-medium whitespace-nowrap ${neededColor(m.neededPerDay)}`}>
                              {m.neededPerDay.toFixed(1)}
                            </td>
                            <td className={`px-2 py-2.5 font-medium whitespace-nowrap ${m.paceGap >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {signF(m.paceGap, 1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold border-t-2">
                      <tr>
                        <td className="px-2 py-2 text-gray-900 sticky left-0 z-10 bg-gray-100 whitespace-nowrap">チーム</td>
                        <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{teamTarget}</td>
                        <td className="px-2 py-2 text-blue-600 whitespace-nowrap">{teamStats.totalAcquired}</td>
                        <td className="px-2 py-2 text-amber-600 whitespace-nowrap">{teamStats.teamForecast}</td>
                        <td className={`px-2 py-2 whitespace-nowrap ${teamStats.goalGap >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {sign(Math.round(teamStats.goalGap))}
                        </td>
                        <td colSpan={5} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {/* Right scroll shadow hint */}
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white/80 to-transparent" />
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
