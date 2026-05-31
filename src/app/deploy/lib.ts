// Deploy(투자현황) 페이지 공용 타입/상수/유틸

export interface FinanceRow {
  id: string;
  user_id: string | null;
  monthly_date: string; // 'YYYY-MM-DD'
  owner: string;
  division: string;
  bucket: string;
  asset_class: string;
  account: string | null;
  ticker: string;
  dividend: number;
  tax_fee: number;
  net_dividend: number;
  cash_flow: number;
  balance: number;
  note: string | null;
  created_at?: string;
}

export const OWNERS = ['김희창', '민수진', '김사랑'] as const;
export const DIVISIONS = ['pension', 'IRP', 'general', 'ISA', 'CRIPTO'] as const;
export const BUCKETS = ['core', 'stable', 'aggressive', 'interest'] as const;

// 목표 비율(%)
export const BUCKET_TARGETS: Record<string, number> = {
  core: 45,
  interest: 30,
  stable: 20,
  aggressive: 5,
};

export const BUCKET_LABELS: Record<string, string> = {
  core: 'Core',
  stable: 'Stable',
  aggressive: 'Aggressive',
  interest: 'Interest',
};

export const BUCKET_COLORS: Record<string, string> = {
  core: '#3B82F6',
  interest: '#F59E0B',
  stable: '#10B981',
  aggressive: '#EF4444',
};

export const OWNER_COLORS: Record<string, string> = {
  '김희창': '#3B82F6',
  '민수진': '#10B981',
  '김사랑': '#F59E0B',
};

export const PIE_PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
  '#06B6D4', '#A855F7', '#F43F5E', '#22C55E', '#EAB308',
];

// 전체 표시용 포맷 (억/만원 단위)
export function formatKRW(value: number): string {
  const abs = Math.abs(Math.round(value));
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e8) {
    const eok = Math.floor(abs / 1e8);
    const man = Math.round((abs % 1e8) / 1e4);
    return `${sign}${eok}억${man > 0 ? ` ${man.toLocaleString()}만` : ''}원`;
  }
  if (abs >= 1e4) {
    const man = Math.round(abs / 1e4);
    return `${sign}${man.toLocaleString()}만원`;
  }
  return `${sign}${abs.toLocaleString()}원`;
}

// 차트 축/툴팁용 짧은 포맷
export function formatKRWShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(1)}억`;
  if (abs >= 1e4) return `${sign}${Math.round(abs / 1e4).toLocaleString()}만`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
}

// 'YYYY-MM-DD' -> 'YYYY년 M월'
export function formatMonthLabel(monthlyDate: string): string {
  if (!monthlyDate) return '';
  const [y, m] = monthlyDate.split('-');
  return `${y}년 ${Number(m)}월`;
}

// 'YYYY-MM-DD' -> 'YY.MM' (차트 축)
export function formatMonthAxis(monthlyDate: string): string {
  if (!monthlyDate) return '';
  const [y, m] = monthlyDate.split('-');
  return `${y.slice(2)}.${m}`;
}

// 정렬된 유니크 월 목록 (오름차순)
export function getSortedMonths(rows: FinanceRow[]): string[] {
  const set = new Set(rows.map((r) => r.monthly_date));
  return Array.from(set).sort();
}

// 월별 전체 balance 합계
export function totalBalanceByMonth(rows: FinanceRow[]): { month: string; balance: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.monthly_date, (map.get(r.monthly_date) ?? 0) + (Number(r.balance) || 0));
  }
  return Array.from(map.entries())
    .map(([month, balance]) => ({ month, balance }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// 특정 월 balance 합계
export function sumBalanceForMonth(rows: FinanceRow[], month: string): number {
  return rows
    .filter((r) => r.monthly_date === month)
    .reduce((acc, r) => acc + (Number(r.balance) || 0), 0);
}

// key별 balance 합계 (특정 월)
export function sumBalanceByKey(
  rows: FinanceRow[],
  month: string,
  key: 'bucket' | 'asset_class' | 'owner',
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const r of rows) {
    if (r.monthly_date !== month) continue;
    const k = String(r[key] ?? '미지정');
    result[k] = (result[k] ?? 0) + (Number(r.balance) || 0);
  }
  return result;
}

// 월별 net_dividend 합계
export function netDividendByMonth(rows: FinanceRow[]): { month: string; net: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.monthly_date, (map.get(r.monthly_date) ?? 0) + (Number(r.net_dividend) || 0));
  }
  return Array.from(map.entries())
    .map(([month, net]) => ({ month, net }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
