'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { loadMembers } from '@/lib/memberStore';
import { getMembersFromGAS, getReports, getAvailableMonths } from '@/lib/api';
import { getPeriodReports, calcMemberStats, MemberStats } from '@/lib/calcStats';

const BENCHMARKS = { meet: 30, main: 50, negotiation: 40, contract: 30 } as const;

type FunnelRates = {
  visits: number; netMeet: number; mainMeet: number; negotiation: number; acquired: number;
  meetRate: number; mainRate: number; negRate: number; contractRate: number; totalRate: number;
};

function toFunnel(m: {
  visits: number; netMeet: number; mainMeet: number; negotiation: number; acquired: number;
}): FunnelRates {
  return {
    ...m,
    meetRate:     m.visits      > 0 ? Math.round(m.netMeet     / m.visits      * 100) : 0,
    mainRate:     m.netMeet     > 0 ? Math.round(m.mainMeet    / m.netMeet     * 100) : 0,
    negRate:      m.mainMeet    > 0 ? Math.round(m.negotiation / m.mainMeet    * 100) : 0,
    contractRate: m.negotiation > 0 ? Math.round(m.acquired    / m.negotiation * 100) : 0,
    totalRate:    m.visits      > 0 ? m.acquired / m.visits * 100 : 0,
  };
}

function rateColor(rate: number, bench: number) {
  if (rate >= bench) return 'text-green-600';
  if (rate >= bench * 0.6) return 'text-amber-600';
  return 'text-red-500';
}

function barColor(rate: number, bench: number) {
  if (rate >= bench) return 'bg-green-500';
  if (rate >= bench * 0.6) return 'bg-amber-400';
  return 'bg-red-400';
}

function bestStep(f: FunnelRates): { label: string; rate: number; bench: number } {
  const steps = [
    { label: '対面率', rate: f.meetRate,     bench: BENCHMARKS.meet },
    { label: '主権率', rate: f.mainRate,     bench: BENCHMARKS.main },
    { label: '商談率', rate: f.negRate,      bench: BENCHMARKS.negotiation },
    { label: '獲得率', rate: f.contractRate, bench: BENCHMARKS.contract },
  ].filter(s => s.rate > 0);
  if (steps.length === 0) return { label: '獲得率', rate: 0, bench: BENCHMARKS.contract };
  return steps.reduce((b, s) => s.rate / s.bench > b.rate / b.bench ? s : b);
}

const RANK_STYLE = ['bg-yellow-400 text-white', 'bg-gray-300 text-gray-700', 'bg-orange-400 text-white'];

