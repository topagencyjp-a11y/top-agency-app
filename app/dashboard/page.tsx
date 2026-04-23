'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBERS, TEAM_TARGET } from '@/lib/members';
import { saveReport, getReports } from '@/lib/api';

type Tab = 'input' | 'status' | 'analysis' | 'overall' | 'contracts';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('input');
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState({
    visits: 0, netMeet: 0, mainMeet: 0, negotiation: 0, acquired: 0,
    startTime: '', endTime: '',
    acquiredCase: '', lostCase: '',
    goodPoints: '', issues: '', improvements: '', learnings: '',
    gratitude: '',
    planDays: 20,
  });

  const loadReports = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    setUser(JSON.parse(u));
    const stored = localStorage.getItem('reports');
    if (stored) setReports(JSON.parse(stored));
    loadReports();
  }, []);

  useEffect(() => {
    if (!user) return;
    const existing = reports.find(r => r.date === selectedDate && r.name === user.name);
    if (existing) {
      setForm({
        visits: Number(existing.visits) || 0,
        netMeet: Number(existing.netMeet) || 0,
        mainMeet: Number(existing.mainMeet) || 0,
        negotiation: Number(existing.negotiation) || 0,
        acquired: Number(existing.acquired) || 0,
        startTime: existing.startTime || '',
        endTime: existing.endTime || '',
        acquiredCase: existing.acquiredCase || '',
        lostCase: existing.lostCase || '',
        goodPoints: existing.goodPoints || '',
        issues: existing.issues || '',
        improvements: existing.improvements || '',
        learnings: existing.learnings || '',
        gratitude: existing.gratitude || '',
        planDays: Number(existing.planDays) || 20,
      });
    } else {
      setForm({
        visits: 0, netMeet: 0, mainMeet: 0, negotiation: 0, acquired: 0,
        startTime: '', endTime: '',
        acquiredCase: '', lostCase: '',
        goodPoints: '', issues: '', improvements: '', learnings: '',
        gratitude: '',
        planDays: 20,
      });
    }
  }, [selectedDate, user, reports]);

  const handleSave = async () => {
    setSaving(true);
    const report = { ...form, date: selectedDate, name: user?.name };
    try {
      await saveReport(report);
      await loadReports();
      alert('保存しました！');
    } catch {
      const updated = [...reports.filter(r => !(r.date === selectedDate && r.name === user?.name)), report];
      setReports(updated);
      localStorage.setItem('reports', JSON.stringify(updated));
      alert('保存しました！（オフライン）');
    } finally {
      setSaving(false);
    }
  };

  const copyReport = () => {
    const d = new Date(selectedDate);
    const dateStr = `${d.getMonth()+1}/${d.getDate()}（${['日','月','火','水','木','金','土'][d.getDay()]}）`;
    const lines = [
      `【${user?.name} 日報 ${dateStr}】`,
      ``,
      `■ 稼働時間`,
      `${form.startTime || '--:--'} 〜 ${form.endTime || '--:--'}`,
      ``,
      `■ 行動量`,
      `訪問数：${form.visits}　対面数：${form.netMeet}　主権対面：${form.mainMeet}　商談：${form.negotiation}　獲得数：${form.acquired}`,
      ``,
    ];
    if (form.acquiredCase) lines.push(`■ 獲得案件\n${form.acquiredCase}\n`);
    if (form.lostCase) lines.push(`■ 失注案件\n${form.lostCase}\n`);
    if (form.goodPoints) lines.push(`■ よかった点\n${form.goodPoints}\n`);
    if (form.issues) lines.push(`■ 課題・失敗\n${form.issues}\n`);
    if (form.improvements) lines.push(`■ 明日の改善ポイント\n${form.improvements}\n`);
    if (form.learnings) lines.push(`■ 学び・気づき\n${form.learnings}\n`);
    if (form.gratitude) lines.push(`■ 感謝・シェアしたいこと\n${form.gratitude}\n`);
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const thisMonth = new Date().toISOString().slice(0, 7);
  const myReports = reports.filter(r => r.name === user?.name && r.date?.startsWith(thisMonth));
  const myAcquired = myReports.reduce((s, r) => s + (Number(r.acquired) || 0), 0);
  const myMember = MEMBERS.find(m => m.name === user?.name);
  const myTarget = myMember?.target || 0;
  const myRate = myTarget > 0 ? Math.round(myAcquired / myTarget * 100) : 0;
  const workedDays = myReports.filter(r => Number(r.visits) > 0).length;
  const productivity = workedDays > 0 ? (myAcquired / workedDays).toFixed(2) : '0.00';
  const remainDays = (form.planDays || 20) - workedDays;
  const forecast = Math.round(Number(productivity) * (workedDays + remainDays));

  const teamAcquired = MEMBERS.map(m => {
    const mReports = reports.filter(r => r.name === m.name && r.date?.startsWith(thisMonth));
    const acquired = mReports.reduce((s, r) => s + (Number(r.acquired) || 0), 0);
    const worked = mReports.filter(r => Number(r.visits) > 0).length;
    const prod = worked > 0 ? acquired / worked : 0;
    return { ...m, acquired, worked, productivity: prod.toFixed(2) };
  }).sort((a, b) => b.acquired - a.acquired);

  const totalAcquired = teamAcquired.reduce((s, m) => s + m.acquired, 0);
  const estimatedSales = Math.round(totalAcquired * UNIT_PRICE * OPEN_RATE);

  const tabs = [
    { id: 'input', label: '✏️ 入力' },
    { id: 'status', label: '📊 現状整理' },
    { id: 'analysis', label: '📈 分析' },
    { id: 'overall', label: '🏆 全体' },
    { id: 'contracts', label: '🏠 契約宅' },
  ];

  const inputStyle = "w-full border border-gray-300 rounded px-3 py-2 text-sm mt-1 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const textareaStyle = "w-full border border-gray-300 rounded px-3 py-2 text-sm mt-1 h-20 resize-none text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth()+1}/${d.getDate()}（${['日','月','火','水','木','金','土'][d.getDay()]}）`;
  };

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const hasData = reports.some(r => r.date === selectedDate && r.name === user?.name);

  const actionItems = [
    { key: 'visits', label: '訪問数', color: 'bg-blue-500' },
    { key: 'netMeet', label: '対面数', color: 'bg-purple-500' },
    { key: 'mainMeet', label: '主権対面', color: 'bg-indigo-500' },
    { key: 'negotiation', label: '商談', color: 'bg-orange-500' },
    { key: 'acquired', label: '獲得数', color: 'bg-green-500' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-bold text-blue-400">TOP</div>
          <span className="text-sm bg-gray-700 px-2 py-1 rounded">{thisMonth.replace('-', '/')}</span>
          {user && <span className="text-sm text-gray-300">{user.name}</span>}
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-xs text-gray-400">同期中...</span>}
          <button onClick={() => { localStorage.clear(); router.push('/login'); }}
            className="text-gray-400 text-sm hover:text-white">ログアウト</button>
        </div>
      </div>

      <div className="bg-gray-900 flex overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className={`px-4 py-3 text-sm whitespace-nowrap transition ${tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {tab === 'input' && (
          <div className="space-y-4">
            {/* 日付選択 */}
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="flex items-center justify-between">
                <button onClick={() => changeDate(-1)} className="w-9 h-9 bg-gray-100 rounded-full text-gray-600 font-bold hover:bg-gray-200">‹</button>
                <div className="text-center">
                  <div className="flex items-center gap-2 justify-center">
                    <span className="font-bold text-gray-900 text-lg">{formatDate(selectedDate)}</span>
                    {isToday && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">今日</span>}
                    {hasData && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">入力済み</span>}
                  </div>
                  <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                    className="text-xs text-gray-400 mt-1 border-0 bg-transparent cursor-pointer" />
                </div>
                <button onClick={() => changeDate(1)} disabled={isToday}
                  className="w-9 h-9 bg-gray-100 rounded-full text-gray-600 font-bold hover:bg-gray-200 disabled:opacity-30">›</button>
              </div>
            </div>

            {/* 稼働時間 */}
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-800 mb-3">⏰ 稼働時間</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">開始時刻</label>
                  <input type="time" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} className={inputStyle} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">終了時刻</label>
                  <input type="time" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} className={inputStyle} />
                </div>
              </div>
            </div>

            {/* 行動量 */}
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-800 mb-3">📊 行動量</div>
              {actionItems.map(item => (
                <div key={item.key} className="flex items-center justify-between py-3 border-b last:border-0 gap-3">
                  <span className="text-sm font-medium text-gray-800 w-20 shrink-0">{item.label}</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <button onClick={() => setForm({...form, [item.key]: Math.max(0, (form as any)[item.key] - 1)})}
                      className="w-9 h-9 bg-gray-200 rounded-full text-gray-700 font-bold text-lg hover:bg-gray-300 shrink-0">−</button>
                    <input
                      type="number"
                      min="0"
                      value={(form as any)[item.key]}
                      onChange={e => setForm({...form, [item.key]: Math.max(0, parseInt(e.target.value) || 0)})}
                      className="w-16 text-center font-bold text-xl text-gray-900 border border-gray-300 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={() => setForm({...form, [item.key]: (form as any)[item.key] + 1})}
                      className={`w-9 h-9 ${item.color} rounded-full text-white font-bold text-lg hover:opacity-90 shrink-0`}>＋</button>
                  </div>
                </div>
              ))}
            </div>

            {/* 日報 */}
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-800 mb-3">📝 日報</div>
              {[
                { key: 'acquiredCase', label: '🏆 獲得案件', placeholder: 'どういったお客さんか・角度感・フックを詳しく' },
                { key: 'lostCase', label: '😅 失注案件', placeholder: '失注案件の詳細（なければ「なし」）' },
                { key: 'goodPoints', label: '✅ よかった点', placeholder: '今日のよかった点を具体的に' },
                { key: 'issues', label: '❌ 課題・失敗', placeholder: '課題や失敗を正直に振り返る' },
                { key: 'improvements', label: '📌 明日の改善ポイント', placeholder: '明日に活かす具体的な改善点' },
                { key: 'learnings', label: '💡 学び・気づき', placeholder: '今日の学び・気づき・新発見' },
                { key: 'gratitude', label: '🙏 感謝・シェアしたいこと（任意）', placeholder: 'チームへの感謝や共有したいこと' },
              ].map(item => (
                <div key={item.key} className="mb-4">
                  <label className="text-sm font-bold text-gray-700">{item.label}</label>
                  <textarea value={(form as any)[item.key]} onChange={e => setForm({...form, [item.key]: e.target.value})}
                    placeholder={item.placeholder} className={textareaStyle} />
                </div>
              ))}
            </div>

            {/* 稼働計画 */}
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-800 mb-3">📅 稼働計画</div>
              <div>
                <label className="text-sm font-medium text-gray-700">計画稼働日数</label>
                <input type="number" value={form.planDays} onChange={e => setForm({...form, planDays: +e.target.value})} className={inputStyle} />
              </div>
            </div>

            {/* ボタン */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={copyReport}
                className="bg-white border-2 border-blue-600 text-blue-600 font-bold py-4 rounded-xl text-sm hover:bg-blue-50">
                {copied ? '✅ コピーしました！' : '📋 日報をコピー'}
              </button>
              <button onClick={handleSave} disabled={saving}
                className="bg-blue-600 text-white font-bold py-4 rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? '保存中...' : '💾 保存する'}
              </button>
            </div>
          </div>
        )}

        {tab === 'status' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xl font-bold text-gray-900">{user?.name}</div>
                  <div className="text-gray-500 text-sm">{thisMonth.replace('-','/')}月</div>
                </div>
                {myRate < 100 && forecast < myTarget && (
                  <div className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">未達予測 -{myTarget - forecast}件</div>
                )}
              </div>
              <div className="space-y-2">
                {[
                  { label: '月間目標', value: `${myTarget}件` },
                  { label: '実績（獲得件数）', value: `${myAcquired}件`, color: 'text-blue-600' },
                  { label: '実稼働日数', value: `${workedDays}日` },
                  { label: '残稼働日数', value: `${remainDays}日`, color: remainDays <= 5 ? 'text-red-500' : 'text-gray-900' },
                  { label: '着地予測', value: `${forecast}件`, color: 'text-orange-500' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center py-2 border-b last:border-0">
                    <span className="text-gray-700 text-sm font-medium">{item.label}</span>
                    <span className={`font-bold text-base ${item.color || 'text-gray-900'}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-800 mb-2">⚡ 生産性</div>
              <div className="text-3xl font-bold text-blue-600">{productivity} <span className="text-base text-gray-500">件/日</span></div>
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-700 font-bold">着地予測: {forecast}件</div>
                <div className="text-xs text-blue-600 mt-1">{productivity} × {workedDays + remainDays}日 = {forecast}件</div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-800 mb-3">達成率</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-200 rounded-full h-4">
                  <div className={`h-4 rounded-full ${myRate >= 80 ? 'bg-green-500' : myRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(myRate, 100)}%` }} />
                </div>
                <span className="font-bold text-lg text-gray-900">{myRate}%</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'analysis' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-800 mb-3">📊 月間サマリー — {user?.name}</div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: '生産性', value: productivity },
                  { label: '実稼働', value: `${workedDays}日` },
                  { label: '残稼働', value: `${remainDays}日` },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 font-medium">{item.label}</div>
                    <div className="font-bold text-lg text-blue-600">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-800 mb-3">📈 行動量合計</div>
              {actionItems.map(item => {
                const total = myReports.reduce((s, r) => s + (Number(r[item.key]) || 0), 0);
                const avg = workedDays > 0 ? (total / workedDays).toFixed(1) : '0.0';
                return (
                  <div key={item.key} className="flex justify-between items-center py-2 border-b last:border-0">
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    <div className="text-right">
                      <span className="font-bold text-gray-900">{total}</span>
                      <span className="text-xs text-gray-500 ml-2">({avg}/日)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'overall' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900 text-white rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-1">今月獲得件数</div>
                <div className="text-3xl font-bold text-blue-400">{totalAcquired}</div>
                <div className="text-xs text-gray-400">目標 {TEAM_TARGET}件</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow">
                <div className="text-xs text-gray-500 mb-1 font-medium">想定売上</div>
                <div className="text-xl font-bold text-green-600">¥{estimatedSales.toLocaleString()}</div>
                <div className="text-xs text-gray-400">開通率{Math.round(OPEN_RATE*100)}%</div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-800 mb-3">🏆 獲得件数ランキング</div>
              {teamAcquired.map((m, i) => (
                <div key={m.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-600' : 'bg-blue-500'}`}>{i+1}</div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-900">{m.name}</div>
                    <div className="bg-gray-200 rounded-full h-2 mt-1">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${teamAcquired[0].acquired > 0 ? m.acquired / teamAcquired[0].acquired * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="font-bold text-blue-600">{m.acquired}件</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'contracts' && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="font-bold text-red-700 mb-1">📞 工事日電話が必要</div>
              <div className="text-xs text-red-500 mb-3">獲得日から3日以上経過のお客様</div>
              {reports
                .filter(r => r.name === user?.name && Number(r.acquired) > 0)
                .filter(r => Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000) >= 3)
                .map((r, i) => (
                  <div key={i} className="bg-white rounded-lg p-3 mb-2 border border-red-100">
                    <div className="font-bold text-sm text-gray-900">{r.acquiredCase || '案件詳細なし'}</div>
                    <div className="text-xs text-gray-500 mt-1">獲得: {r.date} ({Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000)}日経過)</div>
                  </div>
                ))}
            </div>
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-800 mb-3">📋 全獲得案件</div>
              {reports
                .filter(r => r.name === user?.name && Number(r.acquired) > 0)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((r, i) => (
                  <div key={i} className="py-3 border-b last:border-0">
                    <div className="flex justify-between items-start">
                      <div className="text-sm font-bold text-gray-900">{r.acquiredCase || '案件詳細なし'}</div>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">手続き中</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">獲得: {r.date}</div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
