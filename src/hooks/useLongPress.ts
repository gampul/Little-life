'use client';

import { useCallback, useRef } from 'react';
import type React from 'react';

interface Options {
  onLongPress: () => void;
  onClick?: () => void;
  /** 길게 누르기로 인식하는 시간(ms) */
  delay?: number;
  /** 이 거리(px) 이상 움직이면 스크롤로 보고 취소 */
  moveTolerance?: number;
  /** 길게 누르기 발동 시 짧은 진동 (지원 기기만) */
  haptic?: boolean;
}

/**
 * 탭 / 길게 누르기 구분 훅 (pointer 이벤트 기반, 터치·마우스 공용)
 * - 짧게 탭: onClick
 * - delay 이상 누름: onLongPress (뒤따르는 click 은 무시)
 * - 누른 채 크게 움직이면(스크롤) 취소
 * - 우클릭(contextmenu)도 onLongPress 로 처리 → 데스크톱 대안
 *
 * 모바일 안정화:
 * - setPointerCapture 로 손가락이 작은 요소 밖으로 조금 벗어나도 pointerleave 로 취소되지 않음
 * - 요소에는 `touch-action: none` 을 주어 브라우저가 스크롤 제스처로 가로채(pointercancel) 취소하는 것을 방지
 * - iOS 텍스트 선택/콜아웃 메뉴는 요소의 user-select / -webkit-touch-callout: none 으로 차단
 */
export function useLongPress({
  onLongPress,
  onClick,
  delay = 400,
  moveTolerance = 24,
  haptic = true,
}: Options) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const fire = useCallback(() => {
    firedRef.current = true;
    timerRef.current = null;
    if (haptic && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12);
      } catch {
        /* ignore */
      }
    }
    onLongPress();
  }, [onLongPress, haptic]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      firedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      // 손가락이 요소 밖으로 살짝 나가도 pointerleave 가 아니라 계속 이 요소가 받도록
      try {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(fire, delay);
    },
    [fire, delay]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const start = startRef.current;
      if (!start) return;
      if (Math.abs(e.clientX - start.x) > moveTolerance || Math.abs(e.clientY - start.y) > moveTolerance) {
        clear();
      }
    },
    [clear, moveTolerance]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      clear();
    },
    [clear]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (firedRef.current) {
        // 길게 누르기가 이미 발동됨 → 이 click 은 버림
        firedRef.current = false;
        e.preventDefault();
        return;
      }
      onClick?.();
    },
    [onClick]
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // 브라우저 기본 컨텍스트 메뉴(모바일 길게 누르기 메뉴 포함) 차단
      e.preventDefault();
      e.stopPropagation();
      // 터치 길게 누르기에서 이미 발동된 경우 중복 방지
      if (firedRef.current) return;
      clear();
      fire();
    },
    [clear, fire]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: clear,
    onClick: handleClick,
    onContextMenu,
  };
}
