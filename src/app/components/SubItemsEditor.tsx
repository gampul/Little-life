'use client';

import { useState } from 'react';
import {
  MAX_SUB_ITEMS,
  makeSubItemKey,
  type RoutineSubItem,
} from '../../lib/routineSubItems';

const UNIT_PRESETS = ['분', 'km', '회', '원', 'page'];

interface Props {
  items: RoutineSubItem[];
  onChange: (items: RoutineSubItem[]) => void;
  disabled?: boolean;
}

/**
 * 설정 → 루틴 설정 → 복합 타입: 하위 항목(이름 + 단위) 추가·수정·삭제·순서
 * key 는 최초 생성 시 라벨로 만들고 이후 라벨을 바꿔도 유지(기록과의 연결 보존).
 */
export default function SubItemsEditor({ items, onChange, disabled = false }: Props) {
  const [newLabel, setNewLabel] = useState('');
  const [newUnit, setNewUnit] = useState('분');

  const update = (idx: number, patch: Partial<RoutineSubItem>) => {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  const add = () => {
    const label = newLabel.trim();
    if (!label || items.length >= MAX_SUB_ITEMS) return;
    onChange([...items, { key: makeSubItemKey(label, items), label, unit: newUnit.trim() }]);
    setNewLabel('');
  };

  const unitSelect = (value: string, onPick: (u: string) => void) => (
    <select
      value={UNIT_PRESETS.includes(value) || value === '' ? value : '__custom__'}
      onChange={(e) => {
        const v = e.target.value;
        if (v === '__custom__') {
          const custom = prompt('단위를 입력하세요 (예: km, 분, 회)');
          if (custom && custom.trim()) onPick(custom.trim());
        } else {
          onPick(v);
        }
      }}
      disabled={disabled}
      className="w-[72px] px-1.5 py-0 text-[11px] h-[28px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded"
      aria-label="단위"
    >
      <option value="">단위 없음</option>
      {UNIT_PRESETS.map((u) => (
        <option key={u} value={u}>{u}</option>
      ))}
      {value && !UNIT_PRESETS.includes(value) && (
        <option value="__custom__">{value}</option>
      )}
      {(!value || UNIT_PRESETS.includes(value)) && <option value="__custom__">+ 직접 입력</option>}
    </select>
  );

  return (
    <div className="mt-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-1.5 space-y-1">
      <div className="text-[11px] text-gray-600 dark:text-gray-400">
        하위 항목 <span className="text-gray-400">({items.length}/{MAX_SUB_ITEMS})</span>
        <span className="ml-1 text-gray-400">— 기록할 때 체크하면 단위 값을 입력할 수 있어요</span>
      </div>

      {items.map((it, idx) => (
        <div key={it.key} className="flex items-center gap-1">
          <input
            type="text"
            value={it.label}
            onChange={(e) => update(idx, { label: e.target.value })}
            disabled={disabled}
            placeholder="항목 이름"
            className="flex-1 min-w-0 px-2 py-0 h-[28px] text-[11px] bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500 rounded"
            aria-label={`하위 항목 ${idx + 1} 이름`}
          />
          {unitSelect(it.unit, (u) => update(idx, { unit: u }))}
          <button type="button" onClick={() => move(idx, -1)} disabled={disabled || idx === 0}
            className="px-0.5 text-sm text-gray-700 dark:text-gray-300 disabled:opacity-30" title="위로" aria-label="위로">↑</button>
          <button type="button" onClick={() => move(idx, 1)} disabled={disabled || idx === items.length - 1}
            className="px-0.5 text-sm text-gray-700 dark:text-gray-300 disabled:opacity-30" title="아래로" aria-label="아래로">↓</button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`'${it.label}' 항목을 삭제할까요? 지난 기록의 이 항목 값은 화면에서 보이지 않게 됩니다.`)) remove(idx);
            }}
            disabled={disabled}
            className="px-1.5 h-[26px] text-[11px] bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-50"
            title="항목 삭제"
          >
            삭제
          </button>
        </div>
      ))}

      {items.length < MAX_SUB_ITEMS && (
        <div className="flex items-center gap-1 pt-0.5">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                add();
              }
            }}
            disabled={disabled}
            placeholder="새 항목 (예: 800km)"
            className="flex-1 min-w-0 px-2 py-0 h-[28px] text-[11px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500 rounded"
            aria-label="새 하위 항목 이름"
          />
          {unitSelect(newUnit, setNewUnit)}
          <button
            type="button"
            onClick={add}
            disabled={disabled || !newLabel.trim()}
            className="px-2 h-[28px] text-[11px] bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-40 whitespace-nowrap"
          >
            + 추가
          </button>
        </div>
      )}
    </div>
  );
}
