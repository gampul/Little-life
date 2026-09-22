'use client';

import type { RoutineSubItem, SubValues } from '../../lib/routineSubItems';

interface Props {
  items: RoutineSubItem[];
  /** 체크된 항목만 키가 존재. 값이 null 이면 체크만 된 상태 */
  values: SubValues;
  /** 입력 중 문자열(소수점 입력 중 상태 유지용). 키가 없으면 values 의 숫자를 표시 */
  drafts: Record<string, string>;
  onToggle: (key: string, checked: boolean) => void;
  onDraftChange: (key: string, text: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
}

/**
 * 복합 루틴 입력: 하위 항목별 체크박스 + 체크 시 단위 값 입력란
 * (루틴 입력 시트의 체크형/숫자형 블록과 같은 톤)
 */
export default function SubItemsInput({
  items,
  values,
  drafts,
  onToggle,
  onDraftChange,
  onSubmit,
  disabled = false,
}: Props) {
  if (items.length === 0) {
    return (
      <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
        하위 항목이 없어요. 설정 → 루틴 설정에서 항목을 추가해 주세요.
      </p>
    );
  }

  return (
    <div className="mb-5 space-y-2">
      {items.map((it) => {
        const checked = Object.prototype.hasOwnProperty.call(values, it.key);
        const draft =
          drafts[it.key] !== undefined
            ? drafts[it.key]
            : values[it.key] != null
              ? String(values[it.key])
              : '';
        const inputId = `sub-item-${it.key}`;
        return (
          <div
            key={it.key}
            className={`rounded-xl border transition-colors ${
              checked
                ? 'border-gray-900 dark:border-gray-400 bg-[rgb(254,252,247)] dark:bg-gray-800'
                : 'border-gray-300 dark:border-gray-700 bg-[rgb(254,252,247)] dark:bg-gray-800'
            }`}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => onToggle(it.key, !checked)}
              disabled={disabled}
              className="w-full flex items-center gap-3 px-4 py-3 text-left disabled:opacity-50"
            >
              <span
                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                  checked
                    ? 'bg-gray-900 dark:bg-gray-600'
                    : 'bg-white dark:bg-gray-800 border border-gray-700 dark:border-gray-500'
                }`}
              >
                {checked && (
                  <svg width="14" height="11" viewBox="0 0 12 9" fill="none" aria-hidden>
                    <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className={`text-sm font-medium ${checked ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                {it.label}
              </span>
              {it.unit && !checked && (
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{it.unit}</span>
              )}
            </button>

            {/* 체크된 항목만 값 입력 노출 */}
            {checked && (
              <div className="px-4 pb-3 -mt-1">
                <label htmlFor={inputId} className="sr-only">
                  {it.label} 값{it.unit ? ` (${it.unit})` : ''}
                </label>
                <div className="relative">
                  <input
                    id={inputId}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    autoFocus
                    value={draft}
                    onChange={(e) => onDraftChange(it.key, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing && onSubmit) {
                        e.preventDefault();
                        onSubmit();
                      }
                    }}
                    placeholder="0"
                    disabled={disabled}
                    className="w-full px-4 py-2.5 pr-12 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-base focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                  />
                  {it.unit && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
                      {it.unit}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
