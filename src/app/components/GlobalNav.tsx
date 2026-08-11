'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import { signOutAction } from '../actions/auth';
import { APP_HORIZONTAL_CONTAINER } from './container';
import { useAuth } from './AuthProvider';

export interface GlobalNavProps {}

export function GlobalNav(props: GlobalNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSrc, setImgSrc] = useState('/little-life-logo.png');
  const { user } = useAuth();
  const userEmail = user?.email ?? null;

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
      <div className={APP_HORIZONTAL_CONTAINER}>
        <div className="flex items-center justify-between h-16">
          {/* 로고/타이틀 */}
          <Link href="/daily" className="flex items-center gap-2">
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

          <div className="flex items-center gap-2">
            {/* 로그인/로그아웃 */}
            {userEmail ? (
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="hidden sm:block text-xs text-gray-600 dark:text-gray-300 max-w-[160px] truncate"
                  title={userEmail}
                >
                  {userEmail}
                </span>
                <form action={signOutAction}>
                  <button
                    className="px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 whitespace-nowrap"
                    aria-label="로그아웃"
                  >
                    로그아웃
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="로그인"
              >
                로그인
              </Link>
            )}

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
      </div>
    </nav>
  );
}

