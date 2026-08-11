'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '../lib/supabase';

/** 목록 카드용 — 실제 memos 컬럼만 (likes/comments 컬럼 없음) */
export interface MemoListItem {
  id?: string;
  title: string;
  excerpt?: string | null;
  cover_image?: string | null;
  created_at?: string;
  updated_at?: string;
  category_id?: string | null;
  memo_categories?: { name: string } | null;
}

export interface MemosPageResult {
  memos: MemoListItem[];
  totalCount: number;
}

export const MEMOS_QUERY_KEY = ['memos'] as const;

/**
 * PostgREST `.or()` + `ilike` 패턴용 이스케이프.
 * %, _, ", \ 및 or() 구분자(, .) 가 검색어에 있어도 깨지지 않게 값을 따옴표로 감싼다.
 */
function toIlikeOrPattern(raw: string): string {
  const escaped = raw
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

async function fetchMemosPage(
  page: number,
  pageSize: number,
  categoryIds: string[] | null,
  searchTerm: string
): Promise<MemosPageResult> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 없습니다.');
  }

  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize - 1;

  // 실제 스키마에 있는 컬럼만 select (likes/comments 없음 — 400 방지)
  // 검색 필터만 title/content 사용 (둘 다 실존 컬럼). select 목록에는 content 미포함.
  //
  // 성능 메모: 현재는 ilike 부분일치로 충분.
  // 글이 많아지면 title/content 에 pg_trgm GIN 또는 to_tsvector 전문검색 인덱스를 검토:
  //   CREATE INDEX memos_title_trgm ON memos USING gin (title gin_trgm_ops);
  //   CREATE INDEX memos_content_trgm ON memos USING gin (content gin_trgm_ops);
  //   -- 또는 tsvector 생성 컬럼 + GIN 인덱스 후 plainto_tsquery 로 전환
  let query = supabase
    .from('memos')
    .select(
      'id, title, excerpt, cover_image, created_at, updated_at, category_id, memo_categories(name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  // 단일 카테고리는 eq, 대분류(부모+자식) 선택 시 여러 id를 in() 으로 필터
  if (categoryIds && categoryIds.length > 0) {
    if (categoryIds.length === 1) {
      query = query.eq('category_id', categoryIds[0]);
    } else {
      query = query.in('category_id', categoryIds);
    }
  }

  const q = searchTerm.trim();
  if (q) {
    const pattern = toIlikeOrPattern(q);
    // title OR content 부분일치 (대소문자 무시), 카테고리 조건과 AND
    query = query.or(`title.ilike.${pattern},content.ilike.${pattern}`);
  }

  query = query.range(startIndex, endIndex);

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
  categoryIds: string[] | null,
  pageSize: number = 10,
  searchTerm: string = ''
) {
  const normalizedSearch = searchTerm.trim();
  // 안정적인 캐시 키 (id 목록 순서 무관)
  const categoryKey =
    categoryIds && categoryIds.length > 0 ? [...categoryIds].sort().join(',') : null;

  return useQuery({
    queryKey: [...MEMOS_QUERY_KEY, page, categoryKey, pageSize, normalizedSearch],
    queryFn: () => fetchMemosPage(page, pageSize, categoryIds, normalizedSearch),
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
