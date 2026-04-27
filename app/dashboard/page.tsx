'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBERS as DEFAULT_MEMBERS } from '@/lib/members';
import { loadMembers } from '@/lib/memberStore';
import { saveReport, getReports, getMembersFromGAS } from '@/lib/api';
import { AREAS, CIRCLED } from '@/lib/areas';
import { getPeriodReports, calcMemberStats, calcTeamStats, MemberStats } from '@/lib/calcStats';

type Tab = 'input' | 'mine' | 'analysis' | 'team';
type Toast = { type: 'success' | 'error'; msg: string } | null;

const thisMonth = new Date().toISOString().slice(0, 7);
const PLAN_KEY = `planDays_${thisMonth}`;

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<Record<string, any> | null>(null);
  const [tab, setTab] = useState<Tab>('input');
  const [reports, setReports] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [viewingMember, setViewingMember] = useState('');
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [monthPlanDays, setMonthPlanDays] = useState(20);
  const [modalPlanDays, setModalPlanDays] = useState(20);
  const initialLoadDone = useRef(false);
  const formDirty = useRef(false);
  const lastPopulatedDate = useRef('');
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
    setViewingMember(parsed.name);
    setMembers(loadMembers());
    getMembersFromGAS().then(data => {
      if (data.length > 0) { localStorage.setItem('members', JSON.stringify(data)); setMembers(data); }
    });

    const stored = localStorage.getItem(PLAN_KEY);
    if (stored) {
      const v = parseInt(stored);
      setMonthPlanDays(v);
      setModalPlanDays(v);
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

  useEffect(() => {
    if (!user) return;
    const dateChanged = selectedDate !== lastPopulatedDate.current;
    if (!dateChanged && formDirty.current) return;
    lastPopulatedDate.current = selectedDate;
    formDirty.current = false;

    const existing = reports.find(r => r.date === selectedDate && r.name === user.name);
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
      setAreaTab(1);
      setAreaQuery(existing.area1 || '');
    } else {
      setForm({
        visits: 0, netMeet: 0, mainMeet: 0, negotiation: 0, acquired: 0,
        startTime: '', endTime: '', acquiredCase: '', lostCase: '',
        goodPoints: '', issues: '', improvements: '', learnings: '', gratitude: '',
        area1: '', area2: '', area3: '', area4: '', area5: '',
        area6: '', area7: '', area8: '', area9: '', area10: '',
      });
      setAreaTab(1);
      setAreaQuery('');
    }
  }, [selectedDate, user, reports]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const report = { ...form, date: selectedDate, name: user.name, planDays: monthPlanDays };
    try {
      formDirty.current = false;
      await saveReport(report);
      await loadReports();
      showToast('success', '保存しました！');
    } catch {
      const updated = [...reports.filter(r => !(r.date === selectedDate && r.name === user.name)), report];
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
    if (!user) return;
    const d = new Date(selectedDate);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}（${['日', '月', '火', '水', '木', '金', '土'][d.getDay()]}）`;
    const lines = [
      `【${user.name} 日報 ${dateStr}】`, ``,
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Computed stats ──
  const periodReports = getPeriodReports(reports, 'month');
  const selfMemberObj = members.find(m => m.name === user?.name);
  const viewMemberObj = members.find(m => m.name === viewingMember);
  const mineStats: MemberStats | null = viewMemberObj
    ? calcMemberStats(periodReports, viewMemberObj, 'month')
    : null;
  const allMemberStats = members.map(m => calcMemberStats(periodReports, m, 'month'));
  const TEAM_TARGET_SUM = members.reduce((s, m) => s + m.target, 0);
  const teamSummary = calcTeamStats(allMemberStats, TEAM_TARGET_SUM);
  const rankedStats = [...allMemberStats].sort((a, b) => b.acquired - a.acquired);

  // Input tab mini card (uses live monthPlanDays)
  const selfReports = periodReports.filter(r => r.name === user?.name);
  const selfAcquired = selfReports.reduce((s, r) => s + (Number(r.acquired) || 0), 0);
  const selfWorked = selfReports.filter(r => Number(r.visits) > 0).length;
  const selfProductivity = selfWorked > 0 ? selfAcquired / selfWorked : 0;
  const selfRemain = Math.max(monthPlanDays - selfWorked, 0);
  const selfForecast = Math.round(selfProductivity * (selfWorked + selfRemain));
  const selfTarget = selfMemberObj?.target || 0;
  const selfRate = selfTarget > 0 ? Math.round(selfAcquired / selfTarget * 100) : 0;

  // Analysis tab: self conversion rates
  const selfVisits = selfReports.reduce((s, r) => s + (Number(r.visits) || 0), 0);
  const selfNetMeet = selfReports.reduce((s, r) => s + (Number(r.netMeet) || 0), 0);
  const selfMainMeet = selfReports.reduce((s, r) => s + (Number(r.mainMeet) || 0), 0);
  const selfNegotiation = selfReports.reduce((s, r) => s + (Number(r.negotiation) || 0), 0);
  const selfMeetRate = selfVisits > 0 ? Math.round(selfNetMeet / selfVisits * 100) : 0;
  const selfMainRate = selfNetMeet > 0 ? Math.round(selfMainMeet / selfNetMeet * 100) : 0;
  const selfNegRate = selfMainMeet > 0 ? Math.round(selfNegotiation / selfMainMeet * 100) : 0;
  const selfContractRate = selfNegotiation > 0 ? Math.round(selfAcquired / selfNegotiation * 100) : 0;
  const selfTotalRate = selfVisits > 0 ? (selfAcquired / selfVisits * 100).toFixed(2) : '0.00';

  // Analysis tab: team conversion rates
  const { totalVisits: tv, totalNetMeet: tnm, totalMainMeet: tmm,
    totalNegotiation: tn, totalAcquired: ta } = teamSummary;
  const teamMeetRate = tv > 0 ? Math.round(tnm / tv * 100) : 0;
  const teamMainRate = tnm > 0 ? Math.round(tmm / tnm * 100) : 0;
  const teamNegRate = tmm > 0 ? Math.round(tn / tmm * 100) : 0;
  const teamContractRate = tn > 0 ? Math.round(ta / tn * 100) : 0;
  const teamTotalRate = tv > 0 ? (ta / tv * 100).toFixed(2) : '0.00';

  const myRate = mineStats && mineStats.target > 0 ? Math.round(mineStats.acquired / mineStats.target * 100) : 0;
  const teamRate = TEAM_TARGET_SUM > 0 ? Math.round(teamSummary.totalAcquired / TEAM_TARGET_SUM * 100) : 0;
  const isViewingSelf = viewingMember === user?.name;

  const inputCls = "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm mt-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const textareaCls = "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm mt-1 h-20 resize-none text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const formatDate = (s: string) => { const d = new Date(s); return `${d.getMonth() + 1}/${d.getDate()}（${['日', '月', '火', '水', '木', '金', '土'][d.getDay()]}）`; };
  const changeDate = (delta: number) => { const d = new Date(selectedDate); d.setDate(d.getDate() + delta); setSelectedDate(d.toISOString().split('T')[0]); };
  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const hasData = reports.some(r => r.date === selectedDate && r.name === user?.name);
  const actionItems = [
    { key: 'visits', label: '訪問数', color: 'bg-blue-500' },
    { key: 'netMeet', label: '対面数', color: 'bg-purple-500' },
    { key: 'mainMeet', label: '主権対面', color: 'bg-indigo-500' },
    { key: 'negotiation', label: '商談', color: 'bg-orange-500' },
    { key: 'acquired', label: '獲得数', color: 'bg-green-500' },
  ] as const;
  const drawerMenus = [
    { label: '📊 日別稼働', path: '/dashboard/daily' },
    { label: '⚙️ 設定', path: '/dashboard/settings' },
  ];

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
          {user && (user.isManager ? (
            <button onClick={() => setShowMemberPicker(p => !p)}
              className="text-sm bg-yellow-600/30 text-yellow-300 px-2 py-1 rounded flex items-center gap-1">
              {viewingMember} ▾
            </button>
          ) : (
            <span className="text-sm text-gray-300">{user.name}</span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {loading
            ? <span className="text-xs text-gray-400 animate-pulse">同期中...</span>
            : lastUpdated && <span className="text-xs text-gray-500">{lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          }
          <button onClick={() => { localStorage.clear(); router.push('/login'); }}
            className="text-gray-400 text-sm hover:text-white select-none">ログアウト</button>
        </div>
      </div>

      {/* Member picker (manager) */}
      {showMemberPicker && user?.isManager && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex flex-wrap gap-2">
          {members.map(m => (
            <button key={m.id}
              onClick={() => { setViewingMember(m.name); setShowMemberPicker(false); setTab('mine'); }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 select-none
                ${viewingMember === m.name ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-gray-900 flex border-b border-gray-700">
        <div className="flex overflow-x-auto flex-1">
          {(['input', 'mine', 'analysis', 'team'] as const).map((t, i) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm whitespace-nowrap transition-all select-none active:opacity-70
                ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
              {['✏️ 入力', '👤 個人', '🔄 分析', '🏆 全体'][i]}
            </button>
          ))}
        </div>
        <button onClick={() => setShowDrawer(true)} className="px-4 py-3 text-gray-400 hover:text-white shrink-0 border-l border-gray-700 text-lg">☰</button>
      </div>

      <div className="p-4 max-w-2xl mx-auto">

        {/* ===== 入力 ===== */}
        {tab === 'input' && (
          <div className="space-y-4 tab-animate" onFocus={() => { formDirty.current = true; }}>

            {/* Date */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <button onClick={() => changeDate(-1)} className="w-11 h-11 bg-gray-100 rounded-full text-gray-600 font-bold active:scale-90 transition-all duration-150 select-none">‹</button>
                <div className="text-center">
                  <div className="flex items-center gap-2 justify-center">
                    <span className="font-bold text-gray-900 text-lg">{formatDate(selectedDate)}</span>
                    {isToday && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">今日</span>}
                    {hasData && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">入力済み</span>}
                  </div>
                  <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="text-xs text-gray-400 mt-1 border-0 bg-transparent cursor-pointer" />
                </div>
                <button onClick={() => changeDate(1)} disabled={isToday} className="w-11 h-11 bg-gray-100 rounded-full text-gray-600 font-bold active:scale-90 transition-all duration-150 select-none disabled:opacity-30">›</button>
              </div>
            </div>

            {/* 今月の状況 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-gray-800">📊 今月の状況</div>
                <div className={`text-xs font-bold px-2.5 py-1 rounded-full
                  ${selfRate >= 80 ? 'bg-green-100 text-green-700' : selfRate >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-500'}`}>
                  達成率 {selfRate}%
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div className={`h-2 rounded-full transition-all duration-500 ${selfRate >= 80 ? 'bg-green-500' : selfRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(selfRate, 100)}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '獲得件数', value: `${selfAcquired}件`, color: 'text-blue-600' },
                  { label: '稼働日数', value: `${selfWorked}日`, color: '' },
                  { label: '生産性', value: `${selfProductivity.toFixed(2)}件/日`, color: 'text-purple-600' },
                  { label: '残稼働', value: `${selfRemain}日`, color: selfRemain <= 5 ? 'text-red-500' : '' },
                  { label: '着地予測', value: `${selfForecast}件`, color: 'text-orange-500' },
                  { label: '目標', value: `${selfTarget}件`, color: '' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                    <div className="text-xs text-gray-400">{item.label}</div>
                    <div className={`font-bold text-sm mt-0.5 ${item.color || 'text-gray-900'}`}>{item.value}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => { setModalPlanDays(monthPlanDays); setShowPlanModal(true); }}
                className="mt-3 w-full text-xs text-gray-400 text-center py-1 active:opacity-60 select-none">
                計画稼働日数: {monthPlanDays}日（変更する）
              </button>
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

            {/* Save/Copy */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={copyReport}
                className="bg-white border-2 border-blue-600 text-blue-600 font-bold py-4 rounded-2xl text-sm active:scale-95 transition-all duration-150 select-none">
                {copied ? '✅ コピー済み！' : '📋 日報をコピー'}
              </button>
              <button onClick={handleSave} disabled={saving}
                className="bg-blue-600 text-white font-bold py-4 rounded-2xl text-sm active:scale-95 transition-all duration-150 select-none disabled:opacity-50">
                {saving ? '保存中...' : '💾 保存する'}
              </button>
            </div>
          </div>
        )}

        {/* ===== 個人 ===== */}
        {tab === 'mine' && mineStats && (
          <div className="space-y-4 tab-animate">
            {!isViewingSelf && user?.isManager && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-2xl px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-bold text-yellow-700">📋 {viewingMember} の個人ページ</span>
                <button onClick={() => setViewingMember(user!.name)} className="text-xs text-yellow-600 underline">自分に戻る</button>
              </div>
            )}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xl font-bold text-gray-900">{viewingMember}</div>
                  <div className="text-gray-500 text-sm">{viewMemberObj?.role === 'closer' ? 'クローザー' : 'アポインター'} / 目標 {mineStats.target}件</div>
                </div>
                <div className={`text-2xl font-bold ${myRate >= 80 ? 'text-green-600' : myRate >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>{myRate}%</div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div className={`h-3 rounded-full transition-all duration-500 ${myRate >= 80 ? 'bg-green-500' : myRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(myRate, 100)}%` }} />
              </div>
              <div className="divide-y divide-gray-100">
                {[
                  { label: '獲得件数', value: `${mineStats.acquired}件`, color: 'text-blue-600' },
                  { label: '着地予測', value: `${mineStats.forecast}件`, color: mineStats.goalGap >= 0 ? 'text-green-600' : 'text-orange-500' },
                  { label: '目標との差', value: `${mineStats.goalGap >= 0 ? '+' : ''}${mineStats.goalGap}件`, color: mineStats.goalGap >= 0 ? 'text-green-600' : 'text-red-500' },
                  { label: 'ペース差', value: `${mineStats.paceGap >= 0 ? '+' : ''}${mineStats.paceGap.toFixed(1)}件`, color: mineStats.paceGap >= 0 ? 'text-green-600' : 'text-yellow-600' },
                  { label: '今日必要', value: `${mineStats.neededPerDay.toFixed(1)}件/日`, color: mineStats.neededPerDay >= 1.5 ? 'text-red-500' : mineStats.neededPerDay >= 1.0 ? 'text-yellow-600' : 'text-green-600' },
                  { label: '実稼働日数', value: `${mineStats.workedDays}日`, color: '' },
                  { label: '残稼働日数', value: `${mineStats.remainDays}日`, color: mineStats.remainDays <= 5 ? 'text-red-500' : '' },
                  { label: '生産性', value: `${mineStats.productivity.toFixed(2)}件/日`, color: '' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center py-2.5">
                    <span className="text-gray-600 text-sm">{item.label}</span>
                    <span className={`font-bold ${item.color || 'text-gray-900'}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-3">📈 今月の行動量</div>
              {actionItems.map(item => {
                const total = mineStats[item.key as 'visits' | 'netMeet' | 'mainMeet' | 'negotiation' | 'acquired'];
                const avg = mineStats.workedDays > 0 ? (total / mineStats.workedDays).toFixed(1) : '0.0';
                return (
                  <div key={item.key} className="flex justify-between items-center py-2.5 border-b last:border-0">
                    <span className="text-sm text-gray-700">{item.label}</span>
                    <div className="text-right">
                      <span className="font-bold text-gray-900">{total}</span>
                      <span className="text-xs text-gray-400 ml-2">({avg}/日)</span>
                    </div>
                  </div>
                );
              })}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500">対面率</div>
                  <div className="font-bold text-purple-700 text-lg">{Math.round(mineStats.meetRate * 100)}%</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500">獲得率</div>
                  <div className="font-bold text-green-700 text-lg">{Math.round(mineStats.getRate * 100)}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== 分析 ===== */}
        {tab === 'analysis' && (
          <div className="space-y-4 tab-animate">
            <div className="bg-gray-900 text-white rounded-2xl p-4">
              <div className="text-xs text-gray-400 mb-1">{user?.name} の総転換率（今月）</div>
              <div className="text-4xl font-bold text-blue-400">{selfTotalRate}<span className="text-lg ml-1">%</span></div>
              <div className="text-xs text-gray-400 mt-1">{selfVisits}訪問 → {selfAcquired}契約</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-3">👤 自分の転換率</div>
              {[
                { label: '訪問→対面', rate: selfMeetRate, bench: 30, value: selfNetMeet },
                { label: '対面→主権', rate: selfMainRate, bench: 50, value: selfMainMeet },
                { label: '主権→商談', rate: selfNegRate, bench: 40, value: selfNegotiation },
                { label: '商談→契約', rate: selfContractRate, bench: 30, value: selfAcquired },
              ].map(step => {
                const c = step.rate >= step.bench ? 'text-green-600' : step.rate >= step.bench * 0.6 ? 'text-yellow-600' : 'text-red-500';
                return (
                  <div key={step.label} className="flex items-center justify-between py-2.5 border-b last:border-0">
                    <span className="text-sm text-gray-700">{step.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">{step.value}件</span>
                      <span className={`font-bold text-sm ${c}`}>{step.rate}%</span>
                      <span className="text-xs text-gray-300">基準{step.bench}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bg-gray-900 text-white rounded-2xl p-4">
              <div className="text-xs text-gray-400 mb-1">チーム総転換率（今月）</div>
              <div className="text-4xl font-bold text-blue-400">{teamTotalRate}<span className="text-lg ml-1">%</span></div>
              <div className="text-xs text-gray-400 mt-1">{tv}訪問 → {ta}契約</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-3">📊 チーム転換率ファネル</div>
              {[
                { label: '訪問→対面', rate: teamMeetRate, bench: 30, value: tnm },
                { label: '対面→主権', rate: teamMainRate, bench: 50, value: tmm },
                { label: '主権→商談', rate: teamNegRate, bench: 40, value: tn },
                { label: '商談→契約', rate: teamContractRate, bench: 30, value: ta },
              ].map(step => {
                const c = step.rate >= step.bench ? 'text-green-600' : step.rate >= step.bench * 0.6 ? 'text-yellow-600' : 'text-red-500';
                return (
                  <div key={step.label} className="flex items-center justify-between py-2.5 border-b last:border-0">
                    <span className="text-sm text-gray-700">{step.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">{step.value}件</span>
                      <span className={`font-bold text-sm ${c}`}>{step.rate}%</span>
                      <span className="text-xs text-gray-300">基準{step.bench}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="font-bold text-gray-800 p-4 border-b">👥 メンバー別転換率</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800 text-white">
                    <tr>{['氏名', '訪問', '対面率', '獲得率', '総転換'].map(h => <th key={h} className="px-2 py-2 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {allMemberStats.map((m, i) => {
                      const mr = m.visits > 0 ? Math.round(m.meetRate * 100) : 0;
                      const gr = m.netMeet > 0 ? Math.round(m.getRate * 100) : 0;
                      const tr2 = m.visits > 0 ? (m.acquired / m.visits * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={m.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-2 py-2.5 font-bold text-gray-900">{m.name}</td>
                          <td className="px-2 py-2.5 text-gray-600">{m.visits}</td>
                          <td className={`px-2 py-2.5 font-bold ${mr >= 30 ? 'text-green-600' : mr >= 18 ? 'text-yellow-600' : 'text-red-500'}`}>{mr}%</td>
                          <td className={`px-2 py-2.5 font-bold ${gr >= 30 ? 'text-green-600' : gr >= 18 ? 'text-yellow-600' : 'text-red-500'}`}>{gr}%</td>
                          <td className="px-2 py-2.5 font-bold text-blue-600">{tr2}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===== 全体 ===== */}
        {tab === 'team' && (
          <div className="space-y-4 tab-animate">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900 text-white rounded-2xl p-4">
                <div className="text-xs text-gray-400 mb-1">チーム獲得</div>
                <div className="text-3xl font-bold text-blue-400">{teamSummary.totalAcquired}<span className="text-sm text-gray-400 ml-1">件</span></div>
                <div className="text-xs text-gray-400">目標 {TEAM_TARGET_SUM}件</div>
                <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${Math.min(teamRate, 100)}%` }} />
                </div>
                <div className="text-xs text-gray-400 mt-1">{teamRate}%</div>
              </div>
              <div className="bg-gray-900 text-white rounded-2xl p-4">
                <div className="text-xs text-gray-400 mb-1">チーム着地予測</div>
                <div className={`text-3xl font-bold ${teamSummary.teamForecast >= TEAM_TARGET_SUM ? 'text-green-400' : 'text-orange-400'}`}>
                  {teamSummary.teamForecast}<span className="text-sm ml-1 text-gray-400">件</span>
                </div>
                <div className="text-xs text-gray-400">あと {Math.max(TEAM_TARGET_SUM - teamSummary.totalAcquired, 0)}件</div>
                <div className="text-xs mt-1"><span className="text-gray-400">対面率 </span><span className="text-purple-400 font-bold">{teamMeetRate}%</span></div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-3">🏆 獲得件数ランキング</div>
              {rankedStats.map((m, i) => {
                const max = rankedStats[0].acquired || 1;
                const barC = i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-500' : 'bg-blue-500';
                const circC = i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-500' : 'bg-gray-300';
                return (
                  <div key={m.name} className="flex items-center gap-2 py-2 border-b last:border-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${circC}`}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-gray-900">{m.name}</span>
                        <span className="text-sm font-bold text-gray-900 ml-2">{m.acquired}件</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-4">
                        <div className={`${barC} h-4 rounded-full flex items-center justify-end pr-1 transition-all`}
                          style={{ width: `${m.acquired > 0 ? m.acquired / max * 100 : 0}%` }}>
                          {m.acquired > 0 && <span className="text-white text-xs font-bold">{m.acquired}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-3">📊 チーム行動量</div>
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { label: '訪問', val: teamSummary.totalVisits, color: 'bg-blue-50 text-blue-700' },
                  { label: '対面', val: teamSummary.totalNetMeet, color: 'bg-purple-50 text-purple-700' },
                  { label: '主権', val: teamSummary.totalMainMeet, color: 'bg-indigo-50 text-indigo-700' },
                  { label: '商談', val: teamSummary.totalNegotiation, color: 'bg-orange-50 text-orange-700' },
                  { label: '獲得', val: teamSummary.totalAcquired, color: 'bg-green-50 text-green-700' },
                ].map(item => (
                  <div key={item.label} className={`${item.color} rounded-xl p-2`}>
                    <div className="text-xs font-medium">{item.label}</div>
                    <div className="font-bold text-lg">{item.val}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="font-bold text-gray-800 p-4 border-b">📋 メンバー別数値</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800 text-white">
                    <tr>{['氏名', '目標', '現在', '着地', '達成率', '生産性', '稼働', '対面率', '獲得率'].map(h => <th key={h} className="px-2 py-2 text-left whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rankedStats.map((m, i) => {
                      const rate = m.target > 0 ? Math.round(m.acquired / m.target * 100) : 0;
                      const mr = Math.round(m.meetRate * 100);
                      const gr = Math.round(m.getRate * 100);
                      return (
                        <tr key={m.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-2 py-2 font-bold text-gray-900">{m.name}</td>
                          <td className="px-2 py-2 text-gray-600">{m.target}</td>
                          <td className="px-2 py-2 font-bold text-blue-600">{m.acquired}</td>
                          <td className="px-2 py-2 font-bold text-orange-500">{m.forecast}</td>
                          <td className="px-2 py-2"><span className={`font-bold ${rate >= 80 ? 'text-green-600' : rate >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{rate}%</span></td>
                          <td className="px-2 py-2 text-gray-600">{m.productivity.toFixed(2)}</td>
                          <td className="px-2 py-2 text-gray-600">{m.workedDays}日</td>
                          <td className="px-2 py-2 text-purple-600">{mr}%</td>
                          <td className="px-2 py-2 text-green-600">{gr}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="px-2 py-2 text-gray-900">合計</td>
                      <td className="px-2 py-2">{TEAM_TARGET_SUM}</td>
                      <td className="px-2 py-2 text-blue-600">{teamSummary.totalAcquired}</td>
                      <td className="px-2 py-2 text-orange-500">{teamSummary.teamForecast}</td>
                      <td className="px-2 py-2">{teamRate}%</td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowDrawer(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-gray-900 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
              <div className="text-white font-bold text-sm">メニュー</div>
              <button onClick={() => setShowDrawer(false)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {drawerMenus.map(item => (
                <button key={item.label} onClick={() => { router.push(item.path); setShowDrawer(false); }}
                  className="w-full text-left px-4 py-3 text-white active:bg-gray-700 rounded-xl text-sm font-medium transition-colors select-none">
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
