'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBERS as DEFAULT_MEMBERS, Member, Team, MonthlyPlan } from '@/lib/members';
import { loadMembers, saveMembers } from '@/lib/memberStore';
import {
  getMembersFromGAS, saveMembersToGAS, updatePasswordInGAS,
  getTeams, saveTeam, deleteTeam,
  getMonthlyPlans, saveMonthlyPlan,
} from '@/lib/api';

const thisMonth = new Date().toISOString().slice(0, 7);

const ROLE_LABELS: Record<string, string> = {
  closer: 'クローザー',
  appointer: 'アポインター',
  leader: 'リーダー',
};

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; role: Member['role']; target: number; isManager: boolean; teamId: string }>({
    name: '', role: 'closer', target: 15, isManager: false, teamId: '',
  });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<{ name: string; role: Member['role']; target: number; isManager: boolean; teamId: string }>({
    name: '', role: 'closer', target: 15, isManager: false, teamId: '',
  });
  const [savedMsg, setSavedMsg] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [teamSaving, setTeamSaving] = useState(false);

  // 月次計画
  const [planMonth, setPlanMonth] = useState(thisMonth);
  const [plans, setPlans] = useState<Record<string, { planDays: number; monthlyTarget: number }>>({});
  const [planSaving, setPlanSaving] = useState(false);

  // パスワード変更
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwChanging, setPwChanging] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    const parsed = JSON.parse(u);
    setUser(parsed);
    setMembers(loadMembers());
    getMembersFromGAS().then(data => {
      if (data.length > 0) { localStorage.setItem('members', JSON.stringify(data)); setMembers(data); }
    });
    if (parsed.isManager) {
      getTeams().then(t => setTeams(t));
    }
  }, []);

  useEffect(() => {
    if (!user?.isManager) return;
    getMonthlyPlans(planMonth).then(data => {
      const map: Record<string, { planDays: number; monthlyTarget: number }> = {};
      data.forEach(p => { map[p.memberId] = { planDays: Number(p.planDays) || 20, monthlyTarget: Number(p.monthlyTarget) || 0 }; });
      // フォールバック: 未設定メンバーはメンバー設定から初期値
      members.forEach(m => {
        if (!map[m.id]) map[m.id] = { planDays: m.planDays || 20, monthlyTarget: m.target || 0 };
      });
      setPlans(map);
    });
  }, [planMonth, user, members.length]);

  const flash = (msg = '保存しました') => { setSavedMsg(msg); setTimeout(() => setSavedMsg(''), 2500); };

  const syncMembers = (updated: Member[]) => {
    setMembers(updated);
    saveMembers(updated);
    saveMembersToGAS(updated);
  };

  // ── パスワード変更 ─────────────────────────────────────
  const changePassword = async () => {
    setPwError('');
    if (!pwForm.current) { setPwError('現在のパスワードを入力してください'); return; }
    if (pwForm.next.length < 4) { setPwError('新パスワードは4文字以上にしてください'); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError('新パスワードが一致しません'); return; }
    setPwChanging(true);
    const result = await updatePasswordInGAS(user.id, pwForm.current, pwForm.next);
    setPwChanging(false);
    if (result.success) { setPwForm({ current: '', next: '', confirm: '' }); flash('パスワードを変更しました'); }
    else setPwError(result.error || 'パスワードの変更に失敗しました');
  };

  // ── メンバー管理 ────────────────────────────────────────
  const startEdit = (m: Member) => {
    setEditingId(m.id);
    setEditForm({ name: m.name, role: m.role, target: m.target, isManager: m.isManager || false, teamId: m.teamId || '' });
    setShowAdd(false);
  };

  const saveEdit = () => {
    const isManager = editForm.role === 'leader' ? true : editForm.isManager;
    const updated = members.map(m => m.id === editingId ? { ...m, ...editForm, isManager } : m);
    syncMembers(updated);
    setEditingId(null);
    flash();
  };

  const deleteMember = (id: string) => {
    if (!confirm('このメンバーを削除しますか？')) return;
    syncMembers(members.filter(m => m.id !== id));
    flash('削除しました');
  };

  const addMember = () => {
    if (!addForm.name.trim()) return;
    const isManager = addForm.role === 'leader' ? true : addForm.isManager;
    const newMember: Member = {
      id: addForm.name.trim() + '_' + Date.now(),
      name: addForm.name.trim(),
      role: addForm.role,
      target: addForm.target,
      isManager,
      teamId: addForm.teamId || undefined,
    };
    syncMembers([...members, newMember]);
    setShowAdd(false);
    setAddForm({ name: '', role: 'closer', target: 15, isManager: false, teamId: '' });
    flash('追加しました（初期パスワード: top2024）');
  };

  // ── チーム管理 ──────────────────────────────────────────
  const addTeam = async () => {
    if (!newTeamName.trim()) return;
    setTeamSaving(true);
    const result = await saveTeam({ teamName: newTeamName.trim() });
    if (result.success && result.teamId) {
      const newTeam: Team = { teamId: result.teamId, teamName: newTeamName.trim() };
      setTeams(prev => [...prev, newTeam]);
      setNewTeamName('');
      flash('チームを追加しました');
    }
    setTeamSaving(false);
  };

  const removeTeam = async (teamId: string) => {
    if (!confirm('このチームを削除しますか？\nメンバーのチーム割り当ては解除されます。')) return;
    await deleteTeam(teamId);
    setTeams(prev => prev.filter(t => t.teamId !== teamId));
    const updated = members.map(m => m.teamId === teamId ? { ...m, teamId: undefined } : m);
    syncMembers(updated);
    flash('チームを削除しました');
  };

  // ── 月次計画保存 ────────────────────────────────────────
  const savePlans = async () => {
    if (!user) return;
    setPlanSaving(true);
    await Promise.all(
      members.map(m => {
        const p = plans[m.id];
        if (!p) return Promise.resolve();
        return saveMonthlyPlan({
          memberId: m.id, month: planMonth,
          planDays: p.planDays, monthlyTarget: p.monthlyTarget,
          submittedBy: user.name,
        } as MonthlyPlan);
      })
    );
    setPlanSaving(false);
    flash('月次計画を保存しました');
  };

  const setPlan = (memberId: string, field: 'planDays' | 'monthlyTarget', value: number) => {
    setPlans(prev => ({ ...prev, [memberId]: { ...prev[memberId], [field]: value } }));
  };

  const teamTarget = members.reduce((s, m) => s + m.target, 0);
  const fieldClass = "w-full mt-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const pwFieldClass = "w-full mt-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900";

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 text-sm active:opacity-60 transition-opacity select-none">← 戻る</button>
        <div className="font-bold text-blue-400">設定</div>
        {savedMsg && <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full ml-auto">{savedMsg}</span>}
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4 page-animate">

        {/* パスワード変更 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="font-bold text-gray-800">🔑 パスワード変更</div>
          <div>
            <label className="text-xs text-gray-600 font-medium">現在のパスワード</label>
            <input type="password" value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} className={pwFieldClass} placeholder="現在のパスワード" />
          </div>
          <div>
            <label className="text-xs text-gray-600 font-medium">新しいパスワード（4文字以上）</label>
            <input type="password" value={pwForm.next} onChange={e => setPwForm({ ...pwForm, next: e.target.value })} className={pwFieldClass} placeholder="新しいパスワード" />
          </div>
          <div>
            <label className="text-xs text-gray-600 font-medium">新しいパスワード（確認）</label>
            <input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} className={pwFieldClass} placeholder="もう一度入力" />
          </div>
          {pwError && <p className="text-red-500 text-xs">{pwError}</p>}
          <button onClick={changePassword} disabled={pwChanging || !pwForm.current || !pwForm.next || !pwForm.confirm}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-all duration-150 select-none disabled:opacity-40">
            {pwChanging ? '変更中...' : 'パスワードを変更する'}
          </button>
        </div>

        {/* 以下は責任者のみ */}
        {user?.isManager && (
          <>
            {/* チーム概要 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <div className="font-bold text-gray-800">チーム概要</div>
                <div className="text-xs text-gray-400 mt-0.5">メンバー {members.length}名 / チーム {teams.length}個</div>
              </div>
              <div className="text-sm text-gray-500">月間目標 <span className="font-bold text-blue-600 text-lg">{teamTarget}</span> 件</div>
            </div>

            {/* メンバー管理 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="font-bold text-gray-800 p-4 border-b flex items-center justify-between">
                <span>メンバー管理</span>
                <button onClick={() => { setShowAdd(v => !v); setEditingId(null); }}
                  className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full active:scale-95 transition-all duration-150 select-none font-bold">
                  {showAdd ? '✕ 閉じる' : '＋ 追加'}
                </button>
              </div>

              {showAdd && (
                <div className="p-4 bg-blue-50 border-b space-y-3">
                  <div className="font-bold text-blue-800 text-sm">新規メンバー追加</div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium">氏名</label>
                    <input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} className={fieldClass} placeholder="例：山田" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600 font-medium">役割</label>
                      <select value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value as Member['role'] })} className={fieldClass}>
                        <option value="closer">クローザー</option>
                        <option value="appointer">アポインター</option>
                        <option value="leader">リーダー</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 font-medium">月間目標（件）</label>
                      <input type="number" value={addForm.target} onChange={e => setAddForm({ ...addForm, target: +e.target.value })} className={fieldClass} />
                    </div>
                  </div>
                  {teams.length > 0 && (
                    <div>
                      <label className="text-xs text-gray-600 font-medium">チーム</label>
                      <select value={addForm.teamId} onChange={e => setAddForm({ ...addForm, teamId: e.target.value })} className={fieldClass}>
                        <option value="">未割り当て</option>
                        {teams.map(t => <option key={t.teamId} value={t.teamId}>{t.teamName}</option>)}
                      </select>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">初期パスワード: top2024</p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAdd(false)} className="flex-1 border border-gray-300 text-gray-600 font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-all select-none">キャンセル</button>
                    <button onClick={addMember} disabled={!addForm.name.trim()} className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-all select-none disabled:opacity-40">追加する</button>
                  </div>
                </div>
              )}

              {members.map((m, i) => (
                <div key={m.id} className={`border-b last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                  {editingId === m.id ? (
                    <div className="p-4 space-y-3 bg-yellow-50">
                      <div className="font-bold text-yellow-800 text-sm">✏️ 編集中</div>
                      <div>
                        <label className="text-xs text-gray-600 font-medium">氏名</label>
                        <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className={fieldClass} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-600 font-medium">役割</label>
                          <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value as Member['role'] })} className={fieldClass}>
                            <option value="closer">クローザー</option>
                            <option value="appointer">アポインター</option>
                            <option value="leader">リーダー</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 font-medium">月間目標（件）</label>
                          <input type="number" value={editForm.target} onChange={e => setEditForm({ ...editForm, target: +e.target.value })} className={fieldClass} />
                        </div>
                      </div>
                      {teams.length > 0 && (
                        <div>
                          <label className="text-xs text-gray-600 font-medium">チーム</label>
                          <select value={editForm.teamId} onChange={e => setEditForm({ ...editForm, teamId: e.target.value })} className={fieldClass}>
                            <option value="">未割り当て</option>
                            {teams.map(t => <option key={t.teamId} value={t.teamId}>{t.teamName}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => setEditingId(null)} className="flex-1 border border-gray-300 text-gray-600 font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-all select-none">キャンセル</button>
                        <button onClick={saveEdit} className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-all select-none">保存する</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-2xl flex items-center justify-center text-gray-700 font-bold text-sm shrink-0">{m.name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-sm">{m.name}</span>
                          {m.role === 'leader' && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-bold">リーダー</span>}
                          {m.teamId && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{teams.find(t => t.teamId === m.teamId)?.teamName || m.teamId}</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{ROLE_LABELS[m.role] || m.role} · 目標 {m.target}件</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => startEdit(m)} className="text-blue-600 text-xs font-bold px-3 py-1.5 rounded-full bg-blue-50 active:scale-95 transition-all select-none">編集</button>
                        <button onClick={() => deleteMember(m.id)} className="text-red-500 text-xs font-bold px-3 py-1.5 rounded-full bg-red-50 active:scale-95 transition-all select-none">削除</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* チーム管理 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="font-bold text-gray-800 p-4 border-b">🏷️ チーム管理</div>
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
                    placeholder="チーム名（例: Aチーム）"
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={e => { if (e.key === 'Enter') addTeam(); }} />
                  <button onClick={addTeam} disabled={!newTeamName.trim() || teamSaving}
                    className="bg-blue-600 text-white font-bold px-4 py-2 rounded-xl text-sm active:scale-95 transition-all select-none disabled:opacity-40">
                    追加
                  </button>
                </div>

                {teams.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-4">チームがまだありません</div>
                ) : (
                  <div className="space-y-2">
                    {teams.map(team => {
                      const teamMembers = members.filter(m => m.teamId === team.teamId);
                      return (
                        <div key={team.teamId} className="border border-gray-200 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-gray-800 text-sm">{team.teamName}</span>
                            <button onClick={() => removeTeam(team.teamId)}
                              className="text-red-500 text-xs px-2 py-1 rounded-lg bg-red-50 active:scale-95 transition-all select-none">
                              削除
                            </button>
                          </div>
                          {teamMembers.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {teamMembers.map(m => (
                                <span key={m.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                                  {m.name}{m.role === 'leader' && ' 👑'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">メンバーなし（メンバー編集で割り当て）</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 月次計画入力 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="font-bold text-gray-800 p-4 border-b">📅 月次計画入力</div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 font-medium">対象月</label>
                  <input type="month" value={planMonth} onChange={e => setPlanMonth(e.target.value)}
                    className="border border-gray-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">メンバー</th>
                        <th className="px-3 py-2 text-center font-medium">計画稼働日数</th>
                        <th className="px-3 py-2 text-center font-medium">月間目標（件）</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {members.map((m, i) => (
                        <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2.5 font-bold text-gray-900">
                            {m.name}
                            {m.role === 'leader' && <span className="ml-1 text-xs text-yellow-600">👑</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <input type="number" min="1" max="31"
                              value={plans[m.id]?.planDays ?? m.planDays ?? 20}
                              onChange={e => setPlan(m.id, 'planDays', +e.target.value)}
                              className="w-20 mx-auto block text-center border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </td>
                          <td className="px-3 py-2.5">
                            <input type="number" min="0"
                              value={plans[m.id]?.monthlyTarget ?? m.target ?? 0}
                              onChange={e => setPlan(m.id, 'monthlyTarget', +e.target.value)}
                              className="w-20 mx-auto block text-center border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button onClick={savePlans} disabled={planSaving}
                  className="w-full bg-green-600 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-all select-none disabled:opacity-40">
                  {planSaving ? '保存中...' : `💾 ${planMonth.replace('-', '/')} の計画を保存`}
                </button>
              </div>
            </div>

            {/* リセット */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="font-bold text-gray-800 mb-1 text-sm">デフォルトに戻す</div>
              <div className="text-xs text-gray-400 mb-3">メンバーリストを初期状態（8名）にリセットします</div>
              <button onClick={() => {
                if (confirm('メンバーリストをデフォルトに戻しますか？')) {
                  saveMembers(DEFAULT_MEMBERS);
                  saveMembersToGAS(DEFAULT_MEMBERS);
                  setMembers(DEFAULT_MEMBERS);
                  flash('リセットしました');
                }
              }} className="text-red-500 text-sm font-bold border border-red-200 px-4 py-2 rounded-xl active:scale-95 transition-all select-none">
                デフォルトに戻す
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
