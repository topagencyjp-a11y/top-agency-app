'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBERS } from '@/lib/members';
import { getReports } from '@/lib/api';

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

function getRateColor(rate: number, benchmark: number) {
  if (rate >= benchmark) return 'text-green-600';
  if (rate >= benchmark * 0.6) return 'text-yellow-600';
  return 'text-red-500';
}

function getBarColor(rate: number, benchmark: number) {
  if (rate >= benchmark) return 'bg-green-500';
  if (rate >= benchmark * 0.6) return 'bg-yellow-500';
  return 'bg-red-500';
}

// 業界標準ベンチマーク（参考値）
const BENCHMARKS = { meet: 30, main: 50, negotiation: 40, contract: 30 };

export default function ConversionPage() {
  const router = useRouter();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState('all');
  const [openTip, setOpenTip] = useState<string | null>(null);
  const thisMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    const stored = localStorage.getItem('reports');
    if (stored) setReports(JSON.parse(stored));
    getReports().then(data => { setReports(data); localStorage.setItem('reports', JSON.stringify(data)); }).finally(() => setLoading(false));
  }, []);

  const calcStats = (name: string | null) => {
    const filtered = reports.filter(r => r.date?.startsWith(thisMonth) && (name === null || r.name === name));
    const visits = filtered.reduce((s, r) => s + (Number(r.visits) || 0), 0);
    const netMeet = filtered.reduce((s, r) => s + (Number(r.netMeet) || 0), 0);
    const mainMeet = filtered.reduce((s, r) => s + (Number(r.mainMeet) || 0), 0);
    const negotiation = filtered.reduce((s, r) => s + (Number(r.negotiation) || 0), 0);
    const acquired = filtered.reduce((s, r) => s + (Number(r.acquired) || 0), 0);
    const meetRate = visits > 0 ? Math.round(netMeet / visits * 100) : 0;
    const mainRate = netMeet > 0 ? Math.round(mainMeet / netMeet * 100) : 0;
    const negRate = mainMeet > 0 ? Math.round(negotiation / mainMeet * 100) : 0;
    const contractRate = negotiation > 0 ? Math.round(acquired / negotiation * 100) : 0;
    const totalRate = visits > 0 ? (acquired / visits * 100).toFixed(2) : '0.00';
    return { visits, netMeet, mainMeet, negotiation, acquired, meetRate, mainRate, negRate, contractRate, totalRate };
  };

  const allMemberStats = MEMBERS.map(m => ({ name: m.name, id: m.id, ...calcStats(m.name) }));
  const selectedStats = selectedMember === 'all' ? calcStats(null) : calcStats(selectedMember);

  const funnelSteps = [
    { key: 'visit', label: '訪問数', value: selectedStats.visits, rate: 100, rateLabel: '起点', color: 'bg-blue-500', bench: null },
    { key: 'meet', label: '対面数', value: selectedStats.netMeet, rate: selectedStats.meetRate, rateLabel: `訪問→対面 ${selectedStats.meetRate}%`, color: getBarColor(selectedStats.meetRate, BENCHMARKS.meet), bench: BENCHMARKS.meet },
    { key: 'main', label: '主権対面', value: selectedStats.mainMeet, rate: selectedStats.mainRate, rateLabel: `対面→主権 ${selectedStats.mainRate}%`, color: getBarColor(selectedStats.mainRate, BENCHMARKS.main), bench: BENCHMARKS.main },
    { key: 'negotiation', label: '商談数', value: selectedStats.negotiation, rate: selectedStats.negRate, rateLabel: `主権→商談 ${selectedStats.negRate}%`, color: getBarColor(selectedStats.negRate, BENCHMARKS.negotiation), bench: BENCHMARKS.negotiation },
    { key: 'contract', label: '契約数', value: selectedStats.acquired, rate: selectedStats.contractRate, rateLabel: `商談→契約 ${selectedStats.contractRate}%`, color: getBarColor(selectedStats.contractRate, BENCHMARKS.contract), bench: BENCHMARKS.contract },
  ];

  const bottleneck = funnelSteps.slice(1).reduce((worst, step) => {
    if (!step.bench) return worst;
    const score = step.rate / step.bench;
    if (!worst || score < worst.score) return { key: step.key, score, label: step.label, rateLabel: step.rateLabel };
    return worst;
  }, null as any);

  const maxVal = Math.max(selectedStats.visits, 1);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white text-sm">← 戻る</button>
        <div className="font-bold text-blue-400">転換率分析</div>
        <span className="text-sm bg-gray-700 px-2 py-1 rounded">{thisMonth.replace('-', '/')}</span>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {/* メンバー選択 */}
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelectedMember('all')}
              className={`px-3 py-1 rounded-full text-sm font-medium ${selectedMember === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
              チーム全体
            </button>
            {MEMBERS.map(m => (
              <button key={m.id} onClick={() => setSelectedMember(m.name)}
                className={`px-3 py-1 rounded-full text-sm font-medium ${selectedMember === m.name ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* 総転換率 */}
        <div className="bg-gray-900 text-white rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">総転換率（訪問→契約）</div>
          <div className="text-4xl font-bold text-blue-400">{selectedStats.totalRate}<span className="text-lg ml-1">%</span></div>
          <div className="text-xs text-gray-400 mt-1">{selectedStats.visits}訪問 → {selectedStats.acquired}契約</div>
        </div>

        {/* ファネル */}
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="font-bold text-gray-800 mb-4">📊 転換率ファネル</div>
          {bottleneck && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
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
                  {step.bench && (
                    <button onClick={() => setOpenTip(openTip === step.key ? null : step.key)}
                      className={`text-xs px-2 py-1 rounded-full font-bold ${getRateColor(step.rate, step.bench)} bg-gray-100`}>
                      {step.rateLabel} {openTip === step.key ? '▲' : '▼'}
                    </button>
                  )}
                  {!step.bench && <span className="text-xs text-gray-400">起点</span>}
                </div>
                <div className="w-full bg-gray-100 rounded-full h-6">
                  <div className={`${step.color} h-6 rounded-full flex items-center justify-end pr-2 transition-all`}
                    style={{ width: `${Math.max(step.value / maxVal * 100, step.value > 0 ? 4 : 0)}%` }}>
                    {step.value > 0 && <span className="text-white text-xs font-bold">{step.value}</span>}
                  </div>
                </div>
                {/* 改善ヒント */}
                {openTip === step.key && (
                  <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
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

        {/* メンバー別転換率一覧 */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
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
                {allMemberStats.map((m, i) => (
                  <tr key={m.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} cursor-pointer hover:bg-blue-50`}
                    onClick={() => setSelectedMember(m.name === selectedMember ? 'all' : m.name)}>
                    <td className="px-2 py-2 font-bold text-gray-900">{m.name}</td>
                    <td className="px-2 py-2 text-gray-600">{m.visits}</td>
                    <td className={`px-2 py-2 font-bold ${getRateColor(m.meetRate, BENCHMARKS.meet)}`}>{m.meetRate}%</td>
                    <td className={`px-2 py-2 font-bold ${getRateColor(m.mainRate, BENCHMARKS.main)}`}>{m.mainRate}%</td>
                    <td className={`px-2 py-2 font-bold ${getRateColor(m.negRate, BENCHMARKS.negotiation)}`}>{m.negRate}%</td>
                    <td className={`px-2 py-2 font-bold ${getRateColor(m.contractRate, BENCHMARKS.contract)}`}>{m.contractRate}%</td>
                    <td className="px-2 py-2 font-bold text-blue-600">{m.totalRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-gray-50 text-xs text-gray-500">
            ※ 行をタップするとファネルに反映されます
          </div>
        </div>

      </div>
    </div>
  );
}
