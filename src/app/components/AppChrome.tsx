'use client';

/**
 * 앱 공통 상단·하단 메뉴 — layout 에서 한 번만 렌더해 화면을 옮겨도 그대로 유지.
 * (예전엔 화면마다 GlobalNav/FooterNav 를 따로 렌더 → 이동할 때마다 다시 만들어져
 *  종 아이콘·알림 건수가 사라졌다 나타나고 실시간 연결이 재접속됐음)
 */
import { usePathname } from 'next/navigation';
import { GlobalNav } from './GlobalNav';
import { FooterNav } from './FooterNav';
import { useAuth } from './AuthProvider';

/** 메뉴를 보여 줄 화면 (로그인·기타 단독 화면 제외) */
const NAV_PREFIXES = ['/daily', '/memo', '/ledger', '/transaction', '/stats', '/assets', '/deploy', '/ai', '/settings'];

export function hasAppChrome(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === '/') return true;
  return NAV_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AppHeader() {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  if (!hasAppChrome(pathname)) return null;
  // 로그인 확인 중엔 같은 높이 자리만 잡아 화면이 밀리지 않게
  if (isLoading) {
    return <div aria-hidden="true" className="h-16 border-b border-gray-200 dark:border-gray-700" />;
  }
  if (!user) return null;
  return <GlobalNav />;
}

export function AppFooter() {
  const pathname = usePathname();
  const { user } = useAuth();
  if (!hasAppChrome(pathname) || !user) return null;
  return <FooterNav />;
}
