'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBERS as DEFAULT_MEMBERS } from '@/lib/members';
import { loadMembers } from '@/lib/memberStore';
import { saveReport, getReports, getMembersFromGAS } from '@/lib/api';
import { AREAS, CIRCLED } from '@/lib/areas';
import { getPeriodReports, calcMemberStats } from '@/lib/calcStats';

type Toast = { type: 'success' | 'error'; msg: string } | null;

const thisMonth = new Date().toISOString().slice(0, 7);
const PLAN_KEY = `planDays_${thisMonth}`;

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<Record<string, any> | null>(null);
  const [reports, setReports] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [monthPlanDays, setMonthPlanDays] = useState(20);
  const [modalPlanDays, setModalPlanDays] = useState(20);
  // 代理入力対象（責任者は任意メンバー、一般は自分のみ）
  const [inputAsName, setInputAsName] = useState('');
  const initialLoadDone = useRef(false);
  const formDirty = useRef(false);
  const lastPopulatedKey = useRef('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState({
    visits: 0, netMeet: 0, mainMeet: 0, negotiation: 0, acquired: 0,
    startTime: '', endTime: '',
    acquiredCase: '', lostCase: '', goodPoints: '', issues: '',
    improvements: '', learnings: '', gratitude: '',
    area1: '', area2: '', area3: '', area4: '', area5: '',
    area6: '', area7: '', area8: '', area9: '', area10: '',
  });
  const [areaTab, setAreaTab] = useState(1);
  const [areaQuery, setAreaQuery] = useState('');

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2500);
  };

  const loadReports = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    const parsed = JSON.parse(u);
    setUser(parsed);
    setInputAsName(parsed.name);
    setMembers(loadMembers());
    getMembersFromGAS().then(data => {
      if (data.length > 0) { localStorage.setItem('members', JSON.stringify(data)); setMembers(data); }
    });

    const stored = localStorage.getItem(PLAN_KEY);
    if (stored) {
      const v = parseInt(stored);
      setMonthPlanDays(v); setModalPlanDays(v);
    } else {
      setShowPlanModal(true);
    }

    const storedReports = localStorage.getItem('reports');
    if (storedReports) { setReports(JSON.parse(storedReports)); initialLoadDone.current = true; }
    loadReports();

    const interval = setInterval(loadReports, 20000);
    const onVisible = () => { if (document.visibilityState === 'visible') loadReports(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [loadReports]);

  // フォームを inputAsName + selectedDate に合わせて更新
  useEffect(() => {
    const key = `${inputAsName}_${selectedDate}`;
    const keyChanged = key !== lastPopulatedKey.current;
    if (!keyChanged && formDirty.current) return;
    lastPopulatedKey.current = key;
    formDirty.current = false;

    const existing = reports.find(r => r.date === selectedDate && r.name === inputAsName);
    if (existing) {
      setForm({
        visits: Number(existing.visits) || 0, netMeet: Number(existing.netMeet) || 0,
        mainMeet: Number(existing.mainMeet) || 0, negotiation: Number(existing.negotiation) || 0,
        acquired: Number(existing.acquired) || 0, startTime: existing.startTime || '',
        endTime: existing.endTime || '', acquiredCase: existing.acquiredCase || '',
        lostCase: existing.lostCase || '', goodPoints: existing.goodPoints || '',
        issues: existing.issues || '', improvements: existing.improvements || '',
        learnings: existing.learnings || '', gratitude: existing.gratitude || '',
        area1: existing.area1 || '', area2: existing.area2 || '', area3: existing.area3 || '',
        area4: existing.area4 || '', area5: existing.area5 || '', area6: existing.area6 || '',
        area7: existing.area7 || '', area8: existing.area8 || '', area9: existing.area9 || '',
        area10: existing.area10 || '',
      });
      setAreaTab(1); setAreaQuery(existing.area1 || '');
    } else {
      setForm({
        visits: 0, netMeet: 0, mainMeet: 0, negotiation: 0, acquired: 0,
        startTime: '', endTime: '', acquiredCase: '', lostCase: '',
        goodPoints: '', issues: '', improvements: '', learnings: '', gratitude: '',
        area1: '', area2: '', area3: '', area4: '', area5: '',
        area6: '', area7: '', area8: '', area9: '', area10: '',
      });
      setAreaTab(1); setAreaQuery('');
    }
  }, [selectedDate, inputAsName, reports]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const report = { ...form, date: selectedDate, name: inputAsName, planDays: monthPlanDays };
    try {
      formDirty.current = false;
      await saveReport(report);
      await loadReports();
      showToast('success', `${inputAsName !== user.name ? `${inputAsName}の` : ''}保存しました！`);
    } catch {
      const updated = [...reports.filter(r => !(r.date === selectedDate && r.name === inputAsName)), report];
      setReports(updated);
      localStorage.setItem('reports', JSON.stringify(updated));
      showToast('error', '端末に保存（通信エラー・再保存してください）');
    } finally { setSaving(false); }
  };

  const savePlanDays = () => {
    setMonthPlanDays(modalPlanDays);
    localStorage.setItem(PLAN_KEY, String(modalPlanDays));
    setShowPlanModal(false);
  };

  const copyReport = () => {
    const d = new Date(selectedDate);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}（${['日', '月', '火', '水', '木', '金', '土'][d.getDay()]}）`;
    const lines = [
      `【${inputAsName} 日報 ${dateStr}】`, ``,
      `■ 稼働時間`, `${form.startTime || '--:--'} 〜 ${form.endTime || '--:--'}`, ``,
      `■ 行動量`, `訪問：${form.visits}　対面：${form.netMeet}　主権：${form.mainMeet}　商談：${form.negotiation}　獲得：${form.acquired}`, ``,
    ];
    const areas = [form.area1, form.area2, form.area3, form.area4, form.area5,
      form.area6, form.area7, form.area8, form.area9, form.area10].filter(Boolean);
    if (areas.length > 0) lines.push(`■ 獲得エリア\n${areas.map((a, i) => `${CIRCLED[i]} ${a}`).join('　')}\n`);
    if (form.acquiredCase) lines.push(`■ 獲得案件\n${form.acquiredCase}\n`);
    if (form.lostCase) lines.push(`■ 失注案件\n${form.lostCase}\n`);
    if (form.goodPoints) lines.push(`■ よかった点\n${form.goodPoints}\n`);
    if (form.issues) lines.push(`■ 課題・失敗\n${form.issues}\n`);
    if (form.improvements) lines.push(`■ 明日の改善\n${form.improvements}\n`);
    if (form.learnings) lines.push(`■ 学び\n${form.learnings}\n`);
    if (form.gratitude) lines.push(`■ 感謝\n${form.gratitude}\n`);
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Computed stats for inputAsName ───────────────────────────────────────
  const periodReports = getPeriodReports(reports, 'month');
  const inputAsMember = members.find(m => m.name === inputAsName);
  const inputAsStats = inputAsMember ? calcMemberStats(periodReports, inputAsMember, 'month') : null;

  // Input-tab mini card using monthPlanDays (live, before first save)
  const selfReports = periodReports.filter(r => r.name === inputAsName);
  const statusAcquired = selfReports.reduce((s, r) => s + (Number(r.acquired) || 0), 0);
  const statusWorked = selfReports.filter(r => Number(r.visits) > 0).length;
  const statusProd = statusWorked > 0 ? statusAcquired / statusWorked : 0;
  const statusRemain = Math.max(monthPlanDays - statusWorked, 0);
  const statusForecast = Math.round(statusProd * (statusWorked + statusRemain));
  const statusTarget = inputAsMember?.target || 0;
  const statusRate = statusTarget > 0 ? Math.round(statusAcquired / statusTarget * 100) : 0;

  const formatDate = (s: string) => {
    const d = new Date(s);
    return `${d.getMonth() + 1}/${d.getDate()}（${['日', '月', '火', '水', '木', '金', '土'][d.getDay()]}）`;
  };
  const changeDate = (delta: number) => {
    const d = new Date(selectedDate); d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split('T')[0]);
  };
  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const hasData = reports.some(r => r.date === selectedDate && r.name === inputAsName);
  const isProxy = user && inputAsName !== user.name;

  const actionItems = [
    { key: 'visits' as const,      label: '訪問数',   color: 'bg-blue-500' },
    { key: 'netMeet' as const,     label: '対面数',   color: 'bg-purple-500' },
    { key: 'mainMeet' as const,    label: '主権対面', color: 'bg-indigo-500' },
    { key: 'negotiation' as const, label: '商談',     color: 'bg-orange-500' },
    { key: 'acquired' as const,    label: '獲得数',   color: 'bg-green-500' },
  ];
  const inputCls = "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm mt-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const textareaCls = "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm mt-1 h-20 resize-none text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold text-white flex items-center gap-2
          ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* planDays modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl">
            <div className="text-lg font-bold text-gray-900 mb-1">📅 今月の稼働計画</div>
            <div className="text-sm text-gray-500 mb-5">今月の予定稼働日数を設定してください</div>
            <div className="flex items-center justify-center gap-6 mb-2">
              <button onClick={() => setModalPlanDays(d => Math.max(1, d - 1))}
                className="w-12 h-12 bg-gray-100 rounded-full text-2xl font-bold text-gray-700 active:scale-90 transition-all select-none">−</button>
              <span className="text-5xl font-bold text-blue-600 w-16 text-center tabular-nums">{modalPlanDays}</span>
              <button onClick={() => setModalPlanDays(d => Math.min(31, d + 1))}
                className="w-12 h-12 bg-blue-600 text-white rounded-full text-2xl font-bold active:scale-90 transition-all select-none">＋</button>
            </div>
            <div className="text-xs text-gray-400 text-center mb-5">日（営業日目安）</div>
            <button onClick={savePlanDays}
              className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl text-sm active:scale-95 transition-all select-none">
              設定する
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 bg-white rounded-lg overflow-hidden px-1.5 py-0.5">
            <img src="/logo.png" alt="TOP" className="h-full w-auto object-contain" />
          </div>
          <span className="text-sm bg-gray-700 px-2 py-1 rounded">{thisMonth.replace('-', '/')}</span>
          {user && !user.isManager && (
            <span className="text-sm text-gray-300">{user.name}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {loading
            ? <span className="text-xs text-gray-400 animate-pulse">同期中...</span>
            : lastUpdated && <span className="text-xs text-gray-500">{lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          }
          <button onClick={() => router.push('/dashboard/settings')}
            className="text-gray-400 text-sm active:opacity-60 select-none">⚙️</button>
          <button onClick={() => { localStorage.clear(); router.push('/login'); }}
            className="text-gray-400 text-sm hover:text-white select-none">ログアウト</button>
        </div>
      </div>

      {/* Manager: member selector chips */}
      {user?.isManager && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="text-xs text-gray-400 mb-2 font-medium">入力対象メンバー</div>
          <div className="flex flex-wrap gap-2">
            {members.map(m => (
              <button key={m.id}
                onClick={() => { setInputAsName(m.name); formDirty.current = false; }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 select-none
                  ${inputAsName === m.name ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                {m.name}
                {m.name === user.name && <span className="ml-1 opacity-60">（自分）</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Proxy badge */}
      {isProxy && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-bold text-yellow-700">
            ✏️ {inputAsName} の代わりに入力中
          </span>
          <button onClick={() => setInputAsName(user!.name)}
            className="text-xs text-yellow-600 underline select-none">自分に戻る</button>
        </div>
      )}

      <div className="p-4 max-w-2xl mx-auto space-y-4 page-animate" onFocus={() => { formDirty.current = true; }}>

        {/* Date selector */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <button onClick={() => changeDate(-1)} className="w-11 h-11 bg-gray-100 rounded-full text-gray-600 font-bold active:scale-90 transition-all duration-150 select-none">‹</button>
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
              className="w-11 h-11 bg-gray-100 rounded-full text-gray-600 font-bold active:scale-90 transition-all duration-150 select-none disabled:opacity-30">›</button>
          </div>
        </div>

        {/* 今月の状況（inputAsName の数値） */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-gray-800">
              📊 {isProxy ? `${inputAsName} の` : ''}今月の状況
            </div>
            <div className={`text-xs font-bold px-2.5 py-1 rounded-full
              ${statusRate >= 80 ? 'bg-green-100 text-green-700' : statusRate >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-500'}`}>
              達成率 {statusRate}%
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div className={`h-2 rounded-full transition-all duration-500 ${statusRate >= 80 ? 'bg-green-500' : statusRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(statusRate, 100)}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '獲得件数', value: `${statusAcquired}件`, color: 'text-blue-600' },
              { label: '稼働日数', value: `${statusWorked}日`, color: '' },
              { label: '生産性', value: `${statusProd.toFixed(2)}件/日`, color: 'text-purple-600' },
              { label: '残稼働', value: `${statusRemain}日`, color: statusRemain <= 5 ? 'text-red-500' : '' },
              { label: '着地予測', value: `${statusForecast}件`, color: 'text-orange-500' },
              { label: '目標', value: `${statusTarget}件`, color: '' },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                <div className="text-xs text-gray-400">{item.label}</div>
                <div className={`font-bold text-sm mt-0.5 ${item.color || 'text-gray-900'}`}>{item.value}</div>
              </div>
            ))}
          </div>
          {!isProxy && (
            <button onClick={() => { setModalPlanDays(monthPlanDays); setShowPlanModal(true); }}
              className="mt-3 w-full text-xs text-gray-400 text-center py-1 active:opacity-60 select-none">
              計画稼働日数: {monthPlanDays}日（変更する）
            </button>
          )}
        </div>

        {/* 稼働時間 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="font-bold text-gray-800 mb-3">⏰ 稼働時間</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium text-gray-700">開始</label>
              <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className={inputCls} /></div>
            <div><label className="text-sm font-medium text-gray-700">終了</label>
              <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className={inputCls} /></div>
          </div>
        </div>

        {/* 行動量 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="font-bold text-gray-800 mb-3">📊 行動量</div>
          {actionItems.map(item => (
            <div key={item.key} className="flex items-center justify-between py-3 border-b last:border-0 gap-3">
              <span className="text-sm font-medium text-gray-800 w-20 shrink-0">{item.label}</span>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={() => setForm({ ...form, [item.key]: Math.max(0, form[item.key] - 1) })}
                  className="w-11 h-11 bg-gray-200 rounded-full text-gray-700 font-bold text-lg active:scale-90 transition-all duration-150 select-none">−</button>
                <input type="number" min="0" value={form[item.key]}
                  onChange={e => setForm({ ...form, [item.key]: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-16 text-center font-bold text-xl text-gray-900 border border-gray-300 rounded-xl py-1 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => setForm({ ...form, [item.key]: form[item.key] + 1 })}
                  className={`w-11 h-11 ${item.color} rounded-full text-white font-bold text-lg active:scale-90 transition-all duration-150 select-none`}>＋</button>
              </div>
            </div>
          ))}
        </div>

        {/* 獲得エリア */}
        {form.acquired > 0 && (() => {
          const count = Math.min(form.acquired, 10);
          const filtered = areaQuery ? AREAS.filter(a => a.includes(areaQuery)).slice(0, 8) : [];
          const currentVal = (form as Record<string, any>)[`area${areaTab}`] as string;
          return (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-3">📍 獲得エリア</div>
              {count > 1 && (
                <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
                  {Array.from({ length: count }, (_, i) => {
                    const n = i + 1;
                    const area = (form as Record<string, any>)[`area${n}`] as string;
                    return (
                      <button key={n} onClick={() => { setAreaTab(n); setAreaQuery(area || ''); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all active:scale-95 select-none
                          ${areaTab === n ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        獲得{CIRCLED[i]}{area ? ` ${area}` : ''}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="relative">
                <input type="text" value={areaQuery}
                  onChange={e => { const v = e.target.value; setAreaQuery(v); setForm({ ...form, [`area${areaTab}`]: v }); }}
                  placeholder="エリアを選択または入力"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8" />
                {currentVal && (
                  <button onClick={() => { setAreaQuery(''); setForm({ ...form, [`area${areaTab}`]: '' }); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl leading-none active:opacity-60">×</button>
                )}
              </div>
              {areaQuery.length > 0 && (
                <div className="mt-1.5 max-h-44 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 shadow-sm">
                  {filtered.length > 0 ? filtered.map(area => {
                    const sel = currentVal === area;
                    return (
                      <button key={area} onClick={() => { setAreaQuery(area); setForm({ ...form, [`area${areaTab}`]: area }); }}
                        className={`w-full text-left px-4 py-2.5 text-sm active:bg-gray-50 flex items-center justify-between transition-colors
                          ${sel ? 'bg-green-50 text-green-700 font-bold' : 'text-gray-700'}`}>
                        <span>{area}</span>
                        {sel && <span className="text-green-500 font-black">✓</span>}
                      </button>
                    );
                  }) : <div className="px-4 py-2.5 text-sm text-gray-400">「{areaQuery}」で保存します</div>}
                </div>
              )}
              {count > 1 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Array.from({ length: count }, (_, i) => {
                    const area = (form as Record<string, any>)[`area${i + 1}`] as string;
                    return area
                      ? <span key={i} className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">{CIRCLED[i]} {area}</span>
                      : <span key={i} className="bg-gray-100 text-gray-400 text-xs px-2.5 py-1 rounded-full">{CIRCLED[i]} 未選択</span>;
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* 日報 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="font-bold text-gray-800 mb-3">📝 日報</div>
          {([
            { key: 'acquiredCase', label: '🏆 獲得案件', ph: 'お客さんの属性・角度感・フックを詳しく' },
            { key: 'lostCase', label: '😅 失注案件', ph: '失注の詳細（なければ「なし」）' },
            { key: 'goodPoints', label: '✅ よかった点', ph: '今日のよかった点を具体的に' },
            { key: 'issues', label: '❌ 課題・失敗', ph: '課題や失敗を正直に' },
            { key: 'improvements', label: '📌 明日の改善', ph: '明日に活かす改善点' },
            { key: 'learnings', label: '💡 学び・気づき', ph: '今日の学び・新発見' },
            { key: 'gratitude', label: '🙏 感謝（任意）', ph: 'チームへの感謝や共有したいこと' },
          ] as const).map(item => (
            <div key={item.key} className="mb-4">
              <label className="text-sm font-bold text-gray-700">{item.label}</label>
              <textarea value={form[item.key]} onChange={e => setForm({ ...form, [item.key]: e.target.value })}
                placeholder={item.ph} className={textareaCls} />
            </div>
          ))}
        </div>

        {/* Save / Copy */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={copyReport}
            className="bg-white border-2 border-blue-600 text-blue-600 font-bold py-4 rounded-2xl text-sm active:scale-95 transition-all duration-150 select-none">
            {copied ? '✅ コピー済み！' : '📋 日報をコピー'}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 text-white font-bold py-4 rounded-2xl text-sm active:scale-95 transition-all duration-150 select-none disabled:opacity-50">
            {saving ? '保存中...' : isProxy ? `${inputAsName}の日報を保存` : '💾 保存する'}
          </button>
        </div>
      </div>
    </div>
  );
}
