'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBERS } from '@/lib/members';

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [expandedReport, setExpandedReport] = useState<number | null>(null);
  const thisMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    const parsed = JSON.parse(u);
    setUser(parsed);
    setSelectedMember(parsed.name);
    const stored = localStorage.getItem('reports');
    if (stored) setReports(JSON.parse(stored));
  }, []);

  const filtered = reports
    .filter(r => selectedMember === 'all' || r.name === selectedMember)
    .filter(r => !selectedDate || r.date === selectedDate)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white text-sm">← 戻る</button>
        <div className="font-bold text-blue-400">日報管理</div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {/* フィルター */}
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="font-bold text-gray-800 mb-3">絞り込み</div>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">メンバー</label>
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
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">日付</label>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900" />
              {selectedDate && (
                <button onClick={() => setSelectedDate('')} className="ml-2 text-sm text-blue-600">クリア</button>
              )}
            </div>
          </div>
        </div>

        {/* 日報一覧 */}
        <div className="text-sm text-gray-500 font-medium">{filtered.length}件の日報</div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 shadow text-center text-gray-400">
            日報がありません
          </div>
        ) : (
          filtered.map((r, i) => (
            <div key={i} className="bg-white rounded-xl shadow overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                onClick={() => setExpandedReport(expandedReport === i ? null : i)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {r.name?.[0]}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{r.name}</div>
                    <div className="text-xs text-gray-500">{r.date} {r.startTime && `${r.startTime}〜${r.endTime}`}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">獲得 {r.acquired || 0}件</div>
                    <div className="text-xs text-gray-500">訪問 {r.visits || 0}</div>
                  </div>
                  <div className="text-gray-400">{expandedReport === i ? '▲' : '▼'}</div>
                </div>
              </div>

              {expandedReport === i && (
                <div className="border-t px-4 pb-4">
                  {/* 行動量 */}
                  <div className="py-3 border-b">
                    <div className="font-bold text-gray-700 text-sm mb-2">行動量</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: '訪問', value: r.visits },
                        { label: 'ネット対面', value: r.netMeet },
                        { label: '主権対面', value: r.mainMeet },
                        { label: '商談', value: r.negotiation },
                        { label: '獲得', value: r.acquired },
                      ].map(item => (
                        <div key={item.label} className="bg-gray-50 rounded p-2 text-center">
                          <div className="text-xs text-gray-500">{item.label}</div>
                          <div className="font-bold text-gray-900">{item.value || 0}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 日報内容 */}
                  {[
                    { key: 'acquiredCase', label: '🏆 獲得案件' },
                    { key: 'lostCase', label: '😅 失注案件' },
                    { key: 'goodPoints', label: '✅ よかった点' },
                    { key: 'issues', label: '❌ 課題・失敗' },
                    { key: 'improvements', label: '📌 明日の改善ポイント' },
                    { key: 'learnings', label: '💡 学び・気づき' },
                  ].filter(item => r[item.key]).map(item => (
                    <div key={item.key} className="py-2 border-b last:border-0">
                      <div className="text-xs font-bold text-gray-500 mb-1">{item.label}</div>
                      <div className="text-sm text-gray-900 whitespace-pre-wrap">{r[item.key]}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
