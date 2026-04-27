'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MEMBERS as DEFAULT_MEMBERS } from '@/lib/members';
import { loadMembers } from '@/lib/memberStore';
import { getShifts, saveShift, getMembersFromGAS } from '@/lib/api';

type ShiftStatus = '稼働' | '休日' | '';

function ShiftContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'submit' | 'confirm'>(
    searchParams.get('view') === 'confirm' ? 'confirm' : 'submit'
  );
  const [shifts, setShifts] = useState<Record<string, Record<string, ShiftStatus>>>({});
  const [selectedMember, setSelectedMember] = useState('');
  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date|null>(null);
  const initialLoadDone = useRef(false);
  const hasChangesRef = useRef(false);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayStr = `${year}-${String(month+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const days = Array.from({length: daysInMonth}, (_,i) => i+1);
  const weekDays = ['日','月','火','水','木','金','土'];

  const syncShifts = async () => {
    if (hasChangesRef.current) return; // 未保存の変更がある間は上書きしない
    const data = await getShifts();
    if (hasChangesRef.current) return; // fetch中にタップされた場合も上書きしない
    if (data.length > 0) {
      const map: Record<string, Record<string, ShiftStatus>> = {};
      for (const s of data) {
        if (!map[s.name]) map[s.name] = {};
        map[s.name][s.date] = s.status as ShiftStatus;
      }
      setShifts(map);
      localStorage.setItem('shifts', JSON.stringify(map));
    }
    setLoading(false);
    initialLoadDone.current = true;
    setLastUpdated(new Date());
  };

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    const parsed = JSON.parse(u);
    setUser(parsed);
    setMembers(loadMembers());
    getMembersFromGAS().then(data => {
      if (data.length > 0) { localStorage.setItem('members', JSON.stringify(data)); setMembers(data); }
    });
    setSelectedMember(parsed.name);

    // localStorageから即時復元
    const cached = localStorage.getItem('shifts');
    if (cached) {
      try { setShifts(JSON.parse(cached)); setLoading(false); initialLoadDone.current = true; } catch {}
    }

    syncShifts();
  }, []);

  const getDay = (day: number) => new Date(year, month, day).getDay();

  const toggleShift = (name: string, day: number) => {
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const current = shifts[name]?.[key] || '';
    const next: ShiftStatus = current==='' ? '稼働' : current==='稼働' ? '休日' : '';
    const newShifts = { ...shifts, [name]: { ...shifts[name], [key]: next } };
    setShifts(newShifts);
    localStorage.setItem('shifts', JSON.stringify(newShifts));
    setHasChanges(true);
    hasChangesRef.current = true;
  };

  const handleSaveShifts = async () => {
    setSaving(true);
    const memberShifts = shifts[selectedMember] || {};
    await Promise.all(
      Object.entries(memberShifts)
        .filter(([, status]) => status !== '')
        .map(([date, status]) => saveShift(selectedMember, date, status))
    );
    setHasChanges(false);
    hasChangesRef.current = false;
    await syncShifts();
    setSaving(false);
    setSavedMsg('保存しました');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const getShift = (name: string, day: number): ShiftStatus => {
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return shifts[name]?.[key] || '';
  };

  const getShiftByKey = (name: string, key: string): ShiftStatus => shifts[name]?.[key] || '';

  const getWorkedCount = (name: string) => days.filter(d => getShift(name, d)==='稼働').length;

  // 今日稼働中のメンバー
  const todayWorking = members.filter(m => getShiftByKey(m.name, todayStr)==='稼働');
  const todayOff = members.filter(m => getShiftByKey(m.name, todayStr)==='休日');
  const todayUnset = members.filter(m => getShiftByKey(m.name, todayStr)==='');

  const myShiftCount = getWorkedCount(selectedMember);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3">
        <div className="font-bold text-blue-400">シフト管理</div>
        <span className="text-sm bg-gray-700 px-2 py-1 rounded-lg">{year}/{String(month+1).padStart(2,'0')}</span>
        <div className="ml-auto flex items-center gap-2">
          {savedMsg && <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">{savedMsg}</span>}
          {hasChanges && !savedMsg && <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">未保存</span>}
          {lastUpdated && <span className="text-xs text-gray-500">{lastUpdated.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>}
          <button onClick={syncShifts} className="text-xs text-gray-400 active:opacity-60 transition-opacity select-none">🔄</button>
        </div>
      </div>

      <div className="bg-gray-900 flex border-b border-gray-700">
        <button onClick={()=>setView('submit')} className={`px-6 py-3 text-sm font-medium ${view==='submit'?'bg-blue-600 text-white':'text-gray-400'}`}>シフト入力</button>
        <button onClick={()=>setView('confirm')} className={`px-6 py-3 text-sm font-medium ${view==='confirm'?'bg-blue-600 text-white':'text-gray-400'}`}>全体確認</button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
          シフトデータを読み込み中...
        </div>
      )}

      <div className="p-4 max-w-3xl mx-auto space-y-4">

        {/* 今日の稼働状況（常時表示） */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-gray-800">📅 今日の稼働状況</div>
            <div className="text-sm text-gray-500">{today.getMonth()+1}/{today.getDate()}（{weekDays[today.getDay()]}）</div>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-500 text-white rounded-xl px-4 py-3 text-center flex-1">
              <div className="text-2xl font-bold">{todayWorking.length}</div>
              <div className="text-xs">稼働中</div>
            </div>
            <div className="bg-gray-200 text-gray-600 rounded-xl px-4 py-3 text-center flex-1">
              <div className="text-2xl font-bold">{todayOff.length}</div>
              <div className="text-xs">休日</div>
            </div>
            <div className="bg-gray-100 text-gray-400 rounded-xl px-4 py-3 text-center flex-1">
              <div className="text-2xl font-bold">{todayUnset.length}</div>
              <div className="text-xs">未設定</div>
            </div>
          </div>
          {todayWorking.length > 0 && (
            <div className="mb-2">
              <div className="text-xs text-gray-500 mb-2 font-medium">稼働メンバー</div>
              <div className="flex flex-wrap gap-2">
                {todayWorking.map(m => (
                  <span key={m.id} className="bg-green-100 text-green-700 text-sm font-bold px-3 py-1 rounded-full">{m.name}</span>
                ))}
              </div>
            </div>
          )}
          {todayOff.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2 font-medium">休日</div>
              <div className="flex flex-wrap gap-2">
                {todayOff.map(m => (
                  <span key={m.id} className="bg-gray-100 text-gray-500 text-sm px-3 py-1 rounded-full">{m.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {view==='submit' && (
          <>
            {/* 責任者のみ：メンバー選択 */}
            {user?.isManager && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="font-bold text-gray-800">メンバーを選択</div>
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">責任者モード</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => (
                    <button key={m.id} onClick={()=>setSelectedMember(m.name)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium active:scale-95 transition-all duration-150 select-none ${selectedMember===m.name?'bg-blue-600 text-white':'bg-gray-100 text-gray-700'}`}>
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedMember && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-bold text-gray-800">{selectedMember}のシフト</div>
                  <div className="text-sm font-bold text-blue-600">稼働予定: {myShiftCount}日</div>
                </div>
                <div className="text-xs text-gray-500 mb-3">タップで 未設定 → 稼働 → 休日 と切り替わります。選び終わったら下の「保存する」を押してください。</div>
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map(d => (
                    <div key={d} className={`text-center text-xs font-bold py-1 ${d==='日'?'text-red-500':d==='土'?'text-blue-500':'text-gray-500'}`}>{d}</div>
                  ))}
                  {Array.from({length: getDay(1)}, (_,i) => <div key={`e-${i}`}/>)}
                  {days.map(day => {
                    const shift = getShift(selectedMember, day);
                    const dow = getDay(day);
                    const isTodayDay = day===today.getDate();
                    const canEdit = user?.isManager || selectedMember === user?.name;
                    return (
                      <button key={day}
                        onClick={() => canEdit && toggleShift(selectedMember, day)}
                        disabled={!canEdit}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-bold select-none transition-all
                          ${shift==='稼働'?'bg-green-500 text-white':shift==='休日'?'bg-gray-200 text-gray-400':'bg-gray-50 text-gray-700'}
                          ${isTodayDay?'ring-2 ring-blue-500':''}
                          ${shift===''?(dow===0?'!text-red-400':dow===6?'!text-blue-400':''):''}
                          ${canEdit?'active:scale-90':'opacity-50 cursor-not-allowed'}
                        `}>
                        <span>{day}</span>
                        {shift==='稼働' && <span className="text-xs leading-none">稼</span>}
                        {shift==='休日' && <span className="text-xs leading-none">休</span>}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={handleSaveShifts}
                  disabled={saving || !hasChanges}
                  className="mt-4 w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl text-sm active:scale-95 transition-all duration-150 select-none disabled:opacity-40">
                  {saving ? '保存中...' : hasChanges ? '💾 一括保存する' : '✅ 保存済み'}
                </button>
              </div>
            )}
          </>
        )}

        {view==='confirm' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="font-bold text-gray-800 p-4 border-b">全体シフト確認</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="px-2 py-2 text-left sticky left-0 bg-gray-800">氏名</th>
                    {days.map(d => {
                      const dow = getDay(d);
                      const isTodayDay = d===today.getDate();
                      return (
                        <th key={d} className={`px-1 py-2 text-center min-w-6 ${isTodayDay?'bg-blue-700':''} ${dow===0?'text-red-400':dow===6?'text-blue-400':''}`}>{d}</th>
                      );
                    })}
                    <th className="px-2 py-2 text-center">計</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m,i) => (
                    <tr key={m.id} className={i%2===0?'bg-white':'bg-gray-50'}>
                      <td className="px-2 py-1 font-bold text-gray-900 sticky left-0 bg-inherit">{m.name}</td>
                      {days.map(d => {
                        const shift = getShift(m.name, d);
                        const isTodayDay = d===today.getDate();
                        return (
                          <td key={d} className={`px-1 py-1 text-center ${isTodayDay?'bg-blue-50':''}`}>
                            {shift==='稼働' ? <span className="inline-flex w-5 h-5 bg-green-500 rounded text-white text-xs items-center justify-center">稼</span>
                            : shift==='休日' ? <span className="inline-flex w-5 h-5 bg-gray-200 rounded text-gray-400 text-xs items-center justify-center">休</span>
                            : <span className="text-gray-200">-</span>}
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
                      const count = members.filter(m=>getShift(m.name,d)==='稼働').length;
                      const isTodayDay = d===today.getDate();
                      return (
                        <td key={d} className={`px-1 py-1 text-center ${isTodayDay?'bg-blue-50':''}`}>
                          {count>0 ? <span className={`font-bold ${isTodayDay?'text-blue-600':'text-gray-900'}`}>{count}</span> : <span className="text-gray-300">-</span>}
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

export default function ShiftPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-400 text-sm">読み込み中...</div>}>
      <ShiftContent />
    </Suspense>
  );
}
