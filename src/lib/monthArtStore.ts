'use client';

/**
 * 이달의 그림 저장소 — routine_month_art 테이블 + 비공개 month-art 버킷.
 *  - 직접 올린 그림: month-art/{uid}/{month}-{ts}.{ext} (비공개 → 서명 URL 로 표시)
 *  - 랜덤 그림: 이미 올린 루틴 사진(공개 주소) 또는 다른 달 그림을 그대로 가리킴
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getSupabase } from './supabase';
import { compressImage } from './compressImage';

export interface MonthArtRow {
  month: string;
  storage_path: string | null;
  image_url: string | null;
  source: 'upload' | 'random';
  completed_at: string | null;
}

export interface MonthArt extends MonthArtRow {
  /** 화면에 띄울 주소 (서명 URL 또는 공개 주소) */
  src: string | null;
}

const BUCKET = 'month-art';
const SIGN_SECONDS = 60 * 60 * 24 * 7;

export const monthArtKey = (userId: string | null) => ['monthArt', userId] as const;

async function fetchMonthArt(userId: string): Promise<Record<string, MonthArt>> {
  const supabase = getSupabase();
  if (!supabase) return {};
  const { data, error } = await supabase
    .from('routine_month_art')
    .select('month, storage_path, image_url, source, completed_at')
    .eq('user_id', userId);
  if (error) throw error;
  const rows = (data ?? []) as MonthArtRow[];
  const paths = Array.from(new Set(rows.map((r) => r.storage_path).filter((p): p is string => !!p)));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGN_SECONDS);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const out: Record<string, MonthArt> = {};
  for (const r of rows) {
    out[r.month] = { ...r, src: (r.storage_path && signed.get(r.storage_path)) || r.image_url || null };
  }
  return out;
}

export function useMonthArt(userId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: monthArtKey(userId),
    queryFn: () => fetchMonthArt(userId!),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const patchLocal = useCallback(
    (month: string, art: MonthArt) => {
      qc.setQueryData<Record<string, MonthArt>>(monthArtKey(userId), (prev) => ({ ...(prev ?? {}), [month]: art }));
    },
    [qc, userId]
  );

  /** 그림 지정 (랜덤 또는 다른 달 그림 재사용). completed_at 은 유지 */
  const setArt = useCallback(
    async (month: string, pick: { storage_path?: string | null; image_url?: string | null; src: string }, source: 'upload' | 'random') => {
      const supabase = getSupabase();
      if (!supabase || !userId) return;
      const prev = (qc.getQueryData<Record<string, MonthArt>>(monthArtKey(userId)) ?? {})[month];
      const row = {
        user_id: userId,
        month,
        storage_path: pick.storage_path ?? null,
        image_url: pick.image_url ?? null,
        source,
        completed_at: prev?.completed_at ?? null,
        updated_at: new Date().toISOString(),
      };
      patchLocal(month, { month, storage_path: row.storage_path, image_url: row.image_url, source, completed_at: row.completed_at, src: pick.src });
      const { error } = await supabase.from('routine_month_art').upsert(row, { onConflict: 'user_id,month' });
      if (error) {
        console.error('이달의 그림 저장 오류:', error.message);
        throw error;
      }
    },
    [qc, userId, patchLocal]
  );

  /** 사진첩에서 고른 사진 올리기 */
  const uploadArt = useCallback(
    async (month: string, file: File) => {
      const supabase = getSupabase();
      if (!supabase || !userId) return;
      const { blob, extension, contentType } = await compressImage(file);
      const path = `${userId}/${month}-${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType });
      if (error) throw error;
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGN_SECONDS);
      const src = data?.signedUrl ?? URL.createObjectURL(blob);
      await setArt(month, { storage_path: path, src }, 'upload');
    },
    [userId, setArt]
  );

  /** 그림 완성 기록 (한 번만) */
  const markComplete = useCallback(
    async (month: string) => {
      const supabase = getSupabase();
      if (!supabase || !userId) return;
      const prev = (qc.getQueryData<Record<string, MonthArt>>(monthArtKey(userId)) ?? {})[month];
      if (!prev || prev.completed_at) return;
      const completed_at = new Date().toISOString();
      patchLocal(month, { ...prev, completed_at });
      await supabase
        .from('routine_month_art')
        .update({ completed_at, updated_at: completed_at })
        .eq('user_id', userId)
        .eq('month', month)
        .is('completed_at', null);
    },
    [qc, userId, patchLocal]
  );

  return { arts: query.data ?? {}, loaded: query.isFetched || !userId, setArt, uploadArt, markComplete };
}
