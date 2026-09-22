-- AI 리포트(오늘의 코칭 / 주간 / 월간) 저장 테이블
-- Supabase SQL Editor 에서 1회 실행. 여러 번 실행해도 안전.

create table if not exists ai_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('coach', 'weekly', 'monthly')),
  period_from date not null,
  period_to   date not null,
  content     text not null,
  stats       jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists ai_reports_user_kind_idx
  on ai_reports (user_id, kind, period_to desc, created_at desc);

alter table ai_reports enable row level security;

drop policy if exists "ai_reports_select_own" on ai_reports;
create policy "ai_reports_select_own" on ai_reports
  for select using (auth.uid() = user_id);

drop policy if exists "ai_reports_insert_own" on ai_reports;
create policy "ai_reports_insert_own" on ai_reports
  for insert with check (auth.uid() = user_id);

drop policy if exists "ai_reports_delete_own" on ai_reports;
create policy "ai_reports_delete_own" on ai_reports
  for delete using (auth.uid() = user_id);
