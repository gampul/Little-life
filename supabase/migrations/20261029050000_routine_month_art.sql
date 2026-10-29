-- 루틴 기록 달력 "이달의 그림" (2026-10-29)
-- 달마다 그림 한 장: 사용자가 사진첩에서 올리거나(upload), 없으면 이미 올린 사진 중 랜덤(random).
-- 하루 루틴 점수만큼 그 날짜 칸이 흑백 → 컬러. 한 달 평균 80% 넘으면 completed_at 기록(컬렉션).

create table if not exists public.routine_month_art (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),            -- 'YYYY-MM'
  storage_path text,                                               -- month-art 버킷 경로 (직접 올린 그림)
  image_url text,                                                  -- 공개 이미지 주소 (랜덤으로 고른 루틴 사진 등)
  source text not null default 'upload' check (source in ('upload', 'random')),
  completed_at timestamptz,                                        -- 그림 완성(평균 80%) 시각
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month),
  check (storage_path is not null or image_url is not null)
);

alter table public.routine_month_art enable row level security;

create policy "month_art_select_own" on public.routine_month_art
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "month_art_insert_own" on public.routine_month_art
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "month_art_update_own" on public.routine_month_art
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "month_art_delete_own" on public.routine_month_art
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 그림 파일: 비공개 버킷, 경로 첫 폴더 = 본인 uid
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('month-art', 'month-art', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "month_art_files_select_own" on storage.objects
  for select to authenticated using (bucket_id = 'month-art' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "month_art_files_insert_own" on storage.objects
  for insert to authenticated with check (bucket_id = 'month-art' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "month_art_files_update_own" on storage.objects
  for update to authenticated using (bucket_id = 'month-art' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "month_art_files_delete_own" on storage.objects
  for delete to authenticated using (bucket_id = 'month-art' and (storage.foldername(name))[1] = (select auth.uid())::text);
