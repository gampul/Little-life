-- 루틴 푸시 알림: 오늘(KST) 안 한 루틴을 매일 13:00·22:00 에 휴대폰으로 알림
-- 2026-10-27 프로덕션 적용 (Supabase migration: routine_push_reminders)
--
-- 구성
--   push_subscriptions      : 기기별 Web Push 구독 (사용자 본인만 읽고 쓰기)
--   Vault 비밀값            : push_vapid_public / push_vapid_private / push_vapid_subject / push_cron_secret
--                             (값은 이 파일에 없음 — vault.create_secret 으로 별도 등록)
--   get_push_config()       : Edge Function(service_role)만 Vault 값을 읽는 통로
--   pg_cron 작업 2개        : 04:00 UTC(=13:00 KST), 13:00 UTC(=22:00 KST) 에 Edge Function routine-reminder 호출

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0
);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Edge Function 만 쓰는 설정 읽기 (Vault)
create or replace function public.get_push_config()
returns table (vapid_public text, vapid_private text, vapid_subject text, cron_secret text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_public'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_private'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_subject'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret');
$$;
revoke execute on function public.get_push_config() from public, anon, authenticated;
grant execute on function public.get_push_config() to service_role;

-- 예약 실행: Vault 의 cron 비밀값을 헤더로 실어 Edge Function 호출
create or replace function public.trigger_routine_reminder(p_slot text)
returns bigint
language sql
security definer
set search_path = public, pg_temp
as $$
  select net.http_post(
    url := 'https://xtbldslukkqkjdrqitoz.supabase.co/functions/v1/routine-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := jsonb_build_object('slot', p_slot),
    timeout_milliseconds := 30000
  );
$$;
revoke execute on function public.trigger_routine_reminder(text) from public, anon, authenticated;

select cron.unschedule(jobname) from cron.job where jobname in ('routine-reminder-1300kst', 'routine-reminder-2200kst');
select cron.schedule('routine-reminder-1300kst', '0 4 * * *', $$select public.trigger_routine_reminder('afternoon')$$);
select cron.schedule('routine-reminder-2200kst', '0 13 * * *', $$select public.trigger_routine_reminder('night')$$);
