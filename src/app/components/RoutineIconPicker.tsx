'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ROUTINE_ICON_GROUPS } from '../../lib/routineIcons';

/**
 * 루틴 아이콘 선택 시트 — 모바일은 하단 시트, 넓은 화면은 가운데 카드.
 * 선택하면 바로 onSelect (저장은 부모가 처리).
 */
export default function RoutineIconPicker({
  open,
  routineLabel,
  value,
  onSelect,
  onClose,
}: {
  open: boolean;
  routineLabel: string;
  /** 현재 적용 중인 아이콘 키 (저장값 또는 이름으로 추정한 값) */
  value: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="아이콘 선택">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 shadow-xl pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">아이콘 선택</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{routineLabel || '루틴'}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 inline-flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-4">
          {ROUTINE_ICON_GROUPS.map((group) => (
            <section key={group.title}>
              <h4 className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1.5">{group.title}</h4>
              <div className="grid grid-cols-6 sm:grid-cols-7 gap-1">
                {group.items.map(({ key, name, C }) => {
                  const selected = key === value;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onSelect(key)}
                      aria-pressed={selected}
                      title={name}
                      style={{ touchAction: 'manipulation' }}
                      className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg transition-colors ${
                        selected
                          ? 'text-[#474c56] dark:text-[#c9ccd3] ring-1 ring-[#474c56]/40 dark:ring-[#c9ccd3]/40'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <C size={22} stroke={1.5} />
                      <span className="text-[10px] leading-none text-gray-400 dark:text-gray-500">{name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
