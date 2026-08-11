'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '../lib/supabase';

/** 목록 카드용 — content(본문) 제외 */
export interface MemoListItem {
  id?: string;
  title: string;
  excerpt?: string | null;
  cover_image?: string | null;
  created_at?: string;
  updated_at?: string;
  likes?: number;
  comments?: number;
  category_id?: string | null;
  memo_categories?: { name: string } | null;
}

export interface MemosPageResult {
  memos: MemoListItem[];
  totalCount: number;
}

export const MEMOS_QUERY_KEY = ['memos'] as const;

async function fetchMemosPage(
  page: number,
  pageSize: number,
  categoryId: string | null
): Promise<MemosPageResult> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 없습니다.');
  }

  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize - 1;

  // 목록에 필요한 컬럼만 (content 본문 제외)
  let query = supabase
    .from('memos')
    .select(
      'id, title, excerpt, cover_image, likes, comments, created_at, updated_at, category_id, memo_categories(name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(startIndex, endIndex);

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, count, error } = await query;
  if (error) {
    throw error;
  }

  return {
    memos: (data as unknown as MemoListItem[]) ?? [],
    totalCount: count ?? 0,
  };
}

export function useMemos(
  page: number,
  categoryId: string | null,
  pageSize: number = 10
) {
  return useQuery({
    queryKey: [...MEMOS_QUERY_KEY, page, categoryId, pageSize],
    queryFn: () => fetchMemosPage(page, pageSize, categoryId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useInvalidateMemos() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: MEMOS_QUERY_KEY }),
    [queryClient]
  );
}

/** 캐시에 있는 메모 한 건만 부분 갱신 (전체 refetch 없음) */
export function usePatchMemoInCache() {
  const queryClient = useQueryClient();
  return (memoId: string, patch: Partial<MemoListItem>) => {
    queryClient.setQueriesData<MemosPageResult>({ queryKey: MEMOS_QUERY_KEY }, (old) => {
      if (!old) return old;
      return {
        ...old,
        memos: old.memos.map((m) => (m.id === memoId ? { ...m, ...patch } : m)),
      };
    });
  };
}
