'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  IconCalendarCheck,
  IconNotebook,
  IconBuildingBank,
  IconWand,
} from '@tabler/icons-react';
import { APP_HORIZONTAL_CONTAINER } from './container';
import { ASSET_LAST_SECTION_KEY, AssetSectionRail, assetSectionOf } from './AssetSectionRail';

export interface FooterNavProps {}

export function FooterNav(props: FooterNavProps) {
  const pathname = usePathname();
  const assetSection = assetSectionOf(pathname);

  // Asset 탭은 마지막으로 본 화면(Ledger·통계·자산·Deploy)으로 — 처음이면 Ledger
  const [assetHref, setAssetHref] = useState('/ledger');
  useEffect(() => {
    if (assetSection) {
      try { localStorage.setItem(ASSET_LAST_SECTION_KEY, assetSection); } catch {}
      setAssetHref(assetSection);
      return;
    }
    try {
      const saved = localStorage.getItem(ASSET_LAST_SECTION_KEY);
      if (saved && assetSectionOf(saved)) setAssetHref(saved);
    } catch {}
  }, [assetSection]);

  const navItems = [
    { key: 'daily', href: '/daily', label: 'Daily', icon: IconCalendarCheck, active: pathname === '/daily' || pathname === '/' },
    { key: 'diary', href: '/memo', label: 'Diary', icon: IconNotebook, active: pathname.startsWith('/memo') },
    { key: 'asset', href: assetHref, label: 'Asset', icon: IconBuildingBank, active: !!assetSection },
    { key: 'ai', href: '/ai', label: 'AI Agent', icon: IconWand, active: pathname.startsWith('/ai') },
  ];

  return (
    <>
      <AssetSectionRail pathname={pathname} />
      <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-[rgb(254,252,247)] dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className={APP_HORIZONTAL_CONTAINER}>
          <div className="flex items-center justify-between gap-1 px-1 py-2">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={item.active ? 'page' : undefined}
                  className={`flex flex-col items-center justify-center flex-1 min-w-0 h-[58px] rounded-lg transition-colors ${
                    item.active
                      ? 'bg-gray-900 dark:bg-gray-700 text-white dark:text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <IconComponent size={22} stroke={1.5} />
                  <span className="text-[10px] font-medium mt-1 truncate max-w-full px-0.5">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
