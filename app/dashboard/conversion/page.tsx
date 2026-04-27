'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { loadMembers } from '@/lib/memberStore';
import { getMembersFromGAS, getReports, getAvailableMonths } from '@/lib/api';
import { getPeriodReports, calcMemberStats, MemberStats } from '@/lib/calcStats';

const TIPS: Record<string, string[]> = {
  visit: [
    '訪問エリアを見直す（反応率の高いエリアに集中）',
    '訪問時間帯を変える（夕方・週末など在宅率が高い時間）',
    '1日の訪問目標を数値で決めて手帳に記録する',
    'ルート設計を前日夜に完了させる',
  ],
  meet: [
    'インターフォン突破のトークを磨く（最初の一言が鍵）',
    '第一声を変える（「au光のご案内です」より「近隣でお得な情報が〜」）',
    '笑顔・声のトーン・服装を整える',
    '玄関先に立つ前に深呼吸して気持ちをリセット',
    '断られた理由を毎日記録して改善パターンを見つける',
  ],
  main: [
    '対面中にインターネット料金の話を自然に出す',
    '「今のネット、月いくらですか？」の一言で主権者を引き出す',
    '世帯構成・家族構成を早めに確認する',
    '主権者不在なら次回訪問日時を必ずその場で約束する',
  ],
  negotiation: [
    '料金比較表を使ってビジュアルで説明する',
    'お客様の現状の不満・課題を先に引き出す',
    '「もし今より安くなるなら〜」という仮定質問を使う',
    '反論処理（値段・工事日程・縛り）のロールプレイを毎朝やる',
  ],
  contract: [
    'クロージングのタイミングを見極める（お客様の前のめりサインを見逃さない）',
    '「いつ工事が来てほしいですか？」と工事日から話を進める',
    '書類記入はお客様と一緒にスムーズに進める練習をする',
    'ためらいがあるお客様には「今日決めなくていい」と言って逆に安心させる',
  ],
};

const BENCHMARKS = { meet: 30, main: 50, negotiation: 40, contract: 30 };

type FunnelRates = {
  visits: number; netMeet: number; mainMeet: number; negotiation: number; acquired: number;
  meetRate: number; mainRate: number; negRate: number; contractRate: number; totalRate: number;
};