export default function ActivityPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Record<string, unknown>[]>([]);
  const [members, setMembers] = useState(loadMembers());
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('month');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }

    setMembers(loadMembers());
    getMembersFromGAS().then(data => {
      if (data.length > 0) { localStorage.setItem('members', JSON.stringify(data)); setMembers(data); }
    });

    const stored = localStorage.getItem('reports');
    if (stored) {
      const parsed = JSON.parse(stored);
      setReports(parsed);
      setAvailableMonths(getAvailableMonths(parsed));
      setLoading(false);
      initialLoadDone.current = true;
    }
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
      setAvailableMonths(getAvailableMonths(data));
      localStorage.setItem('reports', JSON.stringify(data));
    } catch {
      const stored = localStorage.getItem('reports');
      if (stored) {
        const parsed = JSON.parse(stored);
        setReports(parsed);
        setAvailableMonths(getAvailableMonths(parsed));
      }
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
      setLastUpdated(new Date());
    }
  };

  const periodReports = getPeriodReports(reports, period);
  const allStats: MemberStats[] = members.map(m => calcMemberStats(periodReports, m, period));

  // Team aggregate funnel
  const agg = {
    visits:      allStats.reduce((s, m) => s + m.visits, 0),
    netMeet:     allStats.reduce((s, m) => s + m.netMeet, 0),
    mainMeet:    allStats.reduce((s, m) => s + m.mainMeet, 0),
    negotiation: allStats.reduce((s, m) => s + m.negotiation, 0),
    acquired:    allStats.reduce((s, m) => s + m.acquired, 0),
  };
  const teamFunnel = toFunnel(agg);

  const funnelSteps: {
    key: string; label: string; stepLabel: string; value: number; rate: number; bench: number | null;
  }[] = [
    { key: 'visit',   label: '訪問数',   stepLabel: '起点',      value: teamFunnel.visits,      rate: 100,                    bench: null },
    { key: 'meet',    label: '対面数',   stepLabel: '訪問→対面', value: teamFunnel.netMeet,     rate: teamFunnel.meetRate,    bench: BENCHMARKS.meet },
    { key: 'main',    label: '主権対面', stepLabel: '対面→主権', value: teamFunnel.mainMeet,    rate: teamFunnel.mainRate,    bench: BENCHMARKS.main },
    { key: 'neg',     label: '商談数',   stepLabel: '主権→商談', value: teamFunnel.negotiation, rate: teamFunnel.negRate,     bench: BENCHMARKS.negotiation },
    { key: 'contract',label: '契約数',   stepLabel: '商談→契約', value: teamFunnel.acquired,    rate: teamFunnel.contractRate, bench: BENCHMARKS.contract },
  ];

  const bottleneck = funnelSteps.slice(1).reduce<{
    label: string; stepLabel: string; rate: number; bench: number; score: number;
  } | null>((worst, step) => {
    if (step.bench == null) return worst;
    const score = step.rate / step.bench;
    if (!worst || score < worst.score)
      return { label: step.label, stepLabel: step.stepLabel, rate: step.rate, bench: step.bench, score };
    return worst;
  }, null);

  const maxVal = Math.max(teamFunnel.visits, 1);

  // Top 3 by acquired (件数ランキング)
  const top3 = [...allStats]
    .sort((a, b) => b.acquired - a.acquired)
    .filter(m => m.acquired > 0)
    .slice(0, 3)
    .map(m => ({ ...m, funnel: toFunnel(m) }));

  // Member table sorted by visits desc
  const tableData = allStats
    .map(m => ({ ...m, funnel: toFunnel(m) }))
    .sort((a, b) => b.funnel.visits - a.funnel.visits);

  const periodLabel = period === 'month' ? '今月' : period === 'week' ? '今週' : period.replace('-', '/');

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3">
        <div className="font-bold text-blue-400">行動量管理</div>
        <span className="text-sm bg-gray-700 px-2 py-1 rounded-lg">{periodLabel}</span>
        <div className="flex items-center gap-2 ml-auto">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              {lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button onClick={loadData} className="text-xs text-gray-400 active:opacity-60 transition-opacity select-none">🔄</button>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4 page-animate">

        {/* Period selector */}
        <div className="bg-white rounded-2xl p-3 shadow-sm space-y-2">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(['month', 'week'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-150 select-none
                  ${period === p ? 'bg-white text-blue-600 shadow font-bold' : 'text-gray-500 active:text-gray-700'}`}>
                {p === 'month' ? '今月' : '今週'}
              </button>
            ))}
          </div>
          {availableMonths.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {availableMonths.map(m => (
                <button key={m} onClick={() => setPeriod(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 select-none
                    ${period === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'}`}>
                  {m.replace('-', '/')}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
          </div>
        ) : (
          <>
            {/* Top 3 by acquired */}
            {top3.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="font-bold text-gray-800 mb-0.5">🏆 件数トップ3</div>
                <div className="text-xs text-gray-400 mb-4">この人のやり方を参考にしよう</div>
                <div className="space-y-3">
                  {top3.map((m, i) => {
                    const best = bestStep(m.funnel);
                    const isAbove = best.rate >= best.bench;
                    return (
                      <div key={m.name} className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 ${RANK_STYLE[i]}`}>
                          <span className="text-[10px] font-bold leading-none opacity-80">{i + 1}位</span>
                          <span className="text-lg font-black leading-tight">{m.acquired}</span>
                          <span className="text-[9px] leading-none opacity-80">件</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="font-bold text-gray-900">{m.name}</span>
                            <span className="text-xs font-bold text-blue-600">
                              総転換 {m.funnel.totalRate.toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs text-gray-400">強み:</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                              ${isAbove ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {isAbove ? '✓' : '▲'} {best.label} {best.rate}%
                              {isAbove ? ` （基準+${best.rate - best.bench}%）` : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Team funnel */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-4">📊 チーム転換率ファネル</div>

              {bottleneck && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                  <span className="text-base shrink-0 mt-0.5">⚠️</span>
                  <div>
                    <div className="text-sm font-bold text-red-700">
                      ボトルネック: {bottleneck.stepLabel}
                    </div>
                    <div className="text-xs text-red-500 mt-0.5">
                      現在 {bottleneck.rate}%（基準 {bottleneck.bench}%）— 最優先で改善を
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {funnelSteps.map((step, i) => (
                  <div key={step.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">{step.label}</span>
                        <span className="text-base font-bold text-gray-900">{step.value}</span>
                      </div>
                      {step.bench != null ? (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full
                          ${step.rate >= step.bench
                            ? 'bg-green-100 text-green-700'
                            : step.rate >= step.bench * 0.6
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-600'}`}>
                          {step.stepLabel} {step.rate}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">起点</span>
                      )}
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div
                        className={`h-5 rounded-full flex items-center justify-end pr-2 transition-all duration-400
                          ${step.bench != null ? barColor(step.rate, step.bench) : 'bg-blue-500'}`}
                        style={{ width: `${Math.max(step.value / maxVal * 100, step.value > 0 ? 3 : 0)}%` }}>
                        {step.value > 0 && <span className="text-white text-xs font-bold">{step.value}</span>}
                      </div>
                    </div>
                    {i < funnelSteps.length - 1 && (
                      <div className="text-center text-gray-200 text-sm mt-1">↓</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Benchmark legend */}
              <div className="mt-4 pt-3 border-t flex flex-wrap gap-1.5">
                {[
                  { label: '訪問→対面', bench: 30 },
                  { label: '対面→主権', bench: 50 },
                  { label: '主権→商談', bench: 40 },
                  { label: '商談→契約', bench: 30 },
                ].map(b => (
                  <span key={b.label} className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                    {b.label} 基準{b.bench}%
                  </span>
                ))}
              </div>
            </div>

            {/* Member conversion table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b">
                <div className="font-bold text-gray-800">👥 メンバー別転換率</div>
                <div className="text-xs text-gray-400 mt-0.5">訪問数の多い順 · 高→緑 中→amber 低→赤</div>
              </div>

              <div className="overflow-x-auto relative">
                {/* Right gradient hint for scroll */}
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-10" />
                <table className="w-full text-xs">
                  <thead className="bg-gray-800 text-white">
                    <tr>
                      {['氏名', '訪問', '対面率', '主権率', '商談率', '獲得率', '総転換'].map(h => (
                        <th key={h} className="px-2.5 py-2.5 text-left whitespace-nowrap font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tableData.map((m, i) => (
                      <tr key={m.name} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-2.5 py-3 font-bold text-gray-900 whitespace-nowrap">{m.name}</td>
                        <td className="px-2.5 py-3 font-medium text-gray-600">{m.funnel.visits}</td>
                        <td className={`px-2.5 py-3 font-bold ${rateColor(m.funnel.meetRate, BENCHMARKS.meet)}`}>
                          {m.funnel.meetRate}%
                        </td>
                        <td className={`px-2.5 py-3 font-bold ${rateColor(m.funnel.mainRate, BENCHMARKS.main)}`}>
                          {m.funnel.mainRate}%
                        </td>
                        <td className={`px-2.5 py-3 font-bold ${rateColor(m.funnel.negRate, BENCHMARKS.negotiation)}`}>
                          {m.funnel.negRate}%
                        </td>
                        <td className={`px-2.5 py-3 font-bold ${rateColor(m.funnel.contractRate, BENCHMARKS.contract)}`}>
                          {m.funnel.contractRate}%
                        </td>
                        <td className="px-2.5 py-3 font-bold text-blue-600 whitespace-nowrap">
                          {m.funnel.totalRate.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-2.5 bg-gray-50 text-xs text-gray-400">
                ※ 訪問数の多い順に表示
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
