'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBERS, TEAM_TARGET, UNIT_PRICE, OPEN_RATE } from '@/lib/members';

type Tab = 'input' | 'status' | 'analysis' | 'overall' | 'contracts';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('input');
  const [reports, setReports] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  // 日次入力フォーム
  const [form, setForm] = useState({
    visits: 0, netMeet: 0, mainMeet: 0, negotiation: 0, acquired: 0,
    startTime: '', endTime: '',
    acquiredCase: '', lostCase: '', memo: '',
    goodPoints: '', issues: '', improvements: '', learnings: '',
    planDays: 20, workedDays: 0,
  });

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    setUser(JSON.parse(u));
    loadData();
  }, []);

  const loadData = async () => {
    const stored = localStorage.getItem('reports');
    if (stored) setReports(JSON.parse(stored));
    const monthly = localStorage.getItem('monthlyData');
    if (monthly) setMonthlyData(JSON.parse(monthly));
  };

  const saveReport = () => {
    const today = new Date().toISOString().split('T')[0];
    const report = { ...form, date: today, name: user?.name, savedAt: new Date().toISOString() };
    const updated = [...reports.filter(r => !(r.date === today && r.name === user?.name)), report];
    setReports(updated);
    localStorage.setItem('reports', JSON.stringify(updated));
    alert('保存しました！');
  };

  const thisMonth = new Date().toISOString().slice(0, 7);
  const myReports = reports.filter(r => r.name === user?.name && r.date?.startsWith(thisMonth));
  const myAcquired = myReports.reduce((s, r) => s + (r.acquired || 0), 0);
  const myMember = MEMBERS.find(m => m.name === user?.name);
  const myTarget = myMember?.target || 0;
  const myRate = myTarget > 0 ? Math.round(myAcquired / myTarget * 100) : 0;
  const workedDays = myReports.filter(r => r.visits > 0).length;
  const productivity = workedDays > 0 ? (myAcquired / workedDays).toFixed(2) : '0.00';
  const remainDays = (form.planDays || 20) - workedDays;
  const forecast = Math.round(Number(productivity) * (workedDays + remainDays));

  // チーム集計
  const teamAcquired = MEMBERS.map(m => {
    const mReports = reports.filter(r => r.name === m.name && r.date?.startsWith(thisMonth));
    const acquired = mReports.reduce((s, r) => s + (r.acquired || 0), 0);
    const worked = mReports.filter(r => r.visits > 0).length;
    const prod = worked > 0 ? acquired / worked : 0;
    return { ...m, acquired, worked, productivity: prod.toFixed(2) };
  }).sort((a, b) => b.acquired - a.acquired);

  const totalAcquired = teamAcquired.reduce((s, m) => s + m.acquired, 0);
  const teamRate = Math.round(totalAcquired / TEAM_TARGET * 100);
  const estimatedSales = Math.round(totalAcquired * UNIT_PRICE * OPEN_RATE);

  const tabs = [
    { id: 'input', label: '✏️ 入力' },
    { id: 'status', label: '📊 現状整理' },
    { id: 'analysis', label: '📈 分析' },
    { id: 'overall', label: '🏆 全体' },
    { id: 'contracts', label: '🏠 契約宅' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-bold text-blue-400">TOP</div>
          <select className="bg-gray-700 text-white text-sm rounded px-2 py-1">
            <option>{thisMonth.replace('-', '/')}</option>
          </select>
          {user && <span className="text-sm">{user.name}</span>}
        </div>
        <button onClick={() => { localStorage.clear(); router.push('/login'); }}
          className="text-gray-400 text-sm">ログアウト</button>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900 flex overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className={`px-4 py-3 text-sm whitespace-nowrap transition ${tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-2xl mx-auto">

        {/* 入力タブ */}
        {tab === 'input' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-700 mb-3">📅 {new Date().toLocaleDateString('ja-JP')} — {user?.name}</div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500">開始時刻</label>
                  <input type="time" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})}
                    className="w-full border rounded px-3 py-2 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">終了時刻</label>
                  <input type="time" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})}
                    className="w-full border rounded px-3 py-2 text-sm mt-1" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-700 mb-3">📊 行動量</div>
              {[
                { key: 'visits', label: '訪問', color: 'bg-blue-500' },
                { key: 'netMeet', label: 'ネット対面', color: 'bg-purple-500' },
                { key: 'mainMeet', label: '主権対面', color: 'bg-indigo-500' },
                { key: 'negotiation', label: '商談', color: 'bg-orange-500' },
                { key: 'acquired', label: '獲得', color: 'bg-green-500' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setForm({...form, [item.key]: Math.max(0, (form as any)[item.key] - 1)})}
                      className="w-8 h-8 bg-gray-200 rounded-full text-gray-600 font-bold">−</button>
                    <span className="w-8 text-center font-bold text-lg">{(form as any)[item.key]}</span>
                    <button onClick={() => setForm({...form, [item.key]: (form as any)[item.key] + 1})}
                      className={`w-8 h-8 ${item.color} rounded-full text-white font-bold`}>＋</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-700 mb-3">📝 日報</div>
              {[
                { key: 'acquiredCase', label: '🏆 獲得案件', placeholder: 'どういったお客さんか・角度感・フック' },
                { key: 'lostCase', label: '😅 失注案件', placeholder: '失注案件の詳細（なければ「なし」）' },
                { key: 'goodPoints', label: '✅ よかった点', placeholder: '今日のよかった点を具体的に' },
                { key: 'issues', label: '❌ 課題・失敗', placeholder: '課題や失敗を正直に振り返る' },
                { key: 'improvements', label: '📌 明日の改善ポイント', placeholder: '明日に活かす具体的な改善点' },
                { key: 'learnings', label: '💡 学び・気づき', placeholder: '今日の学び・気づき・新発見' },
              ].map(item => (
                <div key={item.key} className="mb-3">
                  <label className="text-xs text-gray-500 font-bold">{item.label}</label>
                  <textarea value={(form as any)[item.key]} onChange={e => setForm({...form, [item.key]: e.target.value})}
                    placeholder={item.placeholder}
                    className="w-full border rounded px-3 py-2 text-sm mt-1 h-16 resize-none" />
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-700 mb-3">📅 稼働計画</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">計画稼働日数</label>
                  <input type="number" value={form.planDays} onChange={e => setForm({...form, planDays: +e.target.value})}
                    className="w-full border rounded px-3 py-2 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">実稼働日数（自動）</label>
                  <input type="number" value={workedDays} readOnly className="w-full border rounded px-3 py-2 text-sm mt-1 bg-gray-50" />
                </div>
              </div>
            </div>

            <button onClick={saveReport}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow text-lg">
              💾 保存する
            </button>
          </div>
        )}

        {/* 現状整理タブ */}
        {tab === 'status' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xl font-bold">{user?.name}</div>
                  <div className="text-gray-500 text-sm">{thisMonth.replace('-','/')}月</div>
                </div>
                {myRate < 100 && (
                  <div className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                    未達予測 -{myTarget - forecast}件
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {[
                  { label: '月間目標', value: `${myTarget}件` },
                  { label: '実績（獲得件数）', value: `${myAcquired}件`, color: 'text-blue-600' },
                  { label: '計画稼働日数', value: `${form.planDays}日` },
                  { label: '実稼働日数', value: `${workedDays}日` },
                  { label: '残稼働日数', value: `${remainDays}日`, color: remainDays <= 5 ? 'text-red-500' : '' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center py-2 border-b last:border-0">
                    <span className="text-gray-600 text-sm">{item.label}</span>
                    <span className={`font-bold ${item.color || ''}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-700 mb-3">⚡ 生産性</div>
              <div className="text-xs text-gray-500 mb-2">生産性 = 実績 ÷ 実稼働日数</div>
              <div className="text-3xl font-bold text-blue-600">{productivity} <span className="text-base text-gray-500">件/日</span></div>
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-700 font-bold">着地予測: {forecast}件</div>
                <div className="text-xs text-blue-500 mt-1">{productivity} × {workedDays + remainDays}日 = {forecast}件</div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-700 mb-3">達成率</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-200 rounded-full h-4">
                  <div className={`h-4 rounded-full ${myRate >= 80 ? 'bg-green-500' : myRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(myRate, 100)}%` }} />
                </div>
                <span className="font-bold text-lg">{myRate}%</span>
              </div>
            </div>
          </div>
        )}

        {/* 分析タブ */}
        {tab === 'analysis' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-700 mb-3">📊 月間サマリー — {user?.name}</div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: '生産性', value: productivity },
                  { label: '実稼働', value: `${workedDays}日` },
                  { label: '残稼働', value: `${remainDays}日` },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">{item.label}</div>
                    <div className="font-bold text-lg text-blue-600">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-700 mb-3">📈 行動量合計</div>
              {[
                { key: 'visits', label: '訪問' },
                { key: 'netMeet', label: 'ネット対面' },
                { key: 'mainMeet', label: '主権対面' },
                { key: 'negotiation', label: '商談' },
                { key: 'acquired', label: '獲得' },
              ].map(item => {
                const total = myReports.reduce((s, r) => s + (r[item.key] || 0), 0);
                const avg = workedDays > 0 ? (total / workedDays).toFixed(1) : '0.0';
                return (
                  <div key={item.key} className="flex justify-between items-center py-2 border-b last:border-0">
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <div className="text-right">
                      <span className="font-bold">{total}</span>
                      <span className="text-xs text-gray-400 ml-2">({avg}/日)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 全体タブ */}
        {tab === 'overall' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900 text-white rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">チーム着地予測</div>
                <div className="text-3xl font-bold text-blue-400">{totalAcquired}</div>
                <div className="text-xs text-gray-400">目標 {TEAM_TARGET}件</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow">
                <div className="text-xs text-gray-500 mb-1">想定売上</div>
                <div className="text-xl font-bold text-green-600">¥{estimatedSales.toLocaleString()}</div>
                <div className="text-xs text-gray-400">開通率{Math.round(OPEN_RATE*100)}%</div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-700 mb-3">🏆 獲得件数ランキング</div>
              {teamAcquired.map((m, i) => (
                <div key={m.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-600' : 'bg-blue-500'}`}>{i+1}</div>
                  <div className="flex-1">
                    <div className="text-sm font-bold">{m.name}</div>
                    <div className="bg-gray-200 rounded-full h-2 mt-1">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${teamAcquired[0].acquired > 0 ? m.acquired / teamAcquired[0].acquired * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="font-bold text-blue-600">{m.acquired}件</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl p-4 shadow overflow-x-auto">
              <div className="font-bold text-gray-700 mb-3">📋 メンバー詳細</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    {['担当者','着地予測','目標','現在','実稼働','残稼働','生産性','達成率'].map(h => (
                      <th key={h} className="px-2 py-2 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamAcquired.map((m, i) => {
                    const rate = m.target > 0 ? Math.round(m.acquired / m.target * 100) : 0;
                    const remain = 20 - m.worked;
                    const fc = Math.round(Number(m.productivity) * (m.worked + remain));
                    return (
                      <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-2 font-bold">{m.name}</td>
                        <td className="px-2 py-2 text-orange-500 font-bold">{fc}</td>
                        <td className="px-2 py-2">{m.target}</td>
                        <td className="px-2 py-2 text-blue-600 font-bold">{m.acquired}</td>
                        <td className="px-2 py-2">{m.worked}日</td>
                        <td className="px-2 py-2 text-red-500">{remain}日</td>
                        <td className="px-2 py-2">{m.productivity}</td>
                        <td className="px-2 py-2">
                          <span className={`font-bold ${rate >= 80 ? 'text-green-600' : rate >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{rate}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 契約宅タブ */}
        {tab === 'contracts' && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="font-bold text-red-700 mb-2">📞 工事日電話が必要</div>
              <div className="text-xs text-red-500 mb-3">獲得日から3日以上経過・工事日未定のお客様</div>
              {reports
                .filter(r => r.name === user?.name && r.acquired > 0)
                .filter(r => {
                  const days = Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000);
                  return days >= 3;
                })
                .map((r, i) => (
                  <div key={i} className="bg-white rounded-lg p-3 mb-2 border border-red-100">
                    <div className="font-bold text-sm">{r.acquiredCase || '案件詳細なし'}</div>
                    <div className="text-xs text-gray-500 mt-1">獲得: {r.date} ({Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000)}日経過)</div>
                  </div>
                ))}
            </div>

            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-700 mb-3">📋 全獲得案件</div>
              {reports
                .filter(r => r.name === user?.name && r.acquired > 0)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((r, i) => (
                  <div key={i} className="py-3 border-b last:border-0">
                    <div className="flex justify-between items-start">
                      <div className="text-sm font-bold">{r.acquiredCase || '案件詳細なし'}</div>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">手続き中</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">獲得: {r.date}</div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
