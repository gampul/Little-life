'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface FooterNavProps {
  onAIAgentClick?: () => void;
}

export function FooterNav(props: FooterNavProps) {
  const { onAIAgentClick } = props;
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Daily', emoji: '📅' },
    { href: '/memo', label: 'Diary', emoji: '📝' },
    { href: '/settings', label: '', emoji: null, isDots: true },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-[480px] mx-auto">
        <div className="flex items-center justify-around px-2 py-2">
          {/* AI Agent 버튼 */}
          {onAIAgentClick && (
            <button
              onClick={onAIAgentClick}
              className="flex flex-col items-center justify-center min-w-[60px] min-h-[60px] px-2 py-2 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="AI Agent"
            >
              <span className="text-2xl mb-1">🚀</span>
              <span className="text-xs font-medium">AI</span>
            </button>
          )}
          
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center min-w-[60px] min-h-[60px] px-2 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {item.isDots ? (
                  <span className="flex flex-col gap-0.5 items-center justify-center">
                    <span className="w-1 h-1 rounded-full bg-current"></span>
                    <span className="w-1 h-1 rounded-full bg-current"></span>
                    <span className="w-1 h-1 rounded-full bg-current"></span>
                  </span>
                ) : (
                  <>
                    <span className="text-2xl mb-1">{item.emoji}</span>
                    <span className="text-xs font-medium">{item.label}</span>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

