'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLongPress } from '../../hooks/useLongPress';

interface Props {
  checked: boolean;
  hasMemo: boolean;
  ariaLabel: string;
  /** 체크 ↔ 해제 토글 (해제 시 확인창은 호출 측에서 처리) */
  onToggle: () => void;
  /** 메모·값·사진 입력 시트 열기 */
  onOpenMemo: () => void;
}

/**
 * 데일리 루틴 체크 칸 (최근 5일)
 * - 미체크 칸 탭: 즉시 체크
 * - 체크된 칸 탭: 칸 아래에 작은 액션바(체크 해제 / 메모·값 입력) — 실수로 풀리는 것 방지
 * - 길게 누르기 / 우클릭 / Shift+Enter: 바로 입력 시트 (지름길로 유지)
 */
export default function CheckCell({ checked, hasMemo, ariaLabel, onToggle, onOpenMemo }: Props) {
  const cellRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [menu, setMenu] = useState<{ top: number; right: number; up: boolean } | null>(null);

  const closeMenu = useCallback(() => setMenu(null), []);

  const openMenu = useCallback(() => {
    const el = cellRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // 아래 공간이 부족하면 위로 띄움 (하단 탭바 ~90px 고려)
    const up = r.bottom + 60 > vh - 90;
    setMenu({
      top: up ? r.top - 6 : r.bottom + 6,
      right: Math.max(8, vw - r.right),
      up,
    });
  }, []);

  const handleTap = useCallback(() => {
    if (menu) {
      closeMenu();
      return;
    }
    if (checked) openMenu();
    else onToggle();
  }, [menu, checked, openMenu, onToggle, closeMenu]);

  const handleLongPress = useCallback(() => {
    closeMenu();
    onOpenMemo();
  }, [closeMenu, onOpenMemo]);

  const press = useLongPress({ onClick: handleTap, onLongPress: handleLongPress });

  // 바깥 탭 / ESC / 스크롤 시 액션바 닫기
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || cellRef.current?.contains(t)) return;
      closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', closeMenu, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', closeMenu);
    };
  }, [menu, closeMenu]);

  // 체크가 외부에서 풀리면(예: 시트에서 삭제) 액션바도 닫기
  useLayoutEffect(() => {
    if (!checked) setMenu(null);
  }, [checked]);

  return (
    <>
      <div
        ref={cellRef}
        {...press}
        role="checkbox"
        aria-checked={checked}
        aria-haspopup={checked ? 'menu' : undefined}
        aria-expanded={checked ? !!menu : undefined}
        aria-label={`${ariaLabel}${hasMemo ? ', 메모 있음' : ''}. ${checked ? '탭하면 해제·입력 메뉴' : '탭하면 체크'}, 길게 누르면 입력`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            onOpenMemo();
          } else if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleTap();
          }
        }}
        style={{
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          // 브라우저가 스크롤로 가로채지 않도록 → 길게 누르기가 pointercancel 로 끊기지 않음
          touchAction: 'none',
        }}
        className={`relative w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          checked
            ? 'bg-[#474c56] border-[#474c56]'
            : 'bg-white dark:bg-gray-800 border border-gray-700 dark:border-gray-500'
        } ${menu ? 'ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-gray-900' : ''}`}
      >
        {checked && (
          <svg width="12" height="9" viewBox="0 0 12 9" fill="none" aria-hidden>
            <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {hasMemo && (
          <span
            aria-hidden="true"
            className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-blue-500 ring-1 ring-white dark:ring-gray-800 pointer-events-none"
          />
        )}
      </div>

      {menu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popRef}
            role="menu"
            aria-label="루틴 칸 메뉴"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              right: menu.right,
              ...(menu.up ? { bottom: window.innerHeight - menu.top } : { top: menu.top }),
              zIndex: 90,
            }}
            className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-lg animate-fade-in"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                onToggle();
              }}
              style={{ touchAction: 'manipulation' }}
              className="h-9 px-3 rounded-lg text-[13px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 whitespace-nowrap"
            >
              체크 해제
            </button>
            <span aria-hidden className="w-px h-5 bg-gray-200 dark:bg-gray-600" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                onOpenMemo();
              }}
              style={{ touchAction: 'manipulation' }}
              className="h-9 px-3 rounded-lg text-[13px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 active:bg-blue-100 whitespace-nowrap"
            >
              {hasMemo ? '메모·사진 보기' : '메모·사진 입력'}
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
