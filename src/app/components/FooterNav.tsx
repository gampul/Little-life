'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export interface FooterNavProps {}

export function FooterNav(props: FooterNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pathname === '/settings') {
      router.back();
    } else {
      router.push('/settings');
    }
  };

  const navItems = [
    { href: '/ai', label: 'AI', emoji: '🚀' },
    { href: '/', label: 'Daily', emoji: '📅' },
    { href: '/memo', label: 'Diary', emoji: '📝' },
    { href: '/account', label: '가계부', emoji: '💰' },
    { href: '/settings', label: '', emoji: null, isDots: true },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-[480px] mx-auto">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            
            // 점3개 버튼은 별도 처리
            if (item.isDots) {
              return (
                <button
                  key={item.href}
                  onClick={handleSettingsClick}
                  className={`flex flex-col items-center justify-center w-[60px] h-[60px] rounded-lg transition-colors ${
                    isActive
                      ? 'bg-gray-900 dark:bg-gray-700 text-white dark:text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  aria-label={isActive ? '취소' : '설정'}
                >
                  <span className="flex flex-col gap-0.5 items-center justify-center">
                    <span className="w-1 h-1 rounded-full bg-current"></span>
                    <span className="w-1 h-1 rounded-full bg-current"></span>
                    <span className="w-1 h-1 rounded-full bg-current"></span>
                  </span>
                </button>
              );
            }
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center w-[60px] h-[60px] rounded-lg transition-colors ${
                  isActive
                    ? 'bg-gray-900 dark:bg-gray-700 text-white dark:text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-2xl leading-none">{item.emoji}</span>
                <span className="text-xs font-medium mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

