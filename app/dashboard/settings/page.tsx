'use client';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={()=>router.push('/dashboard')} className="text-gray-400 hover:text-white text-sm">← 戻る</button>
        <div className="font-bold text-blue-400">設定</div>
      </div>
      <div className="p-4 max-w-2xl mx-auto">
        <div className="bg-white rounded-xl p-6 shadow text-gray-500 text-sm text-center">
          設定ページ（準備中）
        </div>
      </div>
    </div>
  );
}
