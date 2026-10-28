'use client';

import Link from 'next/link';
import { IconBuildingBank, IconChartLine, IconChartPie, IconReceipt2 } from '@tabler/icons-react';

/** Asset 메뉴 안의 네 화면 — 하단 Asset 탭과 오른쪽 고정 메뉴가 함께 씀 */
export const ASSET_SECTIONS = [
  { href: '/ledger', label: 'Ledger', icon: IconReceipt2 },
  { href: '/stats', label: '통계', icon: IconChartPie },
  { href: '/assets', label: '자산', icon: IconBuildingBank },
  { href: '/deploy', label: 'Deploy', icon: IconChartLine },
] as const;

/** 오른쪽 메뉴와 + 버튼이 함께 쓰는 가로 위치 (본문 카드 오른쪽 끝선 안쪽) */
export const ASSET_FAB_RIGHT = 'right-[max(20px,calc(50%-186px))] sm:right-[calc(50%-174px)]';

export const ASSET_LAST_SECTION_KEY = 'little-life:asset-section';

export function assetSectionOf(pathname: string): string | null {
  if (pathname.startsWith('/transaction')) return '/ledger';
  const hit = ASSET_SECTIONS.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));
  return hit ? hit.href : null;
}

/**
 * 오른쪽 아래에 떠서 스크롤해도 따라다니는 Asset 섹션 메뉴.
 * 본문(412px) 오른쪽 아래, 하단 메뉴 바로 위 — 본문 위에 겹쳐 뜸(카드 오른쪽 끝선에서 4~8px 안쪽). Ledger·Deploy 의 + 버튼은 이 메뉴 바로 아래(같은 세로줄), 그 화면에선 메뉴가 위로 올라감.
 */
export function AssetSectionRail({ pathname }: { pathname: string }) {
  const current = assetSectionOf(pathname);
  if (!current) return null;
  // + 버튼이 있는 화면은 메뉴를 + 버튼 위로 올림
  const hasFab = current === '/ledger' || current === '/deploy';

  return (
    <nav
      aria-label="Asset 메뉴"
      className={`fixed ${hasFab ? 'bottom-[160px]' : 'bottom-24'} ${ASSET_FAB_RIGHT} z-[90] flex flex-col gap-1 rounded-2xl border border-gray-200/80 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 p-1 shadow-lg backdrop-blur-md`}
    >
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
            className={`flex w-11 flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition-colors ${
              active
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Icon size={19} stroke={1.7} aria-hidden="true" />
            <span className="text-[9.5px] font-semibold leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
