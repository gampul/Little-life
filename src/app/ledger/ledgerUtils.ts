// Ledger 화면 공용 도우미 — KST 날짜 계산, 금액 표시, 분류 아이콘

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type TxType = '수입' | '지출' | '자산이체';

export interface LedgerTx {
  id: string;
  date: string;
  asset: string;
  category: string;
  sub_category?: string | null;
  transaction_type: TxType;
  is_transfer: boolean;
  transfer_asset?: string | null;
  amount: number;
  memo?: string | null;
  currency?: string;
  source?: string;
  created_at?: string;
}

/** 저장된 시각을 KST 로 옮긴 Date (getUTC* 로 읽기) */
export function toKst(dateStr: string): Date {
  return new Date(new Date(dateStr).getTime() + KST_OFFSET_MS);
}

export function kstYmd(dateStr: string): string {
  return toKst(dateStr).toISOString().slice(0, 10);
}

/** 그 달 1일 00:00 KST 의 ISO 문자열 (month: 1-12, 범위 밖이면 연도 넘김) */
export function kstMonthStartIso(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month - 1, 1));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01T00:00:00+09:00`;
}

/**
 * 시각 표시 — 시간이 저장되지 않은 거래(KST 00:00, 또는 날짜만 저장되어 UTC 00:00)는 숨김
 */
export function kstTimeLabel(dateStr: string): string | null {
  const raw = new Date(dateStr);
  if (raw.getUTCHours() === 0 && raw.getUTCMinutes() === 0 && raw.getUTCSeconds() === 0) return null;
  const k = toKst(dateStr);
  const h = k.getUTCHours();
  const m = k.getUTCMinutes();
  if (h === 0 && m === 0) return null;
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${String(m).padStart(2, '0')}`;
}

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const won = (n: number) => new Intl.NumberFormat('ko-KR').format(Math.round(n));

const CATEGORY_ICONS: [RegExp, string][] = [
  [/식비|식사|외식/, '🍜'],
  [/coffee|커피|카페/i, '☕'],
  [/담배/, '🚬'],
  [/drink|술|주류/i, '🍺'],
  [/교통|차량|주유/, '🚗'],
  [/의료|병원|약/, '🩹'],
  [/자기계발|교육|도서/, '📚'],
  [/여가|문화|취미/, '🎬'],
  [/주거|통신/, '🏠'],
  [/경조사|회비|선물/, '🎁'],
  [/패션|미용|의류/, '👕'],
  [/가족|육아/, '👨‍👩‍👧'],
  [/세금|보험|손실/, '🧾'],
  [/대출/, '😱'],
  [/기부|헌금/, '🙏'],
  [/생활/, '🧺'],
  [/근로|급여|월급/, '💼'],
  [/사업/, '🏢'],
  [/금융|배당|이자/, '📈'],
  [/기타소득|용돈/, '🌈'],
  [/이체/, '🔁'],
];

export function categoryIcon(category: string | null | undefined): string {
  const c = category ?? '';
  for (const [re, icon] of CATEGORY_ICONS) if (re.test(c)) return icon;
  return '•';
}

export function amountClass(type: TxType): string {
  if (type === '수입') return 'text-blue-600 dark:text-blue-400';
  if (type === '지출') return 'text-red-500 dark:text-red-400';
  return 'text-gray-500 dark:text-gray-400';
}
