'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getReports, getAvailableMonths, syncToReportSheet, createAndSyncReportSheet } from '@/lib/api';

const DEFAULT_SS_ID  = '1IloA61FPEJ-INJrtboChUSS3B2_3AlTaLjnpi8rfwTPo';
const LS_SS_ID_KEY   = 'exportSpreadsheetId';
const LS_FOLDER_KEY  = 'exportFolderId';

type Mode   = 'existing' | 'new';
type Status = 'idle' | 'loading' | 'success' | 'error';

function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${y}年${parseInt(mo)}月`;
}

export default function ExportPage() {
  const router = useRouter();
  const [months, setMonths]               = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [mode, setMode]                   = useState<Mode>('new');
  const [ssId, setSsId]                   = useState('');
  const [editSsId, setEditSsId]           = useState(false);
  const [folderId, setFolderId]           = useState('');
  const [editFolder, setEditFolder]       = useState(false);
  const [exportTypes, setExportTypes]     = useState<string[]>(['daily', 'summary']);
  const [status, setStatus]               = useState<Status>('idle');
  const [errorMsg, setErrorMsg]           = useState('');
  const [resultUrl, setResultUrl]         = useState('');
  const [resultTitle, setResultTitle]     = useState('');
  const [lastSync, setLastSync]           = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/login'); return; }

    setSsId(localStorage.getItem(LS_SS_ID_KEY) || DEFAULT_SS_ID);
    setFolderId(localStorage.getItem(LS_FOLDER_KEY) || '');

    const now = new Date();
    const cur = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(cur);

    getReports().then(reports => {
      const ms = getAvailableMonths(reports);
      if (!ms.includes(cur)) ms.unshift(cur);
      setMonths(ms);
    });
  }, [router]);

  const toggleType = (t: string) =>
    setExportTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const handleExport = async () => {
    if (!selectedMonth || exportTypes.length === 0) return;
    if (mode === 'existing' && !ssId.trim()) return;

    setStatus('loading');
    setErrorMsg('');
    setResultUrl('');

    let result;
    if (mode === 'new') {
      const trimmedFolder = folderId.trim();
      if (trimmedFolder) localStorage.setItem(LS_FOLDER_KEY, trimmedFolder);
      result = await createAndSyncReportSheet({
        month: selectedMonth,
        exportTypes,
        folderId: trimmedFolder || undefined,
      });
    } else {
      const trimmedId = ssId.trim();
      localStorage.setItem(LS_SS_ID_KEY, trimmedId);
      result = await syncToReportSheet({
        month: selectedMonth,
        spreadsheetId: trimmedId,
        exportTypes,
      });
    }

    if (result.success) {
      setStatus('success');
      setLastSync(new Date().toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' }));
      const r = result as { success: boolean; spreadsheetUrl?: string; title?: string; error?: string };
      if (r.spreadsheetUrl) setResultUrl(r.spreadsheetUrl);
      if (r.title) setResultTitle(r.title);
    } else {
      setStatus('error');
      setErrorMsg(result.error || '不明なエラー');
    }
  };

  const typeOptions = [
    { id: 'daily',   label: 'メンバー別日次データ', desc: '各メンバーのタブを作成・更新' },
    { id: 'summary', label: '月次サマリー',          desc: 'サマリーシートの行を追加・更新' },
  ];

  const canSubmit = selectedMonth && exportTypes.length > 0 &&
    (mode === 'new' || (mode === 'existing' && ssId.trim()));

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 text-sm font-medium">← 戻る</button>
        <h1 className="text-base font-bold text-gray-800">エクスポート</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 pb-24 space-y-4 page-animate">

        {/* 対象月 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">対象月</p>
          <select
            value={selectedMonth}
            onChange={e => { setSelectedMonth(e.target.value); setStatus('idle'); }}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
        </div>

        {/* 反映先モード切替 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">反映先</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {([
              { id: 'new' as Mode,      label: '🆕 新規作成',    desc: '新しいスプレッドシートを自動作成' },
              { id: 'existing' as Mode, label: '📋 既存に反映',   desc: '指定したスプレッドシートに書き込む' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => { setMode(opt.id); setStatus('idle'); }}
                className={`p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${
                  mode === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <p className={`text-sm font-bold ${mode === opt.id ? 'text-blue-700' : 'text-gray-700'}`}>{opt.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{opt.desc}</p>
              </button>
            ))}
          </div>

          {/* 新規作成: フォルダID（任意） */}
          {mode === 'new' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-gray-500">保存先フォルダID（任意）</p>
                <button onClick={() => setEditFolder(v => !v)} className="text-xs text-blue-600 font-medium">
                  {editFolder ? '閉じる' : '設定'}
                </button>
              </div>
              {editFolder ? (
                <input
                  type="text"
                  value={folderId}
                  onChange={e => setFolderId(e.target.value)}
                  placeholder="GoogleドライブのフォルダID（省略可）"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              ) : (
                <p className="text-xs text-gray-400">
                  {folderId ? <span className="font-mono truncate block">{folderId}</span> : '未設定（マイドライブのルートに作成）'}
                </p>
              )}
            </div>
          )}

          {/* 既存に反映: スプレッドシートID */}
          {mode === 'existing' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-gray-500">スプレッドシートID</p>
                <button onClick={() => setEditSsId(v => !v)} className="text-xs text-blue-600 font-medium">
                  {editSsId ? '閉じる' : '変更'}
                </button>
              </div>
              {editSsId ? (
                <input
                  type="text"
                  value={ssId}
                  onChange={e => setSsId(e.target.value)}
                  placeholder="スプレッドシートID"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              ) : (
                <p className="text-xs text-gray-400 font-mono truncate">{ssId}</p>
              )}
              <p className="text-xs text-gray-400 mt-1.5">URLの <span className="font-mono">/d/</span> と <span className="font-mono">/edit</span> の間の文字列</p>
            </div>
          )}
        </div>

        {/* エクスポート内容 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">エクスポートする内容</p>
          <div className="space-y-2">
            {typeOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => toggleType(opt.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all active:scale-[0.99] text-left ${
                  exportTypes.includes(opt.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <span className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  exportTypes.includes(opt.id) ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'
                }`}>
                  {exportTypes.includes(opt.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5"/>
                    </svg>
                  )}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${exportTypes.includes(opt.id) ? 'text-blue-700' : 'text-gray-700'}`}>{opt.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 注意書き（既存モードのみ） */}
        {mode === 'existing' && (
          <div className="bg-amber-50 rounded-2xl p-4 flex gap-3">
            <span className="text-lg flex-shrink-0">⚠️</span>
            <p className="text-xs text-amber-700 leading-relaxed">
              GASが使用しているGoogleアカウントを、反映先スプレッドシートの編集者として追加してください。
            </p>
          </div>
        )}

        {/* 実行ボタン */}
        <button
          onClick={handleExport}
          disabled={status === 'loading' || !canSubmit}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98] ${
            status === 'loading' || !canSubmit
              ? 'bg-gray-200 text-gray-400'
              : 'bg-blue-600 text-white shadow-md shadow-blue-200 active:bg-blue-700'
          }`}
        >
          {status === 'loading'
            ? '処理中…'
            : mode === 'new'
            ? `📤 ${selectedMonth ? fmtMonth(selectedMonth) : ''} のスプレッドシートを新規作成`
            : '📤 スプレッドシートに反映する'}
        </button>

        {/* 結果 */}
        {status === 'success' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-sm font-bold text-green-700">完了しました（{lastSync}）</p>
                {resultTitle && <p className="text-xs text-green-600">{resultTitle}</p>}
              </div>
            </div>
            {resultUrl && (
              <a
                href={resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full mt-2 py-2.5 bg-green-600 text-white text-sm font-bold text-center rounded-xl active:bg-green-700 transition-colors"
              >
                📊 スプレッドシートを開く
              </a>
            )}
          </div>
        )}
        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">❌</span>
            <div>
              <p className="text-sm font-bold text-red-700">エラー</p>
              <p className="text-xs text-red-600">{errorMsg}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
