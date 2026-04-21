'use client';
import { useRouter, usePathname } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const menus = [
    { path: '/dashboard', label: '✏️ 入力' },
    { path: '/dashboard/stats', label: '📊 数値管理' },
    { path: '/dashboard/reports', label: '📝 日報管理' },
    { path: '/dashboard/shift', label: '📅 シフト' },
  ];

  return (
    <div>
      {children}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 flex z-50">
        {menus.map(m => (
          <button key={m.path} onClick={() => router.push(m.path)}
            className={`flex-1 py-3 text-xs font-medium ${pathname === m.path ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="h-16" />
    </div>
  );
}
