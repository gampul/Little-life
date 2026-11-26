-- 가계부 대기 건 푸시: pending_transactions 에 status='pending' 행이 들어오면
-- Edge Function pending-push 를 불러 알림 켠 기기(push_subscriptions)로 알린다.
-- 호출이 실패해도 저장(INSERT)은 막지 않는다.

create or replace function public.notify_pending_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  begin
    perform net.http_post(
      url := 'https://xtbldslukkqkjdrqitoz.supabase.co/functions/v1/pending-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
      ),
      body := jsonb_build_object('id', new.id),
      timeout_milliseconds := 30000
    );
  exception when others then
    raise warning 'notify_pending_transaction failed: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke execute on function public.notify_pending_transaction() from public, anon, authenticated;

drop trigger if exists pending_transactions_push on public.pending_transactions;
create trigger pending_transactions_push
  after insert on public.pending_transactions
  for each row
  when (new.status = 'pending')
  execute function public.notify_pending_transaction();
