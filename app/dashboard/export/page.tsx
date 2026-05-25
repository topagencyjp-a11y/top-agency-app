'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getReports, getAvailableMonths, syncToReportSheet } from '@/lib/api';

const DEFAULT_SS_ID = '1IloA61FPEJ-INJrtboChUSS3B2_3AlTaLjnpi8rfwTPo';
const LS_SS_ID_KEY  = 'exportSpreadsheetId';

type Status = 'idle' | 'loading' | 'success' | 'error';

function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${y}年${parseInt(mo)}月`;
}

export default function ExportPage() {
  const router = useRouter();
  const [months, setMonths]               = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [ssId, setSsId]                   = useState('');
  const [editSsId, setEditSsId]           = useState(false);
  const [exportTypes, setExportTypes]     = useState<string[]>(['daily', 'summary']);
  const [status, setStatus]               = useState<Status>('idle');
  const [errorMsg, setErrorMsg]           = useState('');
  const [lastSync, setLastSync]           = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/login'); return; }

    const saved = localStorage.getItem(LS_SS_ID_KEY) || DEFAULT_SS_ID;
    setSsId(saved);

    const now = new Date();
    const cur = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(cur);

    getReports().then(reports => {
      const ms = getAvailableMonths(reports);
      if (!ms.includes(cur)) ms.unshift(cur);
      setMonths(ms);
    });
  }, [router]);

  const toggleType = (t: string) => {
    setExportTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const handleExport = async () => {
    if (!selectedMonth || !ssId.trim() || exportTypes.length === 0) return;
    setStatus('loading');
    setErrorMsg('');

    const trimmedId = ssId.trim();
    localStorage.setItem(LS_SS_ID_KEY, trimmedId);

    const result = await syncToReportSheet({
      month: selectedMonth,
      spreadsheetId: trimmedId,
      exportTypes,
    });

    if (result.success) {
      setStatus('success');
      setLastSync(new Date().toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' }));
    } else {
      setStatus('error');
      setErrorMsg(result.error || '不明なエラー');
    }
  };

  const typeOptions = [
    { id: 'daily',   label: 'メンバー別日次データ', desc: '各メンバーのタブを作成・更新' },
    { id: 'summary', label: '月次サマリー',          desc: 'サマリーシートの行を追加・更新' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-gray-500 active:text-gray-700 text-sm font-medium"
        >
          ← 戻る
        </button>
        <h1 className="text-base font-bold text-gray-800">エクスポート</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 pb-24 space-y-4 page-animate">

        {/* 対象月 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">対象月</p>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {months.map(m => (
              <option key={m} value={m}>{fmtMonth(m)}</option>
            ))}
          </select>
        </div>

        {/* 反映先スプレッドシート */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">反映先スプレッドシートID</p>
            <button
              onClick={() => setEditSsId(v => !v)}
              className="text-xs text-blue-600 font-medium"
            >
              {editSsId ? '閉じる' : '変更'}
            </button>
          </div>
          {editSsId ? (
            <input
              type="text"
              value={ssId}
              onChange={e => setSsId(e.target.value)}
              placeholder="スプレッドシートID"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-xs text-gray-500 truncate font-mono bg-gray-50 rounded-lg px-3 py-2">{ssId}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            URLの <span className="font-mono">/d/</span> と <span className="font-mono">/edit</span> の間の文字列
          </p>
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
                  exportTypes.includes(opt.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <span className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  exportTypes.includes(opt.id)
                    ? 'bg-blue-500 border-blue-500'
                    : 'bg-white border-gray-300'
                }`}>
                  {exportTypes.includes(opt.id) && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  )}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${exportTypes.includes(opt.id) ? 'text-blue-700' : 'text-gray-700'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 注意書き */}
        <div className="bg-amber-50 rounded-2xl p-4 flex gap-3">
          <span className="text-lg flex-shrink-0">⚠️</span>
          <p className="text-xs text-amber-700 leading-relaxed">
            反映には、GASが使用しているGoogleアカウントを反映先スプレッドシートの編集者として追加する必要があります。
          </p>
        </div>

        {/* 実行ボタン */}
        <button
          onClick={handleExport}
          disabled={status === 'loading' || exportTypes.length === 0 || !ssId.trim()}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98] ${
            status === 'loading' || exportTypes.length === 0 || !ssId.trim()
              ? 'bg-gray-200 text-gray-400'
              : 'bg-blue-600 text-white shadow-md shadow-blue-200 active:bg-blue-700'
          }`}
        >
          {status === 'loading' ? '反映中…' : '📤 スプレッドシートに反映する'}
        </button>

        {/* 結果 */}
        {status === 'success' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-sm font-bold text-green-700">反映完了</p>
              <p className="text-xs text-green-600">{fmtMonth(selectedMonth)} のデータを書き込みました（{lastSync}）</p>
            </div>
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
