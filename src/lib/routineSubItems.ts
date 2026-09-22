/**
 * 복합 루틴(type = 'multi') 공용 타입·헬퍼
 *
 * - routine_templates.sub_items : RoutineSubItem[]   (설정에서 정의)
 * - daily_routine_checks.sub_values : SubValues      (날짜별 기록)
 *   키가 있으면 그 항목을 체크한 것, 값이 null 이면 체크만 하고 수치는 입력하지 않은 것
 */

export type RoutineType = 'checkbox' | 'number' | 'multi';

export interface RoutineSubItem {
  key: string;
  label: string;
  unit: string;
}

export type SubValues = Record<string, number | null>;

export const MAX_SUB_ITEMS = 6;

/** DB(jsonb) 에서 온 값을 안전하게 배열로 정규화 */
export function normalizeSubItems(raw: unknown): RoutineSubItem[] {
  if (!Array.isArray(raw)) return [];
  const out: RoutineSubItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    const key = typeof o.key === 'string' ? o.key.trim() : '';
    const label = typeof o.label === 'string' ? o.label.trim() : '';
    if (!key || !label) continue;
    out.push({ key, label, unit: typeof o.unit === 'string' ? o.unit.trim() : '' });
  }
  return out.slice(0, MAX_SUB_ITEMS);
}

/** DB(jsonb) 에서 온 값을 안전하게 객체로 정규화 */
export function normalizeSubValues(raw: unknown): SubValues {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SubValues = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (v === null || v === true) out[k] = null;
  }
  return out;
}

/** 하위 항목 새 key 생성 (라벨 기반 slug + 중복 회피) */
export function makeSubItemKey(label: string, existing: RoutineSubItem[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'item';
  let key = base;
  let n = 2;
  const taken = new Set(existing.map((s) => s.key));
  while (taken.has(key)) key = `${base}_${n++}`;
  return key;
}

export const formatSubValue = (v: number): string =>
  Number.isInteger(v) ? String(v) : v.toFixed(1);

/** 체크된 하위 항목 수 */
export function countCheckedSubItems(values: SubValues | null | undefined, items: RoutineSubItem[]): number {
  if (!values) return 0;
  return items.filter((it) => Object.prototype.hasOwnProperty.call(values, it.key)).length;
}

/**
 * 피드·툴팁용 한 줄 요약. 예: "800km 5.2km · Devops 30분 · 1Day Class"
 * (체크만 하고 값이 없는 항목은 라벨만)
 */
export function summarizeSubValues(values: SubValues | null | undefined, items: RoutineSubItem[]): string {
  if (!values) return '';
  return items
    .filter((it) => Object.prototype.hasOwnProperty.call(values, it.key))
    .map((it) => {
      const v = values[it.key];
      return v == null ? it.label : `${it.label} ${formatSubValue(v)}${it.unit}`;
    })
    .join(' · ');
}
