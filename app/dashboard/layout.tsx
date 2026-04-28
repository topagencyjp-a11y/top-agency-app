'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard',          icon: '✏️',  label: '入力',     exact: true },
  { href: '/dashboard/stats',    icon: '📊',  label: '件数管理'              },
  { href: '/dashboard/activity', icon: '🔄',  label: '行動量管理'            },
  { href: '/dashboard/personal', icon: '👤',  label: '個人分析'              },
  { href: '/dashboard/shift',    icon: '📅',  label: 'シフト'                },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const active = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-gray-100 pb-16">
      {children}

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-pb">
        <div className="flex max-w-lg mx-auto">
          {NAV.map(item => {
            const on = active(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
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