function deriveFunnelRates(m: {
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
  if (rate >= bench * 0.6) return 'text-yellow-600';
  return 'text-red-500';
}

function barColor(rate: number, bench: number) {
  if (rate >= bench) return 'bg-green-500';
  if (rate >= bench * 0.6) return 'bg-yellow-400';
  return 'bg-red-500';
}

const RANK_STYLE = [
  'bg-yellow-400 text-white',
  'bg-gray-300 text-gray-700',
  'bg-orange-300 text-white',
];

export default function ConversionPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Record<string, unknown>[]>([]);
  const [members, setMembers] = useState(loadMembers());
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('month');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMember, setSelectedMember] = useState('all');
  const [openTip, setOpenTip] = useState<string | null>(null);
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
  const memberStats: MemberStats[] = members.map(m => calcMemberStats(periodReports, m, period));

  const viewStats = selectedMember === 'all'
    ? memberStats
    : memberStats.filter(m => m.name === selectedMember);

  const aggFunnel = deriveFunnelRates({
    visits:      viewStats.reduce((s, m) => s + m.visits, 0),
    netMeet:     viewStats.reduce((s, m) => s + m.netMeet, 0),
    mainMeet:    viewStats.reduce((s, m) => s + m.mainMeet, 0),
    negotiation: viewStats.reduce((s, m) => s + m.negotiation, 0),
    acquired:    viewStats.reduce((s, m) => s + m.acquired, 0),
  });

  const funnelSteps: {
    key: string; label: string; value: number; rate: number; rateLabel: string; bench: number | null;
  }[] = [
    { key: 'visit',       label: '訪問数',   value: aggFunnel.visits,      rate: 100,                    rateLabel: '起点',                                    bench: null },
    { key: 'meet',        label: '対面数',   value: aggFunnel.netMeet,     rate: aggFunnel.meetRate,     rateLabel: `訪問→対面 ${aggFunnel.meetRate}%`,         bench: BENCHMARKS.meet },
    { key: 'main',        label: '主権対面', value: aggFunnel.mainMeet,    rate: aggFunnel.mainRate,     rateLabel: `対面→主権 ${aggFunnel.mainRate}%`,         bench: BENCHMARKS.main },
    { key: 'negotiation', label: '商談数',   value: aggFunnel.negotiation, rate: aggFunnel.negRate,      rateLabel: `主権→商談 ${aggFunnel.negRate}%`,          bench: BENCHMARKS.negotiation },
    { key: 'contract',    label: '契約数',   value: aggFunnel.acquired,    rate: aggFunnel.contractRate, rateLabel: `商談→契約 ${aggFunnel.contractRate}%`,     bench: BENCHMARKS.contract },
  ];

  const bottleneck = funnelSteps.slice(1).reduce<{
    key: string; label: string; rateLabel: string; score: number;
  } | null>((worst, step) => {
    if (step.bench == null) return worst;
    const score = step.rate / step.bench;
    if (!worst || score < worst.score) return { key: step.key, label: step.label, rateLabel: step.rateLabel, score };
    return worst;
  }, null);

  const maxVal = Math.max(aggFunnel.visits, 1);

  const topPerformers = memberStats
    .map(m => ({ name: m.name, rates: deriveFunnelRates(m), acquired: m.acquired }))
    .filter(m => m.acquired > 0)
    .sort((a, b) => b.rates.totalRate - a.rates.totalRate)
    .slice(0, 3);

  const periodLabel = period === 'month' ? '今月' : period === 'week' ? '今週' : period.replace('-', '/');

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3">
        <div className="font-bold text-blue-400">転換率分析</div>
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

        {/* Member selector */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelectedMember('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium active:scale-95 transition-all duration-150 select-none
                ${selectedMember === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
              チーム全体
            </button>
            {members.map(m => (
              <button key={m.id} onClick={() => setSelectedMember(m.name)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium active:scale-95 transition-all duration-150 select-none
                  ${selectedMember === m.name ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
          </div>
        ) : (
          <>
            {/* Total conversion rate */}
            <div className="bg-gray-900 text-white rounded-2xl p-5 shadow-sm">
              <div className="text-xs text-gray-400 mb-1">総転換率（訪問→契約）</div>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold text-blue-400">{aggFunnel.totalRate.toFixed(2)}</span>
                <span className="text-lg text-blue-400 mb-1">%</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">{aggFunnel.visits}訪問 → {aggFunnel.acquired}契約</div>
            </div>

            {/* Top performers */}
            {topPerformers.length > 0 && selectedMember === 'all' && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="font-bold text-gray-800 mb-3">🏆 転換率トップ3</div>
                <div className="space-y-3">
                  {topPerformers.map((m, i) => (
                    <button key={m.name} onClick={() => setSelectedMember(m.name)}
                      className="w-full flex items-center gap-3 active:opacity-60 transition-opacity text-left">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${RANK_STYLE[i]}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900 text-sm">{m.name}</span>
                          <span className="text-sm font-bold text-blue-600">{m.rates.totalRate.toFixed(2)}%</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          対面{m.rates.meetRate}% · 主権{m.rates.mainRate}% · 商談{m.rates.negRate}% · 契約{m.rates.contractRate}%
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-3 pt-2 border-t text-center">タップでファネルに反映</div>
              </div>
            )}

            {/* Funnel */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-4">📊 転換率ファネル</div>
              {bottleneck && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <div className="text-sm font-bold text-red-700">⚠️ ボトルネック：{bottleneck.label}</div>
                  <div className="text-xs text-red-500 mt-1">{bottleneck.rateLabel} — ここが最も改善余地があります</div>
                </div>
              )}
              <div className="space-y-3">
                {funnelSteps.map((step, i) => (
                  <div key={step.key}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{step.label}</span>
                        <span className="text-lg font-bold text-gray-900">{step.value}</span>
                      </div>
                      {step.bench != null ? (
                        <button onClick={() => setOpenTip(openTip === step.key ? null : step.key)}
                          className={`text-xs px-2 py-1 rounded-full font-bold bg-gray-100 ${rateColor(step.rate, step.bench)}`}>
                          {step.rateLabel} {openTip === step.key ? '▲' : '▼'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">起点</span>
                      )}
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-6">
                      <div
                        className={`${step.bench != null ? barColor(step.rate, step.bench) : 'bg-blue-500'} h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-300`}
                        style={{ width: `${Math.max(step.value / maxVal * 100, step.value > 0 ? 4 : 0)}%` }}>
                        {step.value > 0 && <span className="text-white text-xs font-bold">{step.value}</span>}
                      </div>
                    </div>
                    {openTip === step.key && (
                      <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                        <div className="text-xs font-bold text-yellow-800 mb-2">💡 改善策</div>
                        <ul className="space-y-1">
                          {TIPS[step.key].map((tip, j) => (
                            <li key={j} className="text-xs text-yellow-900 flex items-start gap-1">
                              <span className="text-yellow-500 shrink-0">•</span>{tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {i < funnelSteps.length - 1 && (
                      <div className="text-center text-gray-300 text-sm mt-1">↓</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Member comparison table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="font-bold text-gray-800 p-4 border-b">👥 メンバー別転換率</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800 text-white">
                    <tr>
                      {['氏名', '訪問', '対面率', '主権率', '商談率', '契約率', '総転換'].map(h => (
                        <th key={h} className="px-2 py-2 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {memberStats.map((m, i) => {
                      const f = deriveFunnelRates(m);
                      return (
                        <tr key={m.name}
                          className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} cursor-pointer active:bg-blue-50 transition-colors`}
                          onClick={() => setSelectedMember(m.name === selectedMember ? 'all' : m.name)}>
                          <td className={`px-2 py-2.5 font-bold ${selectedMember === m.name ? 'text-blue-600' : 'text-gray-900'}`}>{m.name}</td>
                          <td className="px-2 py-2.5 text-gray-600">{m.visits}</td>
                          <td className={`px-2 py-2.5 font-bold ${rateColor(f.meetRate, BENCHMARKS.meet)}`}>{f.meetRate}%</td>
                          <td className={`px-2 py-2.5 font-bold ${rateColor(f.mainRate, BENCHMARKS.main)}`}>{f.mainRate}%</td>
                          <td className={`px-2 py-2.5 font-bold ${rateColor(f.negRate, BENCHMARKS.negotiation)}`}>{f.negRate}%</td>
                          <td className={`px-2 py-2.5 font-bold ${rateColor(f.contractRate, BENCHMARKS.contract)}`}>{f.contractRate}%</td>
                          <td className="px-2 py-2.5 font-bold text-blue-600">{f.totalRate.toFixed(2)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-gray-50 text-xs text-gray-500">
                ※ 行をタップするとファネルに反映されます
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
