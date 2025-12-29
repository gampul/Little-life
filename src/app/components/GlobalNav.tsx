'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef } from 'react';

export interface GlobalNavProps {
  onAIAgentClick?: () => void;
}

export function GlobalNav(props: GlobalNavProps) {
  const { onAIAgentClick } = props;
  const pathname = usePathname();
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSrc, setImgSrc] = useState('/little-life-logo.png');

  const handleImageError = () => {
    if (imgSrc.includes('.png')) {
      setImgSrc('/little-life-logo.jpg');
    } else if (imgSrc.includes('.jpg')) {
      setImgSrc('/little-life-logo.svg');
    } else {
      setImgError(true);
    }
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pathname === '/settings') {
      router.back();
    } else {
      router.push('/settings');
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-[rgb(254,252,247)]/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-[480px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* 로고/타이틀 */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              {!imgError && (
                <img
                  ref={imgRef}
                  src={imgSrc}
                  alt="Little Life"
                  className="h-12 w-auto object-contain max-w-[240px]"
                  onError={handleImageError}
                />
              )}
              <span className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                Little Life
              </span>
            </Link>
            
            {/* AI 버튼 */}
            <Link
              href="/ai"
              className={`relative flex items-center justify-center w-10 h-10 rounded-full shadow-md transition-all duration-300 hover:scale-110 ${
                pathname === '/ai'
                  ? 'bg-gradient-to-br from-violet-600 to-indigo-700 ring-2 ring-violet-300'
                  : 'bg-gradient-to-br from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700'
              }`}
              aria-label="AI 도우미"
            >
              <span className="text-lg">🚀</span>
              <span className="absolute inset-0 rounded-full bg-violet-400 opacity-0 animate-ping" style={{ animationDuration: '2s' }}></span>
            </Link>
          </div>

          {/* Settings 버튼 */}
          <button
            onClick={handleSettingsClick}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              pathname === '/settings'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            aria-label={pathname === '/settings' ? '취소' : '설정'}
          >
            <span className="flex flex-col gap-1 items-center justify-center">
              <span className="w-5 h-0.5 bg-current"></span>
              <span className="w-5 h-0.5 bg-current"></span>
              <span className="w-5 h-0.5 bg-current"></span>
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}

