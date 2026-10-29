'use client';

/**
 * Asset 메뉴(Ledger·통계·자산·Deploy) 데이터 조회 + React Query 캐시 키.
 * 화면을 다시 열면 캐시를 바로 보여 주고(스켈레톤 깜빡임 없음), 오래됐으면 뒤에서 새로 받음.
 * 거래가 바뀌면 invalidateFinance() 로 관련 캐시를 한꺼번에 비움.
 */
import type { QueryClient } from '@tanstack/react-query';
import { getSupabase } from './supabase';
import { kstMonthStartIso, toKst, type LedgerTx } from '../app/ledger/ledgerUtils';

export const FINANCE_KEY = ['finance'] as const;
export const financeKeys = {
  ledgerMonth: (userId: string, year: number, month: number) => [...FINANCE_KEY, 'ledger-month', userId, year, month] as const,
  ledgerYearTotals: (userId: string, year: number) => [...FINANCE_KEY, 'ledger-year', userId, year] as const,
  statsYear: (userId: string, year: number) => [...FINANCE_KEY, 'stats-year', userId, year] as const,
  assets: (userId: string) => [...FINANCE_KEY, 'assets', userId] as const,
  deploy: (userId: string) => [...FINANCE_KEY, 'deploy', userId] as const,
};

/** 거래·자산이 바뀐 뒤 Asset 메뉴 캐시 전부 무효화 (열린 화면은 바로 다시 받음) */
export function invalidateFinance(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: FINANCE_KEY });
}

function client() {
  const s = getSupabase();
  if (!s) throw new Error('Supabase 클라이언트가 없습니다.');
  return s;
}

/** 한 달 거래 (KST) */
export async function fetchLedgerMonth(userId: string, year: number, month: number): Promise<LedgerTx[]> {
  const supabase = client();
  const from = kstMonthStartIso(year, month);
  const to = kstMonthStartIso(year, month + 1);
  const all: LedgerTx[] = [];
  const PAGE = 1000;
  for (let off = 0; ; off += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, date, asset, category, sub_category, transaction_type, is_transfer, transfer_asset, amount, memo, created_at')
      .eq('user_id', userId)
      .gte('date', from)
      .lt('date', to)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(off, off + PAGE - 1);
    if (error) throw error;
    all.push(...((data ?? []) as LedgerTx[]));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

export interface Totals {
  income: number;
  expense: number;
}

/** 그 해 월별 수입·지출 합계 (KST) */
export async function fetchLedgerYearTotals(userId: string, year: number): Promise<Totals[]> {
  const supabase = client();
  const arr: Totals[] = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
  const PAGE = 1000;
  for (let off = 0; ; off += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('date, transaction_type, amount')
      .eq('user_id', userId)
      .in('transaction_type', ['수입', '지출'])
      .gte('date', kstMonthStartIso(year, 1))
      .lt('date', kstMonthStartIso(year + 1, 1))
      .order('date', { ascending: true })
      .range(off, off + PAGE - 1);
    if (error) throw error;
    for (const r of data ?? []) {
      const mi = toKst(r.date).getUTCMonth();
      if (r.transaction_type === '수입') arr[mi].income += Number(r.amount) || 0;
      else arr[mi].expense += Number(r.amount) || 0;
    }
    if (!data || data.length < PAGE) break;
  }
  return arr;
}

export interface StatsRow {
  date: string;
  transaction_type: string;
  category: string | null;
  sub_category: string | null;
  amount: number;
  asset?: string | null;
  memo?: string | null;
}

/** 통계용 — 그 해 수입·지출 원본 행 */
export async function fetchStatsYear(userId: string, year: number): Promise<StatsRow[]> {
  const supabase = client();
  const all: StatsRow[] = [];
  const PAGE = 1000;
  for (let off = 0; ; off += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('date, transaction_type, category, sub_category, amount, asset, memo')
      .eq('user_id', userId)
      .in('transaction_type', ['수입', '지출'])
      .gte('date', kstMonthStartIso(year, 1))
      .lt('date', kstMonthStartIso(year + 1, 1))
      .order('date', { ascending: true })
      .range(off, off + PAGE - 1);
    if (error) throw error;
    all.push(...((data ?? []) as StatsRow[]));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

export interface AssetsData {
  balances: { asset_name: string; balance: number; is_debt: boolean }[];
  categories: { id: string; name: string; type: 'asset' | 'debt'; sort_order: number }[];
  mappings: { asset_name: string; category_id: string | null }[];
}

/** 자산 화면 — 잔액·자산 그룹·매핑 */
export async function fetchAssets(userId: string): Promise<AssetsData> {
  const supabase = client();
  const [balRes, catRes, mapRes] = await Promise.all([
    supabase.rpc('get_asset_balances', { p_user_id: userId }),
    supabase.from('asset_categories').select('id, name, type, sort_order').eq('user_id', userId).order('sort_order'),
    supabase.from('asset_category_mappings').select('asset_name, category_id').eq('user_id', userId),
  ]);
  if (balRes.error) throw balRes.error;
  return {
    balances: ((balRes.data ?? []) as AssetsData['balances']).map((b) => ({ ...b, balance: Number(b.balance) || 0 })),
    categories: (catRes.data ?? []) as AssetsData['categories'],
    mappings: (mapRes.data ?? []) as AssetsData['mappings'],
  };
}

/** Deploy(투자현황) — finance_investments 전체 */
export async function fetchDeployRows<T = Record<string, unknown>>(userId: string): Promise<T[]> {
  const supabase = client();
  const { data, error } = await supabase
    .from('finance_investments')
    .select('*')
    .eq('user_id', userId)
    .order('monthly_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as T[];
}
