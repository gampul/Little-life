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
  /** 중요공지(고정) 여부 — add_memo_pinned.sql 이전 환경에서는 undefined */
  is_pinned?: boolean;
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

/** is_pinned 컬럼이 아직 없는 DB (add_memo_pinned.sql 미실행) */
export const isMissingPinnedColumn = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === '42703' || /is_pinned/.test(e.message || ''));

const LIST_COLS = 'id, title, excerpt, cover_image, created_at, updated_at, category_id, memo_categories(name)';

async function fetchMemosPage(
  page: number,
  pageSize: number,
  categoryIds: string[] | null,
  searchTerm: string,
  pinnedOnly: boolean,
  withPinnedCol = true
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
    .select(withPinnedCol ? `${LIST_COLS}, is_pinned` : LIST_COLS, { count: 'exact' })
    .order('created_at', { ascending: false });

  // 중요공지 탭: 고정 글만 (카테고리 무관)
  if (pinnedOnly) query = query.eq('is_pinned', true);

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
    // 컬럼이 없는 환경: 고정 글 목록은 빈 결과, 일반 목록은 컬럼 없이 재조회
    if (withPinnedCol && isMissingPinnedColumn(error)) {
      if (pinnedOnly) return { memos: [], totalCount: 0 };
      return fetchMemosPage(page, pageSize, categoryIds, searchTerm, false, false);
    }
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
  searchTerm: string = '',
  pinnedOnly: boolean = false
) {
  const normalizedSearch = searchTerm.trim();
  // 안정적인 캐시 키 (id 목록 순서 무관)
  const categoryKey =
    categoryIds && categoryIds.length > 0 ? [...categoryIds].sort().join(',') : null;

  return useQuery({
    queryKey: [...MEMOS_QUERY_KEY, page, categoryKey, pageSize, normalizedSearch, pinnedOnly],
    queryFn: () => fetchMemosPage(page, pageSize, categoryIds, normalizedSearch, pinnedOnly),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

export const PINNED_COUNT_QUERY_KEY = [...MEMOS_QUERY_KEY, 'pinnedCount'] as const;

/**
 * 중요공지 글 개수 — Diary 첫 진입 시 중요공지 탭을 기본으로 열지 결정하는 데 사용.
 * 컬럼이 없으면(마이그레이션 전) 0.
 */
export function usePinnedCount() {
  return useQuery({
    queryKey: PINNED_COUNT_QUERY_KEY,
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase) return 0;
      const { count, error } = await supabase
        .from('memos')
        .select('id', { count: 'exact', head: true })
        .eq('is_pinned', true);
      if (error) {
        if (isMissingPinnedColumn(error)) return 0;
        throw error;
      }
      return count ?? 0;
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
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

/* ------------------------------------------------------------------ */
/* memo_categories — 필터 칩·에디터 select·카테고리 관리가 한 캐시를 공유 */
/* ------------------------------------------------------------------ */

export interface MemoCategoryItem {
  id: string;
  name: string;
  sort_order: number;
  parent_id?: string | null;
}

export const MEMO_CATEGORIES_QUERY_KEY = ['memo_categories'] as const;

const DEFAULT_MEMO_CATEGORIES = ['에세이', '투자', '북스'];

async function fetchMemoCategories(userId: string | null): Promise<MemoCategoryItem[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 없습니다.');
  }

  const { data, error } = await supabase
    .from('memo_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;

  // 최초 사용자: 기본 카테고리 생성 후 다시 조회 (기존 동작 유지)
  if ((data ?? []).length === 0 && userId) {
    const { error: insertError } = await supabase.from('memo_categories').insert(
      DEFAULT_MEMO_CATEGORIES.map((name, i) => ({ name, sort_order: i, user_id: userId }))
    );
    if (!insertError) {
      const retry = await supabase
        .from('memo_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (retry.error) throw retry.error;
      return (retry.data ?? []) as MemoCategoryItem[];
    }
  }

  return (data ?? []) as MemoCategoryItem[];
}

/**
 * 카테고리 목록 — 컴포넌트가 여러 곳에서 써도 요청은 1회.
 * 카테고리는 거의 바뀌지 않으므로 staleTime 을 길게 두고, 추가/수정/삭제 시 invalidate 로 갱신.
 */
export function useMemoCategories(userId: string | null | undefined) {
  return useQuery({
    queryKey: MEMO_CATEGORIES_QUERY_KEY,
    queryFn: () => fetchMemoCategories(userId ?? null),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useInvalidateMemoCategories() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: MEMO_CATEGORIES_QUERY_KEY }),
    [queryClient]
  );
}
