'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBERS, TEAM_TARGET } from '@/lib/members';
import { saveReport, getReports } from '@/lib/api';

type Tab = 'input' | 'mine' | 'analysis' | 'team';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('input');
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [viewingMember, setViewingMember] = useState('');
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState({
    visits: 0, netMeet: 0, mainMeet: 0, negotiation: 0, acquired: 0,
    startTime: '', endTime: '',
    acquiredCase: '', lostCase: '',
    goodPoints: '', issues: '', improvements: '', learnings: '',
    gratitude: '', planDays: 20,
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
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    const parsed = JSON.parse(u);
    setUser(parsed);
    setViewingMember(parsed.name);
    const stored = localStorage.getItem('reports');

    if (stored) setReports(JSON.parse(stored));
    loadReports();
  }, []);

  useEffect(() => {
    if (!user) return;
    const existing = reports.find(r => r.date === selectedDate && r.name === user.name);
    if (existing) {
      setForm({
        visits: Number(existing.visits)||0, netMeet: Number(existing.netMeet)||0,
        mainMeet: Number(existing.mainMeet)||0, negotiation: Number(existing.negotiation)||0,
        acquired: Number(existing.acquired)||0, startTime: existing.startTime||'',
        endTime: existing.endTime||'', acquiredCase: existing.acquiredCase||'',
        lostCase: existing.lostCase||'', goodPoints: existing.goodPoints||'',
        issues: existing.issues||'', improvements: existing.improvements||'',
        learnings: existing.learnings||'', gratitude: existing.gratitude||'',
        planDays: Number(existing.planDays)||20,
      });
    } else {
      setForm({ visits:0,netMeet:0,mainMeet:0,negotiation:0,acquired:0,startTime:'',endTime:'',
        acquiredCase:'',lostCase:'',goodPoints:'',issues:'',improvements:'',learnings:'',gratitude:'',planDays:20 });
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
      const updated = [...reports.filter(r => !(r.date===selectedDate && r.name===user?.name)), report];
      setReports(updated);
      localStorage.setItem('reports', JSON.stringify(updated));
      alert('保存しました！（オフライン）');
    } finally { setSaving(false); }
  };

  const copyReport = () => {
    const d = new Date(selectedDate);
    const dateStr = `${d.getMonth()+1}/${d.getDate()}（${['日','月','火','水','木','金','土'][d.getDay()]}）`;
    const lines = [`【${user?.name} 日報 ${dateStr}】`,``,`■ 稼働時間`,`${form.startTime||'--:--'} 〜 ${form.endTime||'--:--'}`,``,`■ 行動量`,`訪問：${form.visits}　対面：${form.netMeet}　主権：${form.mainMeet}　商談：${form.negotiation}　獲得：${form.acquired}`,``];
    if (form.acquiredCase) lines.push(`■ 獲得案件\n${form.acquiredCase}\n`);
    if (form.lostCase) lines.push(`■ 失注案件\n${form.lostCase}\n`);
    if (form.goodPoints) lines.push(`■ よかった点\n${form.goodPoints}\n`);
    if (form.issues) lines.push(`■ 課題・失敗\n${form.issues}\n`);
    if (form.improvements) lines.push(`■ 明日の改善\n${form.improvements}\n`);
    if (form.learnings) lines.push(`■ 学び\n${form.learnings}\n`);
    if (form.gratitude) lines.push(`■ 感謝\n${form.gratitude}\n`);
    navigator.clipboard.writeText(lines.join('\n')).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };

  const thisMonth = new Date().toISOString().slice(0,7);
  const viewTarget = viewingMember || user?.name || '';
  const isViewingSelf = viewTarget === user?.name;
  const myReports = reports.filter(r => r.name===viewTarget && r.date?.startsWith(thisMonth));
  const myAcquired = myReports.reduce((s,r)=>s+(Number(r.acquired)||0),0);
  const myMember = MEMBERS.find(m=>m.name===viewTarget);
  const myTarget = myMember?.target||0;
  const myRate = myTarget>0 ? Math.round(myAcquired/myTarget*100) : 0;
  const workedDays = myReports.filter(r=>Number(r.visits)>0).length;
  const productivity = workedDays>0 ? (myAcquired/workedDays).toFixed(2) : '0.00';
  const planDaysForView = isViewingSelf ? (form.planDays||20) : (Number(myReports.find(r=>r.planDays)?.planDays)||20);
  const remainDays = Math.max(planDaysForView-workedDays,0);
  const forecast = Math.round(Number(productivity)*(workedDays+remainDays));

  const teamStats = MEMBERS.map(m => {
    const mR = reports.filter(r=>r.name===m.name && r.date?.startsWith(thisMonth));
    const acquired = mR.reduce((s,r)=>s+(Number(r.acquired)||0),0);
    const worked = mR.filter(r=>Number(r.visits)>0).length;
    const visits = mR.reduce((s,r)=>s+(Number(r.visits)||0),0);
    const netMeet = mR.reduce((s,r)=>s+(Number(r.netMeet)||0),0);
    const mainMeet = mR.reduce((s,r)=>s+(Number(r.mainMeet)||0),0);
    const negotiation = mR.reduce((s,r)=>s+(Number(r.negotiation)||0),0);
    const prod = worked>0 ? acquired/worked : 0;
    const remain = Math.max(20-worked,0);
    const fc = Math.round(prod*(worked+remain));
    const rate = m.target>0 ? Math.round(acquired/m.target*100) : 0;
    const meetRate = visits>0 ? Math.round(netMeet/visits*100) : 0;
    const getRate = netMeet>0 ? Math.round(acquired/netMeet*100) : 0;
    return { ...m, acquired, worked, visits, netMeet, mainMeet, negotiation, prod: prod.toFixed(2), remain, forecast: fc, rate, meetRate, getRate };
  }).sort((a,b)=>b.acquired-a.acquired);

  const totalAcquired = teamStats.reduce((s,m)=>s+m.acquired,0);
  const teamForecast = teamStats.reduce((s,m)=>s+m.forecast,0);
  const teamRate = Math.round(totalAcquired/TEAM_TARGET*100);
  const totalVisits = teamStats.reduce((s,m)=>s+m.visits,0);
  const totalNetMeet = teamStats.reduce((s,m)=>s+m.netMeet,0);
  const totalMainMeet = teamStats.reduce((s,m)=>s+m.mainMeet,0);
  const totalNegotiation = teamStats.reduce((s,m)=>s+m.negotiation,0);
  const teamMeetRate = totalVisits>0 ? Math.round(totalNetMeet/totalVisits*100) : 0;
  const teamMainRate = totalNetMeet>0 ? Math.round(totalMainMeet/totalNetMeet*100) : 0;
  const teamNegRate = totalMainMeet>0 ? Math.round(totalNegotiation/totalMainMeet*100) : 0;
  const teamContractRate = totalNegotiation>0 ? Math.round(totalAcquired/totalNegotiation*100) : 0;

  const inputStyle = "w-full border border-gray-300 rounded px-3 py-2 text-sm mt-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const textareaStyle = "w-full border border-gray-300 rounded px-3 py-2 text-sm mt-1 h-20 resize-none text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const formatDate = (s:string) => { const d=new Date(s); return `${d.getMonth()+1}/${d.getDate()}（${['日','月','火','水','木','金','土'][d.getDay()]}）`; };
  const changeDate = (delta:number) => { const d=new Date(selectedDate); d.setDate(d.getDate()+delta); setSelectedDate(d.toISOString().split('T')[0]); };
  const isToday = selectedDate===new Date().toISOString().split('T')[0];
  const hasData = reports.some(r=>r.date===selectedDate && r.name===user?.name);
  const actionItems = [
    {key:'visits',label:'訪問数',color:'bg-blue-500'},
    {key:'netMeet',label:'対面数',color:'bg-purple-500'},
    {key:'mainMeet',label:'主権対面',color:'bg-indigo-500'},
    {key:'negotiation',label:'商談',color:'bg-orange-500'},
    {key:'acquired',label:'獲得数',color:'bg-green-500'},
  ];

  const tabs = [
    {id:'input',    label:'✏️ 入力'},
    {id:'mine',     label:'👤 個人'},
    {id:'analysis', label:'🔄 分析'},
    {id:'team',     label:'🏆 全体'},
  ];

  const drawerMenus = [
    {label:'📅 シフト提出',     path:'/dashboard/shift?view=submit'},
    {label:'📊 日別稼働',       path:'/dashboard/stats'},
    {label:'📝 日報管理',       path:'/dashboard/reports'},
    {label:'✅ シフト提出確認', path:'/dashboard/shift?view=confirm'},
    {label:'⚙️ 設定',           path:'/dashboard/settings'},
    {label:'📋 提出確認',       path:'/dashboard/reports'},
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-bold text-blue-400 text-lg">TOP</div>
          <span className="text-sm bg-gray-700 px-2 py-1 rounded">{thisMonth.replace('-','/')}</span>
          {user && (
            user?.isManager ? (
              <button onClick={()=>setShowMemberPicker(p=>!p)}
                className="text-sm bg-yellow-600/30 text-yellow-300 px-2 py-1 rounded flex items-center gap-1">
                {viewTarget} ▾
              </button>
            ) : (
              <span className="text-sm text-gray-300">{user.name}</span>
            )
          )}
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-xs text-gray-400">同期中...</span>}
          <button onClick={()=>{localStorage.clear();router.push('/login');}} className="text-gray-400 text-sm hover:text-white">ログアウト</button>
        </div>
      </div>

      {/* 責任者：メンバー選択ドロップダウン */}
      {showMemberPicker && user?.isManager && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex flex-wrap gap-2">
          {MEMBERS.map(m=>(
            <button key={m.id}
              onClick={()=>{ setViewingMember(m.name); setShowMemberPicker(false); setTab('mine'); }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 select-none ${viewTarget===m.name?'bg-blue-600 text-white':'bg-gray-700 text-gray-300'}`}>
              {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="bg-gray-900 flex border-b border-gray-700">
        <div className="flex overflow-x-auto flex-1">
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id as Tab)}
              className={`px-4 py-3 text-sm whitespace-nowrap transition-all select-none active:opacity-70 ${tab===t.id?'bg-blue-600 text-white':'text-gray-400'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={()=>setShowDrawer(true)} className="px-4 py-3 text-gray-400 hover:text-white shrink-0 border-l border-gray-700 text-lg">
          ☰
        </button>
      </div>

      <div className="p-4 max-w-2xl mx-auto">

        {/* ===== 入力タブ ===== */}
        {tab==='input' && (
          <div className="space-y-4 tab-animate">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <button onClick={()=>changeDate(-1)} className="w-11 h-11 bg-gray-100 rounded-full text-gray-600 font-bold active:scale-90 transition-all duration-150 select-none">‹</button>
                <div className="text-center">
                  <div className="flex items-center gap-2 justify-center">
                    <span className="font-bold text-gray-900 text-lg">{formatDate(selectedDate)}</span>
                    {isToday && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">今日</span>}
                    {hasData && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">入力済み</span>}
                  </div>
                  <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="text-xs text-gray-400 mt-1 border-0 bg-transparent cursor-pointer" />
                </div>
                <button onClick={()=>changeDate(1)} disabled={isToday} className="w-11 h-11 bg-gray-100 rounded-full text-gray-600 font-bold active:scale-90 transition-all duration-150 select-none disabled:opacity-30">›</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-3">⏰ 稼働時間</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium text-gray-700">開始</label><input type="time" value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})} className={inputStyle}/></div>
                <div><label className="text-sm font-medium text-gray-700">終了</label><input type="time" value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})} className={inputStyle}/></div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-3">📊 行動量</div>
              {actionItems.map(item=>(
                <div key={item.key} className="flex items-center justify-between py-3 border-b last:border-0 gap-3">
                  <span className="text-sm font-medium text-gray-800 w-20 shrink-0">{item.label}</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <button onClick={()=>setForm({...form,[item.key]:Math.max(0,(form as any)[item.key]-1)})} className="w-11 h-11 bg-gray-200 rounded-full text-gray-700 font-bold text-lg active:scale-90 transition-all duration-150 select-none">−</button>
                    <input type="number" min="0" value={(form as any)[item.key]} onChange={e=>setForm({...form,[item.key]:Math.max(0,parseInt(e.target.value)||0)})} className="w-16 text-center font-bold text-xl text-gray-900 border border-gray-300 rounded-xl py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    <button onClick={()=>setForm({...form,[item.key]:(form as any)[item.key]+1})} className={`w-11 h-11 ${item.color} rounded-full text-white font-bold text-lg active:scale-90 transition-all duration-150 select-none`}>＋</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-3">📝 日報</div>
              {[
                {key:'acquiredCase',label:'🏆 獲得案件',ph:'お客さんの属性・角度感・フックを詳しく'},
                {key:'lostCase',label:'😅 失注案件',ph:'失注の詳細（なければ「なし」）'},
                {key:'goodPoints',label:'✅ よかった点',ph:'今日のよかった点を具体的に'},
                {key:'issues',label:'❌ 課題・失敗',ph:'課題や失敗を正直に'},
                {key:'improvements',label:'📌 明日の改善',ph:'明日に活かす改善点'},
                {key:'learnings',label:'💡 学び・気づき',ph:'今日の学び・新発見'},
                {key:'gratitude',label:'🙏 感謝（任意）',ph:'チームへの感謝や共有したいこと'},
              ].map(item=>(
                <div key={item.key} className="mb-4">
                  <label className="text-sm font-bold text-gray-700">{item.label}</label>
                  <textarea value={(form as any)[item.key]} onChange={e=>setForm({...form,[item.key]:e.target.value})} placeholder={item.ph} className={textareaStyle}/>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-2">📅 計画稼働日数</div>
              <input type="number" value={form.planDays} onChange={e=>setForm({...form,planDays:+e.target.value})} className={inputStyle}/>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={copyReport} className="bg-white border-2 border-blue-600 text-blue-600 font-bold py-4 rounded-2xl text-sm active:scale-95 transition-all duration-150 select-none">
                {copied?'✅ コピー済み！':'📋 日報をコピー'}
              </button>
              <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white font-bold py-4 rounded-2xl text-sm active:scale-95 transition-all duration-150 select-none disabled:opacity-50">
                {saving?'保存中...':'💾 保存する'}
              </button>
            </div>
          </div>
        )}

        {/* ===== 自分タブ ===== */}
        {tab==='mine' && (
          <div className="space-y-4 tab-animate">
            {!isViewingSelf && user?.isManager && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-2xl px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-bold text-yellow-700">📋 {viewTarget} の個人ページ</span>
                <button onClick={()=>{ setViewingMember(user.name); }}
                  className="text-xs text-yellow-600 underline">自分に戻る</button>
              </div>
            )}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xl font-bold text-gray-900">{viewTarget}</div>
                  <div className="text-gray-500 text-sm">{myMember?.role==='closer'?'クローザー':'アポインター'} / 目標 {myTarget}件</div>
                </div>
                <div className={`text-2xl font-bold ${myRate>=80?'text-green-600':myRate>=50?'text-yellow-500':'text-red-500'}`}>{myRate}%</div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div className={`h-3 rounded-full ${myRate>=80?'bg-green-500':myRate>=50?'bg-yellow-500':'bg-red-500'}`} style={{width:`${Math.min(myRate,100)}%`}}/>
              </div>
              {[
                {label:'獲得件数',value:`${myAcquired}件`,color:'text-blue-600'},
                {label:'着地予測',value:`${forecast}件`,color:'text-orange-500'},
                {label:'実稼働日数',value:`${workedDays}日`},
                {label:'残稼働日数',value:`${remainDays}日`,color:remainDays<=5?'text-red-500':''},
                {label:'生産性',value:`${productivity}件/日`},
              ].map(item=>(
                <div key={item.label} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="text-gray-600 text-sm">{item.label}</span>
                  <span className={`font-bold ${item.color||'text-gray-900'}`}>{item.value}</span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-3">📈 今月の行動量</div>
              {actionItems.map(item=>{
                const total = myReports.reduce((s,r)=>s+(Number(r[item.key])||0),0);
                const avg = workedDays>0?(total/workedDays).toFixed(1):'0.0';
                return (
                  <div key={item.key} className="flex justify-between items-center py-2 border-b last:border-0">
                    <span className="text-sm text-gray-700">{item.label}</span>
                    <div className="text-right">
                      <span className="font-bold text-gray-900">{total}</span>
                      <span className="text-xs text-gray-400 ml-2">({avg}/日)</span>
                    </div>
                  </div>
                );
              })}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">対面率</div>
                  <div className="font-bold text-purple-700">{myReports.reduce((s,r)=>s+(Number(r.visits)||0),0)>0?Math.round(myReports.reduce((s,r)=>s+(Number(r.netMeet)||0),0)/myReports.reduce((s,r)=>s+(Number(r.visits)||0),0)*100):0}%</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500">獲得率</div>
                  <div className="font-bold text-green-700">{myReports.reduce((s,r)=>s+(Number(r.netMeet)||0),0)>0?Math.round(myAcquired/myReports.reduce((s,r)=>s+(Number(r.netMeet)||0),0)*100):0}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== 全体タブ ===== */}
        {tab==='team' && (
          <div className="space-y-4 tab-animate">
            {/* チームKPI */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900 text-white rounded-2xl p-4">
                <div className="text-xs text-gray-400 mb-1">チーム獲得</div>
                <div className="text-3xl font-bold text-blue-400">{totalAcquired}<span className="text-sm text-gray-400 ml-1">件</span></div>
                <div className="text-xs text-gray-400">目標 {TEAM_TARGET}件</div>
                <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-400 h-2 rounded-full" style={{width:`${Math.min(teamRate,100)}%`}}/>
                </div>
                <div className="text-xs text-gray-400 mt-1">{teamRate}%</div>
              </div>
              <div className="bg-gray-900 text-white rounded-2xl p-4">
                <div className="text-xs text-gray-400 mb-1">チーム着地予測</div>
                <div className={`text-3xl font-bold ${teamForecast>=TEAM_TARGET?'text-green-400':'text-orange-400'}`}>{teamForecast}<span className="text-sm ml-1 text-gray-400">件</span></div>
                <div className="text-xs text-gray-400">目標まであと {Math.max(TEAM_TARGET-totalAcquired,0)}件</div>
                <div className="text-xs mt-1">
                  <span className="text-gray-400">対面率 </span>
                  <span className="text-purple-400 font-bold">{totalVisits>0?Math.round(totalNetMeet/totalVisits*100):0}%</span>
                </div>
              </div>
            </div>

            {/* ランキング */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-3">🏆 獲得件数ランキング</div>
              {teamStats.map((m,i)=>{
                const max = teamStats[0].acquired||1;
                const barColors = ['bg-red-500','bg-orange-400','bg-yellow-500'];
                const barColor = i<3 ? barColors[i] : 'bg-blue-500';
                return (
                  <div key={m.id} className="flex items-center gap-2 py-2 border-b last:border-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${i===0?'bg-yellow-500':i===1?'bg-gray-400':i===2?'bg-orange-600':'bg-gray-300'}`}>{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-gray-900">{m.name}</span>
                        <span className="text-sm font-bold text-gray-900 ml-2">{m.acquired}件</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-4">
                        <div className={`${barColor} h-4 rounded-full flex items-center justify-end pr-1 transition-all`} style={{width:`${m.acquired>0?m.acquired/max*100:0}%`}}>
                          {m.acquired>0 && <span className="text-white text-xs font-bold">{m.acquired}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* チーム行動量 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-3">📊 チーム行動量</div>
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  {label:'訪問',val:totalVisits,color:'bg-blue-50 text-blue-700'},
                  {label:'対面',val:totalNetMeet,color:'bg-purple-50 text-purple-700'},
                  {label:'主権',val:teamStats.reduce((s,m)=>s+m.mainMeet,0),color:'bg-indigo-50 text-indigo-700'},
                  {label:'商談',val:teamStats.reduce((s,m)=>s+m.negotiation,0),color:'bg-orange-50 text-orange-700'},
                  {label:'獲得',val:totalAcquired,color:'bg-green-50 text-green-700'},
                ].map(item=>(
                  <div key={item.label} className={`${item.color} rounded-lg p-2`}>
                    <div className="text-xs font-medium">{item.label}</div>
                    <div className="font-bold text-lg">{item.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* メンバー別テーブル */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="font-bold text-gray-800 p-4 border-b">📋 メンバー別数値</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800 text-white">
                    <tr>
                      {['氏名','目標','現在','着地','達成率','生産性','稼働','対面率','獲得率'].map(h=>(
                        <th key={h} className="px-2 py-2 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teamStats.map((m,i)=>(
                      <tr key={m.id} className={i%2===0?'bg-white':'bg-gray-50'}>
                        <td className="px-2 py-2 font-bold text-gray-900">{m.name}</td>
                        <td className="px-2 py-2 text-gray-600">{m.target}</td>
                        <td className="px-2 py-2 font-bold text-blue-600">{m.acquired}</td>
                        <td className="px-2 py-2 font-bold text-orange-500">{m.forecast}</td>
                        <td className="px-2 py-2"><span className={`font-bold ${m.rate>=80?'text-green-600':m.rate>=50?'text-yellow-600':'text-red-500'}`}>{m.rate}%</span></td>
                        <td className="px-2 py-2 text-gray-600">{m.prod}</td>
                        <td className="px-2 py-2 text-gray-600">{m.worked}日</td>
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
                      <td className="px-2 py-2 text-orange-500">{teamForecast}</td>
                      <td className="px-2 py-2">{teamRate}%</td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===== 分析タブ ===== */}
        {tab==='analysis' && (
          <div className="space-y-4 tab-animate">
            <div className="bg-gray-900 text-white rounded-2xl p-4">
              <div className="text-xs text-gray-400 mb-1">総転換率（訪問→契約）</div>
              <div className="text-4xl font-bold text-blue-400">
                {totalVisits>0?(totalAcquired/totalVisits*100).toFixed(2):'0.00'}
                <span className="text-lg ml-1">%</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">{totalVisits}訪問 → {totalAcquired}契約</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-3">📊 チーム転換率ファネル</div>
              {[
                {label:'訪問→対面', rate:teamMeetRate,  bench:30, value:totalNetMeet},
                {label:'対面→主権', rate:teamMainRate,  bench:50, value:totalMainMeet},
                {label:'主権→商談', rate:teamNegRate,   bench:40, value:totalNegotiation},
                {label:'商談→契約', rate:teamContractRate, bench:30, value:totalAcquired},
              ].map(step=>{
                const textColor = step.rate>=step.bench?'text-green-600':step.rate>=step.bench*0.6?'text-yellow-600':'text-red-500';
                return (
                  <div key={step.label} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm text-gray-700">{step.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">{step.value}件</span>
                      <span className={`font-bold text-sm ${textColor}`}>{step.rate}%</span>
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
                    <tr>
                      {['氏名','訪問','対面率','獲得率','総転換'].map(h=>(
                        <th key={h} className="px-2 py-2 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teamStats.map((m,i)=>(
                      <tr key={m.id} className={i%2===0?'bg-white':'bg-gray-50'}>
                        <td className="px-2 py-2 font-bold text-gray-900">{m.name}</td>
                        <td className="px-2 py-2 text-gray-600">{m.visits}</td>
                        <td className={`px-2 py-2 font-bold ${m.meetRate>=30?'text-green-600':m.meetRate>=18?'text-yellow-600':'text-red-500'}`}>{m.meetRate}%</td>
                        <td className={`px-2 py-2 font-bold ${m.getRate>=30?'text-green-600':m.getRate>=18?'text-yellow-600':'text-red-500'}`}>{m.getRate}%</td>
                        <td className="px-2 py-2 font-bold text-blue-600">{m.visits>0?(m.acquired/m.visits*100).toFixed(1):'0.0'}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ===== ドロワーメニュー ===== */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={()=>setShowDrawer(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-gray-900 shadow-2xl flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
              <div className="text-white font-bold text-sm">メニュー</div>
              <button onClick={()=>setShowDrawer(false)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {drawerMenus.map(item=>(
                <button key={item.label}
                  onClick={()=>{ router.push(item.path); setShowDrawer(false); }}
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
