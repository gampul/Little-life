'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef } from 'react';

export interface GlobalNavProps {
  onAIAgentClick?: () => void;
}

export function GlobalNav(props: GlobalNavProps) {
  const { onAIAgentClick } = props;
  const pathname = usePathname();
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

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-[480px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* 로고/타이틀 */}
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

          {/* Settings 버튼 */}
          <Link
            href="/settings"
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              pathname === '/settings'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <span className="flex flex-col gap-0.5 items-center justify-center">
              <span className="w-1 h-1 rounded-full bg-current"></span>
              <span className="w-1 h-1 rounded-full bg-current"></span>
              <span className="w-1 h-1 rounded-full bg-current"></span>
            </span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

