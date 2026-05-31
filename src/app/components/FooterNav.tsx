'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_HORIZONTAL_CONTAINER } from './container';

export interface FooterNavProps {}

export function FooterNav(props: FooterNavProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/daily', label: 'Daily', emoji: '📅' },
    { href: '/memo', label: 'Diary', emoji: '📝' },
    { href: '/ledger', label: 'Ledger', emoji: '💳' },
    { href: '/assets', label: 'Asset', emoji: '💰' },
    { href: '/ai', label: 'AI', emoji: '🤖' },
    { href: '/deploy', label: 'Deploy', emoji: '📈' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-[rgb(254,252,247)] dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className={APP_HORIZONTAL_CONTAINER}>
        <div className="flex items-center justify-between gap-0.5 px-1 py-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === '/daily' && pathname === '/') ||
              (item.href === '/ledger' && (pathname.startsWith('/ledger') || pathname.startsWith('/transaction'))) ||
              (item.href === '/assets' && pathname.startsWith('/assets')) ||
              (item.href === '/deploy' && pathname.startsWith('/deploy'));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 min-w-0 h-[58px] rounded-lg transition-colors ${
                  isActive
                    ? 'bg-gray-900 dark:bg-gray-700 text-white dark:text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-xl leading-none">{item.emoji}</span>
                <span className="text-[10px] font-medium mt-0.5 truncate max-w-full px-0.5">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

