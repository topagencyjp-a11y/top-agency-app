'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBERS } from '@/lib/members';
import { getReports } from '@/lib/api';

export default function StatsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState('all');
  const thisMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    setUser(JSON.parse(u));
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await getReports();
      setReports(data);
      localStorage.setItem('reports', JSON.stringify(data));
    } catch {
      const stored = localStorage.getItem('reports');
      if (stored) setReports(JSON.parse(stored));
    } finally {
      setLoading(false);
    }
  };

  const getMemberStats = (name: string) => {
    const mReports = reports.filter(r => r.name === name && r.date?.startsWith(thisMonth));
    const acquired = mReports.reduce((s, r) => s + (Number(r.acquired) || 0), 0);
    const worked = mReports.filter(r => Number(r.visits) > 0).length;
    const visits = mReports.reduce((s, r) => s + (Number(r.visits) || 0), 0);
    const netMeet = mReports.reduce((s, r) => s + (Number(r.netMeet) || 0), 0);
    const mainMeet = mReports.reduce((s, r) => s + (Number(r.mainMeet) || 0), 0);
    const negotiation = mReports.reduce((s, r) => s + (Number(r.negotiation) || 0), 0);
    const member = MEMBERS.find(m => m.name === name);
    const target = member?.target || 0;
    const prod = worked > 0 ? acquired / worked : 0;
    const remain = 20 - worked;
    const forecast = Math.round(prod * (worked + Math.max(remain, 0)));
    const rate = target > 0 ? Math.round(acquired / target * 100) : 0;
    const meetRate = visits > 0 ? Math.round(netMeet / visits * 100) : 0;
    const getRate = netMeet > 0 ? Math.round(acquired / netMeet * 100) : 0;
    const negRate = mainMeet > 0 ? Math.round(negotiation / mainMeet * 100) : 0;
    return { acquired, worked, visits, netMeet, mainMeet, negotiation, prod: prod.toFixed(2), target, remain: Math.max(remain, 0), forecast, rate, meetRate, getRate, negRate };
  };

  const allStats = MEMBERS.map(m => ({ name: m.name, role: m.role, id: m.id, ...getMemberStats(m.name) }))
    .sort((a, b) => b.acquired - a.acquired);

  const totalAcquired = allStats.reduce((s, m) => s + m.acquired, 0);
  const totalVisits = allStats.reduce((s, m) => s + m.visits, 0);
  const totalNetMeet = allStats.reduce((s, m) => s + m.netMeet, 0);
  const totalMainMeet = allStats.reduce((s, m) => s + m.mainMeet, 0);
  const totalNegotiation = allStats.reduce((s, m) => s + m.negotiation, 0);
  const TEAM_TARGET = MEMBERS.reduce((s, m) => s + m.target, 0);
  const teamRate = Math.round(totalAcquired / TEAM_TARGET * 100);
  const teamMeetRate = totalVisits > 0 ? Math.round(totalNetMeet / totalVisits * 100) : 0;
  const teamGetRate = totalNetMeet > 0 ? Math.round(totalAcquired / totalNetMeet * 100) : 0;

  const selected = selectedMember === 'all' ? null : allStats.find(m => m.name === selectedMember);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white text-sm">← 戻る</button>
          <div className="font-bold text-blue-400">数値管理</div>
          <span className="text-sm bg-gray-700 px-2 py-1 rounded">{thisMonth.replace('-', '/')}</span>
        </div>
        <button onClick={loadReports} className="text-xs text-gray-400 hover:text-white">🔄 更新</button>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-4">

        {/* チームKPI */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900 text-white rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">チーム獲得</div>
            <div className="text-3xl font-bold text-blue-400">{totalAcquired}</div>
            <div className="text-xs text-gray-400">目標 {TEAM_TARGET}件</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow">
            <div className="text-xs text-gray-500 mb-1 font-medium">達成率</div>
            <div className={`text-2xl font-bold ${teamRate >= 80 ? 'text-green-600' : teamRate >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{teamRate}%</div>
            <div className="text-xs text-gray-400">残り{TEAM_TARGET - totalAcquired}件</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow">
            <div className="text-xs text-gray-500 mb-1 font-medium">対面率</div>
            <div className="text-2xl font-bold text-purple-600">{teamMeetRate}%</div>
            <div className="text-xs text-gray-400">獲得率 {teamGetRate}%</div>
          </div>
        </div>

        {/* チーム行動量合計 */}
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="font-bold text-gray-800 mb-3">📊 チーム行動量合計</div>
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { label: '訪問数', val: totalVisits, color: 'bg-blue-50 text-blue-700' },
              { label: '対面数', val: totalNetMeet, color: 'bg-purple-50 text-purple-700' },
              { label: '主権対面', val: totalMainMeet, color: 'bg-indigo-50 text-indigo-700' },
              { label: '商談', val: totalNegotiation, color: 'bg-orange-50 text-orange-700' },
              { label: '獲得数', val: totalAcquired, color: 'bg-green-50 text-green-700' },
            ].map(item => (
              <div key={item.label} className={`${item.color} rounded-lg p-3`}>
                <div className="text-xs font-medium">{item.label}</div>
                <div className="font-bold text-xl">{item.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* メンバー選択 */}
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="font-bold text-gray-800 mb-3">メンバーを選択</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelectedMember('all')}
              className={`px-3 py-1 rounded-full text-sm font-medium ${selectedMember === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
              全員
            </button>
            {MEMBERS.map(m => (
              <button key={m.id} onClick={() => setSelectedMember(m.name)}
                className={`px-3 py-1 rounded-full text-sm font-medium ${selectedMember === m.name ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* 個人詳細 */}
        {selected && (
          <div className="bg-white rounded-xl p-4 shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xl font-bold text-gray-900">{selected.name}</div>
                <div className="text-sm text-gray-500">{selected.role === 'closer' ? 'クローザー' : 'アポインター'}</div>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-bold ${selected.rate >= 80 ? 'bg-green-100 text-green-700' : selected.rate >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                {selected.rate}%
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: '目標', value: `${selected.target}件` },
                { label: '現在', value: `${selected.acquired}件`, color: 'text-blue-600' },
                { label: '着地予測', value: `${selected.forecast}件`, color: 'text-orange-500' },
                { label: '生産性', value: `${selected.prod}件/日` },
                { label: '実稼働', value: `${selected.worked}日` },
                { label: '残稼働', value: `${selected.remain}日`, color: selected.remain <= 5 ? 'text-red-500' : '' },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">{item.label}</div>
                  <div className={`font-bold text-lg ${item.color || 'text-gray-900'}`}>{item.value}</div>
                </div>
              ))}
            </div>

            <div className="border-t pt-3">
              <div className="font-bold text-gray-700 text-sm mb-2">行動量・各種率</div>
              {[
                { label: '訪問数', value: selected.visits },
                { label: '対面数', value: selected.netMeet },
                { label: '主権対面', value: selected.mainMeet },
                { label: '商談', value: selected.negotiation },
                { label: '獲得数', value: selected.acquired },
                { label: '対面率（訪問→対面）', value: `${selected.meetRate}%` },
                { label: '主権→商談率', value: `${selected.negRate}%` },
                { label: '獲得率（対面→獲得）', value: `${selected.getRate}%` },
              ].map(item => (
                <div key={item.label} className="flex justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="font-bold text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 全体ランキングテーブル */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="font-bold text-gray-800 p-4 border-b">📋 メンバー別数値一覧</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-white">
                <tr>
                  {['氏名', '目標', '現在', '達成率', '着地', '生産性', '実稼働', '対面率', '獲得率'].map(h => (
                    <th key={h} className="px-2 py-2 text-left text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allStats.map((m, i) => (
                  <tr key={m.name}
                    className={`border-b cursor-pointer hover:bg-blue-50 ${selectedMember === m.name ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    onClick={() => setSelectedMember(m.name === selectedMember ? 'all' : m.name)}>
                    <td className="px-2 py-2 font-bold text-gray-900">{m.name}</td>
                    <td className="px-2 py-2 text-gray-700">{m.target}</td>
                    <td className="px-2 py-2 font-bold text-blue-600">{m.acquired}</td>
                    <td className="px-2 py-2">
                      <span className={`font-bold ${m.rate >= 80 ? 'text-green-600' : m.rate >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{m.rate}%</span>
                    </td>
                    <td className="px-2 py-2 text-orange-500 font-bold">{m.forecast}</td>
                    <td className="px-2 py-2 text-gray-700">{m.prod}</td>
                    <td className="px-2 py-2 text-gray-700">{m.worked}日</td>
                    <td className="px-2 py-2 text-purple-600">{m.meetRate}%</td>
                    <td className="px-2 py-2 text-green-600">{m.getRate}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-bold">
                <tr>
                  <td className="px-2 py-2 text-gray-900">合計</td>
                  <td className="px-2 py-2">{TEAM_TARGET}</td>
                  <td className="px-2 py-2 text-blue-600">{totalAcquired}</td>
                  <td className="px-2 py-2">{teamRate}%</td>
                  <td colSpan={3}></td>
                  <td className="px-2 py-2 text-purple-600">{teamMeetRate}%</td>
                  <td className="px-2 py-2 text-green-600">{teamGetRate}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
