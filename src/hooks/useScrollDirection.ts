'use client';

import { useSyncExternalStore } from 'react';

export type ScrollDirection = 'up' | 'down';

/**
 * 페이지 스크롤 방향을 한 개의 window 리스너로 공유하는 스토어.
 * - 아래로 스크롤: 'down' / 위로 스크롤 또는 최상단 근처: 'up'
 * - THRESHOLD 미만의 미세한 움직임(터치 떨림, 관성 스크롤 끝)은 무시
 * 구독 컴포넌트가 많아도(카드 수십 개) 리스너는 1개, 방향이 바뀔 때만 알림.
 */
const THRESHOLD = 8; // px — 이만큼 이상 움직여야 방향 전환으로 인정
const TOP_ALWAYS_SHOW = 24; // px — 이 위치보다 위면 항상 'up' 취급

let direction: ScrollDirection = 'up';
let lastY = 0;
let ticking = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = window.scrollY;
    let next: ScrollDirection = direction;

    if (y <= TOP_ALWAYS_SHOW) {
      next = 'up';
    } else if (y - lastY > THRESHOLD) {
      next = 'down';
    } else if (lastY - y > THRESHOLD) {
      next = 'up';
    } else {
      // 임계값 미만 — lastY 는 갱신하지 않아 작은 떨림이 누적되지 않음
      return;
    }

    lastY = y;
    if (next !== direction) {
      direction = next;
      emit();
    }
  });
}

function subscribe(listener: () => void) {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    lastY = window.scrollY;
    direction = 'up';
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('scroll', onScroll);
    }
  };
}

const getSnapshot = () => direction;
const getServerSnapshot = (): ScrollDirection => 'up';

export function useScrollDirection(): ScrollDirection {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
