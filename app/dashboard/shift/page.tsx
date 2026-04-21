'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBERS } from '@/lib/members';

type ShiftStatus = '稼働' | '休日' | '';

export default function ShiftPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'submit' | 'confirm'>('submit');
  const [shifts, setShifts] = useState<Record<string, Record<string, ShiftStatus>>>({});
  const [selectedMember, setSelectedMember] = useState('');

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    const parsed = JSON.parse(u);
    setUser(parsed);
    setSelectedMember(parsed.name);
    const stored = localStorage.getItem('shifts');
    if (stored) setShifts(JSON.parse(stored));
  }, []);

  const getDay = (day: number) => new Date(year, month, day).getDay();

  const toggleShift = (name: string, day: number) => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const current = shifts[name]?.[key] || '';
    const next: ShiftStatus = current === '' ? '稼働' : current === '稼働' ? '休日' : '';
    const updated = {
      ...shifts,
      [name]: { ...shifts[name], [key]: next }
    };
    setShifts(updated);
    localStorage.setItem('shifts', JSON.stringify(updated));
  };

  const getShift = (name: string, day: number): ShiftStatus => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return shifts[name]?.[key] || '';
  };

  const getWorkedCount = (name: string) =>
    days.filter(d => getShift(name, d) === '稼働').length;

  const myShiftCount = getWorkedCount(selectedMember);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white text-sm">← 戻る</button>
        <div className="font-bold text-blue-400">シフト管理</div>
        <span className="text-sm bg-gray-700 px-2 py-1 rounded">
          {year}/{String(month + 1).padStart(2, '0')}
        </span>
      </div>

      {/* タブ */}
      <div className="bg-gray-900 flex">
        <button onClick={() => setView('submit')}
          className={`px-6 py-3 text-sm font-medium ${view === 'submit' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
          シフト入力
        </button>
        <button onClick={() => setView('confirm')}
          className={`px-6 py-3 text-sm font-medium ${view === 'confirm' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
          全体確認
        </button>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-4">

        {view === 'submit' && (
          <>
            {/* メンバー選択 */}
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="font-bold text-gray-800 mb-3">メンバーを選択</div>
              <div className="flex flex-wrap gap-2">
                {MEMBERS.map(m => (
                  <button key={m.id} onClick={() => setSelectedMember(m.name)}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${selectedMember === m.name ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            {/* シフト入力 */}
            {selectedMember && (
              <div className="bg-white rounded-xl p-4 shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-bold text-gray-800">{selectedMember}のシフト</div>
                  <div className="text-sm font-bold text-blue-600">稼働予定: {myShiftCount}日</div>
                </div>
                <div className="text-xs text-gray-500 mb-3">タップで 未設定 → 稼働 → 休日 と切り替わります</div>
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map(d => (
                    <div key={d} className={`text-center text-xs font-bold py-1 ${d === '日' ? 'text-red-500' : d === '土' ? 'text-blue-500' : 'text-gray-500'}`}>{d}</div>
                  ))}
                  {/* 月初の空白 */}
                  {Array.from({ length: getDay(1) }, (_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {days.map(day => {
                    const shift = getShift(selectedMember, day);
                    const dayOfWeek = getDay(day);
                    const isToday = day === today.getDate();
                    return (
                      <button
                        key={day}
                        onClick={() => toggleShift(selectedMember, day)}
                        className={`
                          aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-bold
                          ${shift === '稼働' ? 'bg-green-500 text-white' : shift === '休日' ? 'bg-gray-200 text-gray-400' : 'bg-gray-50 text-gray-700'}
                          ${isToday ? 'ring-2 ring-blue-500' : ''}
                          ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''}
                          ${shift !== '' ? '' : dayOfWeek === 0 ? '!text-red-400' : dayOfWeek === 6 ? '!text-blue-400' : ''}
                        `}
                      >
                        <span>{day}</span>
                        {shift === '稼働' && <span className="text-xs">稼</span>}
                        {shift === '休日' && <span className="text-xs">休</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {view === 'confirm' && (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="font-bold text-gray-800 p-4 border-b">全体シフト確認</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="px-2 py-2 text-left sticky left-0 bg-gray-800">氏名</th>
                    {days.map(d => {
                      const dow = getDay(d);
                      return (
                        <th key={d} className={`px-1 py-2 text-center min-w-6 ${dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : ''}`}>
                          {d}
                        </th>
                      );
                    })}
                    <th className="px-2 py-2 text-center">計</th>
                  </tr>
                </thead>
                <tbody>
                  {MEMBERS.map((m, i) => (
                    <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-2 py-1 font-bold text-gray-900 sticky left-0 bg-inherit">{m.name}</td>
                      {days.map(d => {
                        const shift = getShift(m.name, d);
                        return (
                          <td key={d} className="px-1 py-1 text-center">
                            {shift === '稼働' ? (
                              <span className="inline-block w-5 h-5 bg-green-500 rounded text-white text-xs flex items-center justify-center">稼</span>
                            ) : shift === '休日' ? (
                              <span className="inline-block w-5 h-5 bg-gray-200 rounded text-gray-400 text-xs flex items-center justify-center">休</span>
                            ) : (
                              <span className="text-gray-200">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1 text-center font-bold text-blue-600">{getWorkedCount(m.name)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100">
                  <tr>
                    <td className="px-2 py-1 font-bold text-gray-900">人数</td>
                    {days.map(d => {
                      const count = MEMBERS.filter(m => getShift(m.name, d) === '稼働').length;
                      return (
                        <td key={d} className="px-1 py-1 text-center">
                          {count > 0 ? <span className="font-bold text-gray-900">{count}</span> : <span className="text-gray-300">-</span>}
                        </td>
                      );
                    })}
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
