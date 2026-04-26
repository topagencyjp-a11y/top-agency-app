'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBERS as DEFAULT_MEMBERS, Member } from '@/lib/members';
import { loadMembers, saveMembers } from '@/lib/memberStore';
import { getMembersFromGAS, saveMembersToGAS, updatePasswordInGAS } from '@/lib/api';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', role: 'closer' as 'closer' | 'appointer', target: 15, isManager: false });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', role: 'closer' as 'closer' | 'appointer', target: 15, isManager: false });
  const [savedMsg, setSavedMsg] = useState('');

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
      if (data.length > 0) {
        localStorage.setItem('members', JSON.stringify(data));
        setMembers(data);
      }
    });
  }, []);

  const flash = (msg = '保存しました') => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const changePassword = async () => {
    setPwError('');
    if (!pwForm.current) { setPwError('現在のパスワードを入力してください'); return; }
    if (pwForm.next.length < 4) { setPwError('新パスワードは4文字以上にしてください'); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError('新パスワードが一致しません'); return; }
    setPwChanging(true);
    const result = await updatePasswordInGAS(user.id, pwForm.current, pwForm.next);
    setPwChanging(false);
    if (result.success) {
      setPwForm({ current: '', next: '', confirm: '' });
      flash('パスワードを変更しました');
    } else {
      setPwError(result.error || 'パスワードの変更に失敗しました');
    }
  };

  const startEdit = (m: Member) => {
    setEditingId(m.id);
    setEditForm({ name: m.name, role: m.role, target: m.target, isManager: m.isManager || false });
    setShowAdd(false);
  };

  const saveEdit = () => {
    const updated = members.map(m => m.id === editingId ? { ...m, ...editForm } : m);
    setMembers(updated);
    saveMembers(updated);
    saveMembersToGAS(updated);
    setEditingId(null);
    flash();
  };

  const deleteMember = (id: string) => {
    if (!confirm('このメンバーを削除しますか？')) return;
    const updated = members.filter(m => m.id !== id);
    setMembers(updated);
    saveMembers(updated);
    saveMembersToGAS(updated);
    flash('削除しました');
  };

  const addMember = () => {
    if (!addForm.name.trim()) return;
    const newMember: Member = {
      id: addForm.name.trim() + '_' + Date.now(),
      name: addForm.name.trim(),
      role: addForm.role,
      target: addForm.target,
      isManager: addForm.isManager,
    };
    const updated = [...members, newMember];
    setMembers(updated);
    saveMembers(updated);
    saveMembersToGAS(updated);
    setShowAdd(false);
    setAddForm({ name: '', role: 'closer', target: 15, isManager: false });
    flash('追加しました（初期パスワード: top2024）');
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

        {/* パスワード変更（全員） */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="font-bold text-gray-800">🔑 パスワード変更</div>
          <div>
            <label className="text-xs text-gray-600 font-medium">現在のパスワード</label>
            <input type="password" value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })}
              className={pwFieldClass} placeholder="現在のパスワード" />
          </div>
          <div>
            <label className="text-xs text-gray-600 font-medium">新しいパスワード（4文字以上）</label>
            <input type="password" value={pwForm.next} onChange={e => setPwForm({ ...pwForm, next: e.target.value })}
              className={pwFieldClass} placeholder="新しいパスワード" />
          </div>
          <div>
            <label className="text-xs text-gray-600 font-medium">新しいパスワード（確認）</label>
            <input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
              className={pwFieldClass} placeholder="もう一度入力" />
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
                <div className="text-xs text-gray-400 mt-0.5">メンバー {members.length}名</div>
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
                    <input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                      className={fieldClass} placeholder="例：山田" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600 font-medium">役割</label>
                      <select value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value as 'closer' | 'appointer' })}
                        className={fieldClass}>
                        <option value="closer">クローザー</option>
                        <option value="appointer">アポインター</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 font-medium">月間目標（件）</label>
                      <input type="number" value={addForm.target} onChange={e => setAddForm({ ...addForm, target: +e.target.value })}
                        className={fieldClass} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input type="checkbox" checked={addForm.isManager} onChange={e => setAddForm({ ...addForm, isManager: e.target.checked })}
                      className="w-4 h-4 rounded accent-blue-600" />
                    責任者権限を付与
                  </label>
                  <p className="text-xs text-gray-400">初期パスワード: top2024</p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAdd(false)}
                      className="flex-1 border border-gray-300 text-gray-600 font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-all duration-150 select-none">
                      キャンセル
                    </button>
                    <button onClick={addMember} disabled={!addForm.name.trim()}
                      className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-all duration-150 select-none disabled:opacity-40">
                      追加する
                    </button>
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
                        <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          className={fieldClass} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-600 font-medium">役割</label>
                          <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value as 'closer' | 'appointer' })}
                            className={fieldClass}>
                            <option value="closer">クローザー</option>
                            <option value="appointer">アポインター</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 font-medium">月間目標（件）</label>
                          <input type="number" value={editForm.target} onChange={e => setEditForm({ ...editForm, target: +e.target.value })}
                            className={fieldClass} />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                        <input type="checkbox" checked={editForm.isManager} onChange={e => setEditForm({ ...editForm, isManager: e.target.checked })}
                          className="w-4 h-4 rounded accent-blue-600" />
                        責任者権限
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingId(null)}
                          className="flex-1 border border-gray-300 text-gray-600 font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-all duration-150 select-none">
                          キャンセル
                        </button>
                        <button onClick={saveEdit}
                          className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-all duration-150 select-none">
                          保存する
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-2xl flex items-center justify-center text-gray-700 font-bold text-sm shrink-0">
                        {m.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-sm">{m.name}</span>
                          {m.isManager && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-bold">責任者</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{m.role === 'closer' ? 'クローザー' : 'アポインター'} · 目標 {m.target}件</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => startEdit(m)}
                          className="text-blue-600 text-xs font-bold px-3 py-1.5 rounded-full bg-blue-50 active:scale-95 transition-all duration-150 select-none">
                          編集
                        </button>
                        <button onClick={() => deleteMember(m.id)}
                          className="text-red-500 text-xs font-bold px-3 py-1.5 rounded-full bg-red-50 active:scale-95 transition-all duration-150 select-none">
                          削除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
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
              }} className="text-red-500 text-sm font-bold border border-red-200 px-4 py-2 rounded-xl active:scale-95 transition-all duration-150 select-none">
                デフォルトに戻す
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
