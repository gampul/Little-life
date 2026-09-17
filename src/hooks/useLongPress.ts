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
}

/**
 * 탭 / 길게 누르기 구분 훅 (pointer 이벤트 기반, 터치·마우스 공용)
 * - 짧게 탭: onClick
 * - delay 이상 누름: onLongPress (뒤따르는 click 은 무시)
 * - 누른 채 움직이면(스크롤) 취소
 * - 우클릭(contextmenu)도 onLongPress 로 처리 → 데스크톱 대안
 */
export function useLongPress({ onLongPress, onClick, delay = 450, moveTolerance = 10 }: Options) {
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

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      firedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        timerRef.current = null;
        onLongPress();
      }, delay);
    },
    [onLongPress, delay]
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
      e.preventDefault();
      e.stopPropagation();
      // 터치 길게 누르기에서 이미 발동된 경우 중복 방지
      if (firedRef.current) return;
      clear();
      firedRef.current = false;
      onLongPress();
    },
    [clear, onLongPress]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: handleClick,
    onContextMenu,
  };
}
