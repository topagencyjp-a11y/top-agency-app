'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV = [
  { href: '/dashboard',          icon: '✏️',  label: '入力',     exact: true },
  { href: '/dashboard/stats',    icon: '📊',  label: '件数管理'              },
  { href: '/dashboard/activity', icon: '🔄',  label: '行動量管理'            },
  { href: '/dashboard/personal', icon: '👤',  label: '個人分析'              },
  { href: '/dashboard/shift',    icon: '📅',  label: 'シフト'                },
];

// 将来ページが増えたらここに追加する
const MORE_PAGES = [
  { href: '/dashboard/settings', icon: '⚙️', label: '設定' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const active = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const isMoreActive = MORE_PAGES.some(p => pathname.startsWith(p.href));
  const closeMore = () => setShowMore(false);

  return (
    <div className="min-h-screen bg-gray-100 pb-16">
      {children}

      {/* backdrop */}
      {showMore && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={closeMore} />
      )}

      {/* フローティング「その他」ボタン — ナビの右上に固定 */}
      <button
        onClick={() => setShowMore(v => !v)}
        className={`fixed bottom-20 right-4 z-50 w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-lg transition-all active:scale-95 select-none ${
          isMoreActive || showMore
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-500 border border-gray-200'
        }`}
      >
        {showMore ? '✕' : '⋯'}
      </button>

      {/* その他シート — 画面下からスライドアップ */}
      <div
        className={`fixed left-0 right-0 bottom-16 z-[60] bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${
          showMore ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        }`}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="px-4 pt-2 pb-8">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">その他のページ</p>
          <div className="grid grid-cols-4 gap-3">
            {MORE_PAGES.map(p => (
              <Link
                key={p.href}
                href={p.href}
                onClick={closeMore}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl active:scale-95 transition-all select-none ${
                  pathname.startsWith(p.href) ? 'bg-blue-50' : 'bg-gray-50 active:bg-gray-100'
                }`}
              >
                <span className="text-2xl leading-none">{p.icon}</span>
                <span className={`text-xs font-medium ${pathname.startsWith(p.href) ? 'text-blue-600' : 'text-gray-700'}`}>
                  {p.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ボトムナビ（5タブ固定） */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-pb">
        <div className="flex max-w-lg mx-auto">
          {NAV.map(item => {
            const on = active(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMore}
                className={`relative flex-1 flex flex-col items-center pt-2 pb-1.5 gap-0.5 select-none transition-colors active:bg-gray-50 ${
                  on ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <span className="text-[22px] leading-none">{item.icon}</span>
                <span className={`text-[10px] font-medium ${on ? 'text-blue-600' : 'text-gray-400'}`}>
                  {item.label}
                </span>
                {on && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-t-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
