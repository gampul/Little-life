'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconCalendarCheck,
  IconNotebook,
  IconReceipt2,
  IconBuildingBank,
  IconChartLine,
  IconWand,
} from '@tabler/icons-react';
import { APP_HORIZONTAL_CONTAINER } from './container';

export interface FooterNavProps {}

export function FooterNav(props: FooterNavProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/daily', label: 'Daily', icon: IconCalendarCheck },
    { href: '/memo', label: 'Diary', icon: IconNotebook },
    { href: '/ledger', label: 'Ledger', icon: IconReceipt2 },
    { href: '/assets', label: 'Asset', icon: IconBuildingBank },
    { href: '/deploy', label: 'Deploy', icon: IconChartLine },
    { href: '/ai', label: 'AI Agent', icon: IconWand },
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
            
            const IconComponent = item.icon;
            
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
                <IconComponent size={22} stroke={1.5} />
                <span className="text-[10px] font-medium mt-1 truncate max-w-full px-0.5">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

