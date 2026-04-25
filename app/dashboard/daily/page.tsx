'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBERS as DEFAULT_MEMBERS } from '@/lib/members';
import { loadMembers } from '@/lib/memberStore';
import { getReports, getShifts, getMembersFromGAS } from '@/lib/api';

type ShiftStatus = '稼働' | '休日' | '';

export default function DailyPage() {
  const router = useRouter();
  const [reports, setReports] = useState<any[]>([]);
  const [shifts, setShifts] = useState<Record<string, Record<string, ShiftStatus>>>({});
  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const initialLoadDone = useRef(false);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const thisMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const weekLabels = ['日', '月', '火', '水', '木', '金', '土'];

  const getDateKey = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const getShiftStatus = (name: string, day: number): ShiftStatus =>
    shifts[name]?.[getDateKey(day)] || '';

  const getDayReport = (name: string, day: number) =>
    reports.find(r => r.name === name && r.date === getDateKey(day));

  const getDow = (day: number) => new Date(year, month, day).getDay();

  const loadAll = async () => {
    if (!initialLoadDone.current) setLoading(true);
    try {
      const [rData, sData] = await Promise.all([getReports(), getShifts()]);
      setReports(rData);
      localStorage.setItem('reports', JSON.stringify(rData));

      if (sData.length > 0) {
        const map: Record<string, Record<string, ShiftStatus>> = {};
        for (const s of sData) {
          if (!map[s.name]) map[s.name] = {};
          map[s.name][s.date] = s.status as ShiftStatus;
        }
        setShifts(map);
        localStorage.setItem('shifts', JSON.stringify(map));
      }
    } catch {
      const sr = localStorage.getItem('reports');
      const ss = localStorage.getItem('shifts');
      if (sr) setReports(JSON.parse(sr));
      if (ss) setShifts(JSON.parse(ss));
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
      setLastUpdated(new Date());
    }
  };

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }

    setMembers(loadMembers());
    getMembersFromGAS().then(data => {
      if (data.length > 0) { localStorage.setItem('members', JSON.stringify(data)); setMembers(data); }
    });

    const sr = localStorage.getItem('reports');
    const ss = localStorage.getItem('shifts');
    if (sr) { setReports(JSON.parse(sr)); initialLoadDone.current = true; setLoading(false); }
    if (ss) {
      try {
        const map = JSON.parse(ss);
        setShifts(map);
      } catch {}
    }

    loadAll();
    const interval = setInterval(loadAll, 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') loadAll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 text-sm active:opacity-60 transition-opacity select-none">← 戻る</button>
        <div className="font-bold text-blue-400">日別稼働</div>
        <span className="text-sm bg-gray-700 px-2 py-1 rounded-lg">{year}/{String(month + 1).padStart(2, '0')}</span>
        <div className="ml-auto flex items-center gap-2">
          {lastUpdated && <span className="text-xs text-gray-500">{lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
          <button onClick={loadAll} className="text-xs text-gray-400 active:opacity-60 transition-opacity select-none">🔄</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">読み込み中...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs border-separate border-spacing-0" style={{ minWidth: `${100 + daysInMonth * 52}px` }}>
            {/* 日付ヘッダー */}
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-gray-900 text-white px-3 py-2 text-left font-bold min-w-[80px] border-r border-gray-700">氏名</th>
                {days.map(d => {
                  const dow = getDow(d);
                  const isToday = d === today.getDate();
                  const isSun = dow === 0;
                  const isSat = dow === 6;
                  return (
                    <th key={d} className={`px-1 py-1.5 text-center min-w-[48px] font-bold border-r border-gray-700
                      ${isToday ? 'bg-blue-700 text-white' : 'bg-gray-900 text-white'}
                    `}>
                      <div className={isSun ? 'text-red-400' : isSat ? 'text-blue-400' : ''}>{d}</div>
                      <div className={`text-xs font-normal ${isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-400'}`}>{weekLabels[dow]}</div>
                    </th>
                  );
                })}
                <th className="bg-gray-900 text-white px-2 py-2 text-center font-bold border-l border-gray-600 min-w-[48px]">合計</th>
              </tr>
            </thead>

            <tbody>
              {members.map((m, mi) => {
                const monthlyAcquired = days.reduce((sum, d) => {
                  const r = getDayReport(m.name, d);
                  return sum + (Number(r?.acquired) || 0);
                }, 0);

                return (
                  <tr key={m.id} className={mi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {/* 氏名セル */}
                    <td className={`sticky left-0 z-10 px-3 py-1.5 font-bold text-gray-900 border-r border-b border-gray-200 min-w-[80px] ${mi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <div>{m.name}</div>
                      <div className="text-gray-400 font-normal text-xs">{m.role === 'closer' ? 'CL' : 'AP'}</div>
                    </td>

                    {/* 日付セル */}
                    {days.map(d => {
                      const shift = getShiftStatus(m.name, d);
                      const report = getDayReport(m.name, d);
                      const acquired = Number(report?.acquired) || 0;
                      const visits = Number(report?.visits) || 0;
                      const isToday = d === today.getDate();
                      const isFuture = d > today.getDate();

                      let bgClass = 'bg-white';
                      if (shift === '稼働') bgClass = 'bg-green-50';
                      else if (shift === '休日') bgClass = 'bg-gray-100';

                      return (
                        <td key={d} className={`px-1 py-1 text-center border-r border-b border-gray-200 ${bgClass} ${isToday ? 'ring-2 ring-inset ring-blue-400' : ''}`}>
                          {shift === '稼働' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              {report ? (
                                <>
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-white font-black text-xs
                                    ${acquired >= 3 ? 'bg-green-600' : acquired >= 1 ? 'bg-green-500' : 'bg-green-300'}`}>
                                    {acquired}
                                  </div>
                                  <div className="text-gray-400" style={{ fontSize: '9px' }}>訪{visits}</div>
                                </>
                              ) : (
                                <div className="w-6 h-6 rounded-lg bg-green-200 flex items-center justify-center text-green-700 font-bold text-xs">
                                  稼
                                </div>
                              )}
                            </div>
                          ) : shift === '休日' ? (
                            <div className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 font-bold text-xs mx-auto">
                              休
                            </div>
                          ) : (
                            <div className="text-gray-300 text-xs">
                              {isFuture ? '' : '-'}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* 合計セル */}
                    <td className="px-2 py-1.5 text-center border-b border-l border-gray-200 font-black text-blue-600 bg-blue-50">
                      {monthlyAcquired}
                    </td>
                  </tr>
                );
              })}

              {/* 稼働人数行 */}
              <tr className="bg-gray-800">
                <td className="sticky left-0 z-10 bg-gray-800 px-3 py-1.5 font-bold text-white border-r border-gray-700 text-xs">稼働数</td>
                {days.map(d => {
                  const count = members.filter(m => getShiftStatus(m.name, d) === '稼働').length;
                  const isToday = d === today.getDate();
                  return (
                    <td key={d} className={`px-1 py-1.5 text-center border-r border-gray-700 ${isToday ? 'bg-blue-700' : ''}`}>
                      {count > 0
                        ? <span className={`font-black ${isToday ? 'text-white' : 'text-green-400'}`}>{count}</span>
                        : <span className="text-gray-600">-</span>
                      }
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-center border-l border-gray-700 font-black text-blue-400">
                  {members.reduce((s, m) => s + days.reduce((ss, d) => ss + (Number(getDayReport(m.name, d)?.acquired) || 0), 0), 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
