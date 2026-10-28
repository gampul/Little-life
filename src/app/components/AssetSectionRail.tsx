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

export const ASSET_LAST_SECTION_KEY = 'little-life:asset-section';

export function assetSectionOf(pathname: string): string | null {
  if (pathname.startsWith('/transaction')) return '/ledger';
  const hit = ASSET_SECTIONS.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));
  return hit ? hit.href : null;
}

/**
 * 오른쪽에 떠서 스크롤해도 따라다니는 Asset 섹션 메뉴.
 * 넓은 화면에서는 본문(412px) 바로 오른쪽 바깥, 좁은 화면에서는 화면 오른쪽 끝.
 */
export function AssetSectionRail({ pathname }: { pathname: string }) {
  const current = assetSectionOf(pathname);
  if (!current) return null;

  return (
    <nav
      aria-label="Asset 메뉴"
      className="fixed right-1.5 min-[540px]:right-auto min-[540px]:left-[calc(50%+216px)] top-1/2 z-[90] -translate-y-1/2 flex flex-col gap-1 rounded-2xl border border-gray-200/80 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 p-1 shadow-lg backdrop-blur-md"
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
