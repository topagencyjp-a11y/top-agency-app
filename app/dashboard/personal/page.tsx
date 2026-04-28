'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { loadMembers } from '@/lib/memberStore';
import { getMembersFromGAS, getReports } from '@/lib/api';
import { getPeriodReports, calcMemberStats, MemberStats } from '@/lib/calcStats';
import { MEMBERS as DEFAULT_MEMBERS } from '@/lib/members';

// ── Funnel helpers ──────────────────────────────────────────────────────────
const BENCHMARKS = { meet: 30, main: 50, negotiation: 40, contract: 30 } as const;

type FunnelRates = {
  meetRate: number; mainRate: number; negRate: number; contractRate: number; totalRate: number;
};

function toFunnelRates(m: { visits: number; netMeet: number; mainMeet: number; negotiation: number; acquired: number }): FunnelRates {
  return {
    meetRate:     m.visits      > 0 ? Math.round(m.netMeet     / m.visits      * 100) : 0,
    mainRate:     m.netMeet     > 0 ? Math.round(m.mainMeet    / m.netMeet     * 100) : 0,
    negRate:      m.mainMeet    > 0 ? Math.round(m.negotiation / m.mainMeet    * 100) : 0,
    contractRate: m.negotiation > 0 ? Math.round(m.acquired    / m.negotiation * 100) : 0,
    totalRate:    m.visits      > 0 ? m.acquired / m.visits * 100 : 0,
  };
}

// ── Area helpers ────────────────────────────────────────────────────────────
function extractAreas(reports: Record<string, any>[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of reports) {
    for (let i = 1; i <= 10; i++) {
      const area = (r[`area${i}`] as string | undefined)?.trim();
      if (area) map.set(area, (map.get(area) ?? 0) + 1);
    }
  }
  return map;
}

// ── Auto comment ────────────────────────────────────────────────────────────
function buildComments(
  stats: MemberStats,
  selfRates: FunnelRates,
  teamRates: FunnelRates,
): string[] {
  const msgs: string[] = [];

  if (stats.forecast >= stats.target) {
    msgs.push('✅ 目標達成見込みです。このペースを維持しましょう！');
  } else if (stats.forecast >= stats.target * 0.8) {
    msgs.push('📈 あと少し。ペースを維持すれば達成圏内です。');
  } else {
    msgs.push('⚡ 現状ペースでは目標に届きません。1日あたりの必要件数を意識しましょう。');
  }

  if (stats.paceGap >= 0) {
    msgs.push('✅ 進捗はペース通りです。');
  } else {
    msgs.push(`⚠️ 今日時点でペースより ${Math.abs(stats.paceGap).toFixed(1)}件 遅れています。`);
  }

  if (stats.neededPerDay >= 2.0) {
    msgs.push(`🔥 残り稼働日から逆算すると1日 ${stats.neededPerDay.toFixed(1)}件 必要です。集中力MAX で！`);
  }

  if (teamRates.meetRate > 0 && selfRates.meetRate < teamRates.meetRate) {
    msgs.push('対面率がチーム平均より低めです。声かけの入り方を見直しましょう。');
  }
  if (teamRates.negRate > 0 && selfRates.negRate < teamRates.negRate) {
    msgs.push('商談率がチーム平均より低めです。主権者への提案フローを確認しましょう。');
  }

  return msgs;
}

// ── Month helpers ───────────────────────────────────────────────────────────
const today = new Date();
const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

// same elapsed-day count in previous month
function getLastMonthSameDayCount(
  reports: Record<string, any>[],
  name: string,
): number {
  const elapsed = today.getDate();
  const yr = lastMonthDate.getFullYear();
  const mo = lastMonthDate.getMonth() + 1;
  return reports
    .filter(r => {
      if (r.name !== name) return false;
      if (!String(r.date).startsWith(lastMonth)) return false;
      return new Date(r.date).getDate() <= elapsed;
    })
    .reduce((s, r) => s + (Number(r.acquired) || 0), 0);
}

