-- 카드 결제 알림 접수용 개인 토큰
-- 2026-10-27 프로덕션 적용 (Supabase migration: card_ingest_tokens)
--
-- MacroDroid(휴대폰) → Edge Function card-ingest 로 보낼 때 x-ingest-token 헤더로 인증한다.
-- 토큰 원문은 저장하지 않고 SHA-256 해시만 저장 (원문은 발급 화면에서 한 번만 보여줌).
-- 기존 sms-parser 는 요청 헤더의 x-user-id 를 그대로 믿었음 → 이 방식으로 대체.

create table if not exists public.ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  use_count integer not null default 0
);
create index if not exists ingest_tokens_user_id_idx on public.ingest_tokens (user_id);

alter table public.ingest_tokens enable row level security;

drop policy if exists ingest_tokens_select_own on public.ingest_tokens;
drop policy if exists ingest_tokens_insert_own on public.ingest_tokens;
drop policy if exists ingest_tokens_delete_own on public.ingest_tokens;
create policy ingest_tokens_select_own on public.ingest_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy ingest_tokens_insert_own on public.ingest_tokens
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy ingest_tokens_delete_own on public.ingest_tokens
  for delete to authenticated using (user_id = (select auth.uid()));
-- update 는 Edge Function(service_role)만 (last_used_at, use_count)

-- 진단: 마지막 거절 이유 (본문 내용 없이 이유·길이만) — 설정 화면에 표시
alter table public.ingest_tokens add column if not exists last_error text;
alter table public.ingest_tokens add column if not exists last_error_at timestamptz;
