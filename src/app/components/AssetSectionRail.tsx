'use client';

import Link from 'next/link';
import { IconBuildingBank, IconChartLine, IconChartPie, IconReceipt2 } from '@tabler/icons-react';

/** Asset 메뉴 안의 네 화면 — 하단 Asset 탭과 그 위 가로 메뉴가 함께 씀 */
export const ASSET_SECTIONS = [
  { href: '/ledger', label: 'Ledger', icon: IconReceipt2 },
  { href: '/stats', label: '통계', icon: IconChartPie },
  { href: '/assets', label: '자산', icon: IconBuildingBank },
  { href: '/deploy', label: 'Deploy', icon: IconChartLine },
] as const;

/** + 버튼 세로 위치: 하단 메뉴 + Asset 가로 메뉴 바로 위 */
export const ASSET_FAB_BOTTOM = 'bottom-[140px]';

/** + 버튼 가로 위치 (본문 카드 오른쪽 끝선 안쪽) */
export const ASSET_FAB_RIGHT = 'right-[max(20px,calc(50%-186px))] sm:right-[calc(50%-174px)]';

export const ASSET_LAST_SECTION_KEY = 'little-life:asset-section';

export function assetSectionOf(pathname: string): string | null {
  if (pathname.startsWith('/transaction')) return '/ledger';
  const hit = ASSET_SECTIONS.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));
  return hit ? hit.href : null;
}

/**
 * Asset 섹션 가로 메뉴 — 하단 메뉴(FooterNav) 바로 위에 붙음.
 * FooterNav 의 고정 영역 안에서 렌더되므로 본문을 가리지 않음.
 */
export function AssetSectionBar({ pathname }: { pathname: string }) {
  const current = assetSectionOf(pathname);
  if (!current) return null;

  return (
    <div aria-label="Asset 메뉴" role="navigation" className="border-b border-gray-200 dark:border-gray-700">
      <div className="mx-auto grid max-w-[412px] grid-cols-4 gap-1 px-3 py-1.5">
        {ASSET_SECTIONS.map(({ href, label, icon: Icon }) => {
          const active = current === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                try { localStorage.setItem(ASSET_LAST_SECTION_KEY, href); } catch {}
              }}
              className={`flex h-9 items-center justify-center gap-1 rounded-lg text-[13px] font-semibold transition-colors ${
                active
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Icon size={17} stroke={1.8} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** 가로 메뉴가 생긴 만큼 본문 아래 여백 (스크롤 끝 내용이 가리지 않게) */
export function AssetSectionSpacer({ pathname }: { pathname: string }) {
  return assetSectionOf(pathname) ? <div aria-hidden="true" className="h-14" /> : null;
}