// ── Heatmap helpers ─────────────────────────────────────────────────────────
function heatColor(n: number) {
  if (n === 0) return 'bg-gray-100 text-gray-300';
  if (n === 1) return 'bg-green-200 text-green-700';
  return 'bg-green-500 text-white';
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export default function PersonalPage() {
  const router = useRouter();
  const [user, setUser] = useState<Record<string, any> | null>(null);
  const [reports, setReports] = useState<Record<string, any>[]>([]);
  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [loading, setLoading] = useState(true);
  const [viewingMember, setViewingMember] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    const parsed = JSON.parse(u);
    setUser(parsed);
    setViewingMember(parsed.name);
    setMembers(loadMembers());
    getMembersFromGAS().then(data => {
      if (data.length > 0) { localStorage.setItem('members', JSON.stringify(data)); setMembers(data); }
    });

    const stored = localStorage.getItem('reports');
    if (stored) { setReports(JSON.parse(stored)); setLoading(false); initialLoadDone.current = true; }
    loadData();

    const interval = setInterval(loadData, 20000);
    const onVisible = () => { if (document.visibilityState === 'visible') loadData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const loadData = async () => {
    if (!initialLoadDone.current) setLoading(true);
    try {
      const data = await getReports();
      setReports(data);
      localStorage.setItem('reports', JSON.stringify(data));
    } catch {
      const stored = localStorage.getItem('reports');
      if (stored) setReports(JSON.parse(stored));
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
      setLastUpdated(new Date());
    }
  };

  // ── Computed ─────────────────────────────────────────────────────────────
  const thisMonthReports = getPeriodReports(reports, 'month');
  const lastMonthReports = reports.filter(r => String(r.date).startsWith(lastMonth));

  const viewMember = members.find(m => m.name === viewingMember);
  const stats: MemberStats | null = viewMember
    ? calcMemberStats(thisMonthReports, viewMember, 'month')
    : null;

  // Self funnel rates
  const selfRates: FunnelRates = stats
    ? toFunnelRates(stats)
    : { meetRate: 0, mainRate: 0, negRate: 0, contractRate: 0, totalRate: 0 };

  // Team funnel aggregate
  const allStats = members.map(m => calcMemberStats(thisMonthReports, m, 'month'));
  const teamAgg = {
    visits:      allStats.reduce((s, m) => s + m.visits, 0),
    netMeet:     allStats.reduce((s, m) => s + m.netMeet, 0),
    mainMeet:    allStats.reduce((s, m) => s + m.mainMeet, 0),
    negotiation: allStats.reduce((s, m) => s + m.negotiation, 0),
    acquired:    allStats.reduce((s, m) => s + m.acquired, 0),
  };
  const teamRates = toFunnelRates(teamAgg);

  // Bottleneck: step where self/team ratio is lowest
  const funnelComparison = [
    { label: '対面率',  self: selfRates.meetRate,     team: teamRates.meetRate,     bench: BENCHMARKS.meet },
    { label: '主権率',  self: selfRates.mainRate,     team: teamRates.mainRate,     bench: BENCHMARKS.main },
    { label: '商談率',  self: selfRates.negRate,      team: teamRates.negRate,      bench: BENCHMARKS.negotiation },
    { label: '獲得率',  self: selfRates.contractRate, team: teamRates.contractRate, bench: BENCHMARKS.contract },
  ];
  const bottleneck = funnelComparison
    .filter(s => s.team > 0)
    .reduce<typeof funnelComparison[0] | null>((worst, s) => {
      const ratio = s.self / s.team;
      if (!worst) return s;
      return ratio < worst.self / worst.team ? s : worst;
    }, null);

  // Heatmap data: acquired per day this month
  const daysInMonth = getDaysInMonth(today.getFullYear(), today.getMonth() + 1);
  const heatmap: number[] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    const dateStr = `${thisMonth}-${day}`;
    return thisMonthReports
      .filter(r => r.name === viewingMember && r.date === dateStr)
      .reduce((s, r) => s + (Number(r.acquired) || 0), 0);
  });
  const firstDow = new Date(`${thisMonth}-01`).getDay(); // 0=Sun

  // Area analysis
  const selfThisMonthReports = thisMonthReports.filter(r => r.name === viewingMember);
  const selfLastMonthReports = lastMonthReports.filter(r => r.name === viewingMember);
  const thisAreas = extractAreas(selfThisMonthReports);
  const lastAreas = extractAreas(selfLastMonthReports);
  const sortedAreas = [...thisAreas.entries()].sort((a, b) => b[1] - a[1]);
  const top3Areas = sortedAreas.slice(0, 3);
  const newAreas = sortedAreas.filter(([area]) => !lastAreas.has(area));
  const grewAreas = sortedAreas.filter(([area, cnt]) => lastAreas.has(area) && cnt > (lastAreas.get(area) ?? 0));

  // Last month same-day comparison
  const lastMonthSameDay = getLastMonthSameDayCount(reports, viewingMember);

  // Auto comments
  const comments = stats ? buildComments(stats, selfRates, teamRates) : [];

  const myRate = stats && stats.target > 0 ? Math.round(stats.acquired / stats.target * 100) : 0;
  const isViewingSelf = viewingMember === user?.name;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-gray-900 text-white px-4 py-3">
          <div className="font-bold text-blue-400">個人分析</div>
        </div>
        <div className="p-4 space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-bold text-blue-400">個人分析</div>
          <span className="text-sm bg-gray-700 px-2 py-1 rounded-lg">{thisMonth.replace('-', '/')}</span>
          {user?.isManager && (
            <button onClick={() => setShowPicker(p => !p)}
              className="text-sm bg-yellow-600/30 text-yellow-300 px-2 py-1 rounded-lg flex items-center gap-1">
              {viewingMember} ▾
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              {lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button onClick={loadData} className="text-xs text-gray-400 active:opacity-60 select-none">🔄</button>
        </div>
      </div>

      {/* Member picker (manager only) */}
      {showPicker && user?.isManager && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex flex-wrap gap-2">
          {members.map(m => (
            <button key={m.id} onClick={() => { setViewingMember(m.name); setShowPicker(false); }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 select-none
                ${viewingMember === m.name ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
              {m.name}
            </button>
          ))}
        </div>
      )}

      {!isViewingSelf && user?.isManager && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-bold text-yellow-700">📋 {viewingMember} の個人分析</span>
          <button onClick={() => setViewingMember(user!.name)} className="text-xs text-yellow-600 underline">自分に戻る</button>
        </div>
      )}

      {stats ? (
        <div className="p-4 max-w-2xl mx-auto space-y-4 page-animate">

          {/* ① 今月の達成状況 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="font-bold text-gray-800 mb-4">① 今月の達成状況</div>
            <div className="flex items-end justify-between mb-3">
              <div>
                <span className="text-5xl font-black text-blue-600">{stats.acquired}</span>
                <span className="text-lg text-gray-400 ml-1">/ {stats.target}件</span>
              </div>
              <div className={`text-2xl font-bold ${myRate >= 80 ? 'text-green-600' : myRate >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                {myRate}%
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
              <div className={`h-3 rounded-full transition-all duration-700 ${myRate >= 80 ? 'bg-green-500' : myRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(myRate, 100)}%` }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 着地予想 */}
              <div className="border-2 border-amber-300 bg-amber-50 rounded-2xl p-3">
                <div className="text-xs text-amber-600 font-medium mb-1">着地予想</div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black text-amber-600">{stats.forecast}</span>
                  <span className="text-sm text-amber-500 mb-0.5">件</span>
                </div>
                <div className={`text-xs font-bold mt-1 ${stats.goalGap >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  目標比 {stats.goalGap >= 0 ? '+' : ''}{stats.goalGap}件
                </div>
              </div>

              {/* ペース判定 */}
              <div className={`rounded-2xl p-3 ${stats.paceGap >= 0 ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-200'}`}>
                <div className={`text-xs font-medium mb-1 ${stats.paceGap >= 0 ? 'text-green-600' : 'text-red-500'}`}>ペース判定</div>
                <div className={`text-2xl font-black ${stats.paceGap >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {stats.paceGap >= 0 ? '順調' : '遅れ'}
                </div>
                <div className={`text-xs font-bold mt-1 ${stats.paceGap >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {stats.paceGap >= 0 ? '+' : ''}{stats.paceGap.toFixed(1)}件
                </div>
              </div>
            </div>
          </div>

          {/* ② ペース分析 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="font-bold text-gray-800 mb-3">② ペース分析</div>
            <div className="space-y-0 divide-y divide-gray-100">
              {[
                { label: '今日時点の必要件数/日', value: `${stats.neededPerDay.toFixed(1)} 件/日`, color: stats.neededPerDay >= 2.0 ? 'text-red-500' : stats.neededPerDay >= 1.0 ? 'text-amber-600' : 'text-green-600' },
                { label: '残稼働日数', value: `${stats.remainDays} 日`, color: stats.remainDays <= 5 ? 'text-red-500' : '' },
                { label: '現在の生産性', value: `${stats.productivity.toFixed(2)} 件/日`, color: '' },
                { label: '実稼働日数', value: `${stats.workedDays} 日`, color: '' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center py-2.5">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className={`font-bold ${item.color || 'text-gray-900'}`}>{item.value}</span>
                </div>
              ))}
              {/* 先月同時期比較 */}
              <div className="flex justify-between items-center py-2.5">
                <span className="text-sm text-gray-600">先月同時期（{today.getDate()}日時点）</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">{lastMonthSameDay} 件</span>
                  {lastMonthSameDay > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                      ${stats.acquired >= lastMonthSameDay ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {stats.acquired >= lastMonthSameDay ? `+${stats.acquired - lastMonthSameDay}` : `${stats.acquired - lastMonthSameDay}`}件
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ③ 転換率ファネル */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="font-bold text-gray-800 mb-3">③ 転換率ファネル</div>

            {bottleneck && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <div className="text-sm font-bold text-red-700">
                  ⚠️ ボトルネック: {bottleneck.label}
                </div>
                <div className="text-xs text-red-500 mt-0.5">
                  自分 {bottleneck.self}% ← チーム平均 {bottleneck.team}%
                </div>
              </div>
            )}

            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-4 text-xs text-gray-400 font-medium pb-1 border-b">
                <span>ステップ</span>
                <span className="text-center">自分</span>
                <span className="text-center">チーム</span>
                <span className="text-center">基準</span>
              </div>
              {funnelComparison.map(step => {
                const selfColor = step.self >= step.bench ? 'text-green-600' : step.self >= step.bench * 0.6 ? 'text-amber-600' : 'text-red-500';
                const isWeak = bottleneck?.label === step.label;
                return (
                  <div key={step.label} className={`grid grid-cols-4 items-center py-2 ${isWeak ? 'bg-red-50 -mx-1 px-1 rounded-lg' : ''}`}>
                    <span className={`text-sm font-medium ${isWeak ? 'text-red-700 font-bold' : 'text-gray-700'}`}>
                      {isWeak && '⚠️ '}{step.label}
                    </span>
                    <span className={`text-center font-bold text-sm ${selfColor}`}>{step.self}%</span>
                    <span className="text-center text-sm text-gray-500">{step.team}%</span>
                    <span className="text-center text-xs text-gray-400">{step.bench}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ④ 日別カレンダーヒートマップ */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="font-bold text-gray-800 mb-3">④ 稼働カレンダー</div>
            {/* Day of week labels */}
            <div className="grid grid-cols-7 mb-1">
              {['日', '月', '火', '水', '木', '金', '土'].map(d => (
                <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {/* Leading empty cells */}
              {Array.from({ length: firstDow }, (_, i) => <div key={`empty-${i}`} />)}
              {heatmap.map((count, i) => {
                const day = i + 1;
                const dateStr = `${thisMonth}-${String(day).padStart(2, '0')}`;
                const isToday = day === today.getDate();
                const isFuture = day > today.getDate();
                return (
                  <div key={day}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-center
                      ${isFuture ? 'bg-gray-50 text-gray-200' : heatColor(count)}
                      ${isToday ? 'ring-2 ring-blue-400' : ''}`}>
                    <span className="text-[10px] leading-none font-medium">{day}</span>
                    {!isFuture && count > 0 && (
                      <span className="text-[9px] font-bold leading-none mt-0.5">{count}</span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3 mt-3 justify-end text-xs text-gray-400">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-gray-100" /> 0件</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-200" /> 1件</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500" /> 2件〜</div>
            </div>
          </div>

          {/* ⑤ 自動コメント */}
          {comments.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-3">⑤ フィードバック</div>
              <div className="space-y-2">
                {comments.map((msg, i) => (
                  <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
                    <span className="text-sm leading-relaxed text-gray-700">{msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ⑥ 獲得エリア分析 */}
          {sortedAreas.length > 0 ? (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-3">⑥ 獲得エリア分析</div>

              {/* Top 3 badges */}
              {top3Areas.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-bold text-gray-500 mb-2">🏆 得意エリア TOP3</div>
                  <div className="flex flex-wrap gap-2">
                    {top3Areas.map(([area, cnt], i) => (
                      <div key={area} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold
                        ${i === 0 ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                          : i === 1 ? 'bg-gray-100 text-gray-600 border border-gray-300'
                          : 'bg-orange-100 text-orange-600 border border-orange-300'}`}>
                        <span>{['🥇', '🥈', '🥉'][i]}</span>
                        <span>{area}</span>
                        <span className="bg-white/70 px-1.5 py-0.5 rounded-full text-xs">{cnt}件</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All areas list */}
              <div className="space-y-1.5 mb-4">
                {sortedAreas.map(([area, cnt], i) => {
                  const max = sortedAreas[0][1];
                  const last = lastAreas.get(area) ?? 0;
                  const diff = cnt - last;
                  return (
                    <div key={area} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-medium text-gray-800 truncate">{area}</span>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {diff !== 0 && last > 0 && (
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full
                                ${diff > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            )}
                            {last === 0 && <span className="text-xs bg-blue-100 text-blue-600 font-bold px-1.5 py-0.5 rounded-full">NEW</span>}
                            <span className="text-sm font-bold text-gray-900">{cnt}件</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${cnt / max * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* New areas / grew areas */}
              {(newAreas.length > 0 || grewAreas.length > 0) && (
                <div className="border-t pt-3 space-y-2">
                  {newAreas.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-blue-600 mb-1.5">✨ 今月の新規エリア</div>
                      <div className="flex flex-wrap gap-1.5">
                        {newAreas.map(([area, cnt]) => (
                          <span key={area} className="text-xs bg-blue-50 text-blue-700 font-medium px-2.5 py-1 rounded-full">
                            {area} {cnt}件
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {grewAreas.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-green-600 mb-1.5">📈 先月より増えたエリア</div>
                      <div className="flex flex-wrap gap-1.5">
                        {grewAreas.map(([area, cnt]) => (
                          <span key={area} className="text-xs bg-green-50 text-green-700 font-medium px-2.5 py-1 rounded-full">
                            {area} {cnt}件（先月 {lastAreas.get(area)}件）
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center text-gray-400 text-sm">
              今月の獲得エリアデータがありません
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center text-gray-400">メンバー情報が見つかりません</div>
      )}
    </div>
  );
}
