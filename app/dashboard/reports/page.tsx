'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBERS as DEFAULT_MEMBERS } from '@/lib/members';
import { loadMembers } from '@/lib/memberStore';
import { getReports, getMembersFromGAS } from '@/lib/api';

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState('all');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [lastUpdated, setLastUpdated] = useState<Date|null>(null);
  const initialLoadDone = useRef(false);
  const thisMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    const parsed = JSON.parse(u);
    setUser(parsed);
    setSelectedMember(parsed.name);
    setMembers(loadMembers());
    getMembersFromGAS().then(data => {
      if (data.length > 0) { localStorage.setItem('members', JSON.stringify(data)); setMembers(data); }
    });
    const stored = localStorage.getItem('reports');
    if (stored) { setReports(JSON.parse(stored)); setLoading(false); initialLoadDone.current = true; }
    loadReports();

    const interval = setInterval(loadReports, 20000);
    const onVisible = () => { if (document.visibilityState === 'visible') loadReports(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const loadReports = async () => {
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

  const filtered = reports
    .filter(r => selectedMember === 'all' || r.name === selectedMember)
    .filter(r => r.date?.startsWith(thisMonth))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth()+1}/${d.getDate()}（${['日','月','火','水','木','金','土'][d.getDay()]}）`;
  };

  const reportKey = (r: any) => `${r.name}_${r.date}`;

  const copyReport = (r: any, i: number) => {
    const lines = [
      `【${r.name} 日報 ${formatDate(r.date)}】`,
      ``,
      `■ 稼働時間`,
      `${r.startTime || '--:--'} 〜 ${r.endTime || '--:--'}`,
      ``,
      `■ 行動量`,
      `訪問数：${r.visits}　対面数：${r.netMeet}　主権対面：${r.mainMeet}　商談：${r.negotiation}　獲得数：${r.acquired}`,
      ``,
    ];
    if (r.acquiredCase) lines.push(`■ 獲得案件\n${r.acquiredCase}\n`);
    if (r.lostCase) lines.push(`■ 失注案件\n${r.lostCase}\n`);
    if (r.goodPoints) lines.push(`■ よかった点\n${r.goodPoints}\n`);
    if (r.issues) lines.push(`■ 課題・失敗\n${r.issues}\n`);
    if (r.improvements) lines.push(`■ 明日の改善ポイント\n${r.improvements}\n`);
    if (r.learnings) lines.push(`■ 学び・気づき\n${r.learnings}\n`);
    if (r.gratitude) lines.push(`■ 感謝・シェアしたいこと\n${r.gratitude}\n`);
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      const key = reportKey(r);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const reportItems = [
    { key: 'acquiredCase', label: '🏆 獲得案件', color: 'border-l-green-500' },
    { key: 'lostCase', label: '😅 失注案件', color: 'border-l-orange-400' },
    { key: 'goodPoints', label: '✅ よかった点', color: 'border-l-blue-500' },
    { key: 'issues', label: '❌ 課題・失敗', color: 'border-l-red-400' },
    { key: 'improvements', label: '📌 明日の改善ポイント', color: 'border-l-purple-500' },
    { key: 'learnings', label: '💡 学び・気づき', color: 'border-l-yellow-500' },
    { key: 'gratitude', label: '🙏 感謝・シェアしたいこと', color: 'border-l-pink-400' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 text-sm active:opacity-60 transition-opacity select-none">← 戻る</button>
        <div className="font-bold text-blue-400">日報管理</div>
        <span className="text-sm bg-gray-700 px-2 py-1 rounded-lg">{thisMonth.replace('-', '/')}</span>
        <div className="flex items-center gap-2 ml-auto">
          {lastUpdated && <span className="text-xs text-gray-500">{lastUpdated.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>}
          <button onClick={loadReports} className="text-xs text-gray-400 active:opacity-60 transition-opacity select-none">🔄</button>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4 page-animate">

        {/* メンバー選択 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelectedMember('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium active:scale-95 transition-all duration-150 select-none ${selectedMember === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
              全員
            </button>
            {members.map(m => (
              <button key={m.id} onClick={() => setSelectedMember(m.name)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium active:scale-95 transition-all duration-150 select-none ${selectedMember === m.name ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_,i) => <div key={i} className="skeleton h-28 rounded-2xl"/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center text-gray-400">
            日報がありません
          </div>
        ) : (
          <>
            <div className="text-xs text-gray-500 font-medium px-1">{filtered.length}件の日報</div>
            {filtered.map((r, i) => (
              <div key={reportKey(r)} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* ヘッダー */}
                <div className="p-4 active:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setExpandedReport(expandedReport === reportKey(r) ? null : reportKey(r))}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {r.name?.[0]}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{r.name}</div>
                        <div className="text-xs text-gray-500">
                          {formatDate(r.date)}
                          {r.startTime && ` ${r.startTime}〜${r.endTime}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-600">獲得 {Number(r.acquired) || 0}件</div>
                      <div className="text-xs text-gray-500">訪問 {Number(r.visits) || 0}</div>
                    </div>
                  </div>

                  {/* 行動量バー */}
                  <div className="mt-3 grid grid-cols-5 gap-1 text-center">
                    {[
                      { label: '訪問', val: r.visits, color: 'bg-blue-50 text-blue-700' },
                      { label: '対面', val: r.netMeet, color: 'bg-purple-50 text-purple-700' },
                      { label: '主権', val: r.mainMeet, color: 'bg-indigo-50 text-indigo-700' },
                      { label: '商談', val: r.negotiation, color: 'bg-orange-50 text-orange-700' },
                      { label: '獲得', val: r.acquired, color: 'bg-green-50 text-green-700' },
                    ].map(item => (
                      <div key={item.label} className={`${item.color} rounded-xl py-1.5`}>
                        <div className="text-xs">{item.label}</div>
                        <div className="font-bold text-sm">{Number(item.val) || 0}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 日報詳細 */}
                {expandedReport === reportKey(r) && (
                  <div className="border-t">
                    <div className="px-4 py-3 space-y-3">
                      {reportItems.filter(item => r[item.key]).map(item => (
                        <div key={item.key} className={`border-l-4 ${item.color} pl-3 py-1`}>
                          <div className="text-xs font-bold text-gray-500 mb-1">{item.label}</div>
                          <div className="text-sm text-gray-900 whitespace-pre-wrap">{r[item.key]}</div>
                        </div>
                      ))}
                      {reportItems.every(item => !r[item.key]) && (
                        <div className="text-sm text-gray-400 text-center py-2">日報の記入なし</div>
                      )}
                    </div>
                    <div className="px-4 pb-4">
                      <button onClick={() => copyReport(r, i)}
                        className="w-full border border-blue-600 text-blue-600 font-bold py-3 rounded-2xl text-sm active:scale-95 transition-all duration-150 select-none">
                        {copied === reportKey(r) ? '✅ コピーしました！' : '📋 この日報をコピー'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
