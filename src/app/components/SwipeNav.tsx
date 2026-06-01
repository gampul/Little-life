'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Daily → Diary → Ledger → Asset → Deploy → AI Agent
const ROUTES = ['/daily', '/memo', '/ledger', '/assets', '/deploy', '/ai'] as const;

function isInteractiveTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  // closest를 사용하여 부모 요소까지 확인 (예: <button><strong>B</strong></button>)
  return !!el.closest('button, a, input, textarea, select, label, [role="button"]');
}

export function SwipeNav({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '';

  const currentIndex = useMemo(() => {
    const idx = ROUTES.findIndex((r) => pathname === r);
    return idx;
  }, [pathname]);

  const [enabled, setEnabled] = useState(false);
  const startRef = useRef<{ x: number; y: number; t: number; target: EventTarget | null } | null>(null);
  const lockedRef = useRef(false);

  useEffect(() => {
    const update = () => {
      if (typeof window === 'undefined') return;
      const isSmall = window.matchMedia('(max-width: 639px)').matches; // <sm
      const isTouch = (navigator.maxTouchPoints ?? 0) > 0;
      setEnabled(isSmall && isTouch);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const goTo = (nextIdx: number) => {
    const nextPath = ROUTES[nextIdx];
    if (!nextPath) return;
    router.push(nextPath);
  };

  if (currentIndex < 0) return <>{children}</>;

  return (
    <div
      onTouchStart={(e) => {
        if (!enabled) return;
        if (lockedRef.current) return;
        if (e.touches.length !== 1) return;
        // 스와이프 무시 대상(입력/버튼 등)
        if (isInteractiveTarget(e.target)) return;

        const touch = e.touches[0];
        startRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now(), target: e.target };
      }}
      onTouchEnd={(e) => {
        if (!enabled) return;
        if (lockedRef.current) return;
        const start = startRef.current;
        startRef.current = null;
        if (!start) return;
        if (isInteractiveTarget(start.target)) return;

        const touch = e.changedTouches[0];
        if (!touch) return;

        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        const dt = Date.now() - start.t;

        // 세로 스크롤을 방해하지 않게: 가로 이동이 충분히 크고, 세로보다 훨씬 커야 함
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absX < 60) return;
        if (absX < absY * 1.5) return;
        if (dt > 600) return;

        lockedRef.current = true;
        setTimeout(() => {
          lockedRef.current = false;
        }, 350);

        // dx < 0: left swipe => next
        if (dx < 0) {
          goTo((currentIndex + 1) % ROUTES.length);
        } else {
          // right swipe => prev (wrap)
          goTo((currentIndex - 1 + ROUTES.length) % ROUTES.length);
        }
      }}
    >
      {children}
    </div>
  );
}


