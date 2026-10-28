'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconBell, IconLogout, IconSettings } from '@tabler/icons-react';
import { signOutAction } from '../actions/auth';
import { getSupabase } from '../../lib/supabase';
import { APP_HORIZONTAL_CONTAINER } from './container';
import { useAuth } from './AuthProvider';
import PendingInbox from './PendingInbox';

export interface GlobalNavProps {}

export function GlobalNav(props: GlobalNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSrc, setImgSrc] = useState('/little-life-logo.png');
  const { user } = useAuth();
  const userEmail = user?.email ?? null;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // 가계부 확인 대기(카드 결제 알림 등) 건수 — 모든 화면 상단 종 아이콘에 표시
  const [pendingCount, setPendingCount] = useState(0);
  const userId = user?.id ?? null;

  const loadPendingCount = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    const { count } = await supabase
      .from('pending_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');
    setPendingCount(count ?? 0);
  }, [userId]);

  useEffect(() => {
    loadPendingCount();
  }, [loadPendingCount, pathname]);

  // 새 알림이 들어오거나 등록·삭제되면 바로 갱신
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    const channel = supabase
      .channel(`nav-pending-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_transactions', filter: `user_id=eq.${userId}` },
        () => loadPendingCount()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadPendingCount]);

  /** 종을 누르면 지금 화면에서 바로 확인 팝업 (미룬 건 포함) */
  const openPending = () => {
    window.dispatchEvent(new CustomEvent('little-life:open-pending'));
  };

  const handleImageError = () => {
    if (imgSrc.includes('.png')) {
      setImgSrc('/little-life-logo.jpg');
    } else if (imgSrc.includes('.jpg')) {
      setImgSrc('/little-life-logo.svg');
    } else {
      setImgError(true);
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const goSettings = () => {
    setMenuOpen(false);
    if (pathname === '/settings') {
      router.back();
    } else {
      router.push('/settings');
    }
  };

  return (
    <>
    {userEmail && <PendingInbox autoOpen={pathname === '/daily' || pathname === '/'} />}
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

          <div className="flex items-center gap-0">
            {/* 로그인/로그아웃 */}
            {userEmail ? (
              <div className="flex items-center gap-0 min-w-0">
                {pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={openPending}
                    className="relative min-h-[40px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-label={`가계부 확인 대기 ${pendingCount}건`}
                    title={`가계부 확인 대기 ${pendingCount}건`}
                  >
                    <IconBell size={22} stroke={1.75} aria-hidden="true" />
                    <span className="absolute top-1 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold leading-[18px] text-center tabular-nums">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  </button>
                )}
                <form action={signOutAction}>
                  <button
                    className="min-h-[40px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-label="로그아웃"
                    title="로그아웃"
                  >
                    <IconLogout size={22} stroke={1.75} aria-hidden="true" />
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

            {/* 설정 메뉴 */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className={`rounded-lg text-sm font-medium transition-colors min-h-[40px] min-w-[32px] flex items-center justify-center ${
                  menuOpen || pathname === '/settings'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                aria-label="설정 메뉴"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <IconSettings size={22} stroke={1.75} aria-hidden="true" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1 z-50"
                >
                  {userEmail && (
                    <div className="px-4 pt-2 pb-2.5 mb-1 border-b border-gray-100 dark:border-gray-800">
                      <div className="text-[11px] text-gray-400 dark:text-gray-500">로그인 계정</div>
                      <div className="text-sm text-gray-800 dark:text-gray-100 truncate" title={userEmail}>
                        {userEmail}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={goSettings}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    설정
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
    </>
  );
}
