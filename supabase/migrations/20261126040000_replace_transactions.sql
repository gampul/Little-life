-- 가계부 "전체 교체" 가져오기: 내 거래를 모두 지우고 파일 내용으로 바꾼다.
-- 백업 → 삭제 → 삽입이 한 트랜잭션이라 중간에 실패하면 기존 내역이 그대로 남는다.
-- 직전 내역은 private.transactions_replace_backup 에 사용자당 1벌 보관(되돌리기용, API 로는 노출 안 됨).

create schema if not exists private;

create table if not exists private.transactions_replace_backup (
  like public.transactions,
  replaced_at timestamptz not null default now()
);
create index if not exists transactions_replace_backup_user_idx on private.transactions_replace_backup (user_id);

create or replace function public.replace_transactions(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_batch uuid := gen_random_uuid();
  v_deleted integer;
  v_inserted integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'no rows';
  end if;

  delete from private.transactions_replace_backup where user_id = v_uid;
  insert into private.transactions_replace_backup
    select t.*, now() from public.transactions t where t.user_id = v_uid;

  delete from public.transactions where user_id = v_uid;
  get diagnostics v_deleted = row_count;

  insert into public.transactions
    (user_id, date, asset, category, sub_category, transaction_type, is_transfer, transfer_asset, amount, memo, currency, source, import_batch_id)
  select
    v_uid,
    (r->>'date')::timestamptz,
    r->>'asset',
    r->>'category',
    nullif(r->>'sub_category', ''),
    r->>'transaction_type',
    coalesce((r->>'is_transfer')::boolean, false),
    nullif(r->>'transfer_asset', ''),
    (r->>'amount')::integer,
    nullif(r->>'memo', ''),
    coalesce(nullif(r->>'currency', ''), 'KRW'),
    'csv',
    v_batch
  from jsonb_array_elements(p_rows) r
  on conflict (user_id, date, amount, asset, transaction_type) do nothing;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object('deleted', v_deleted, 'inserted', v_inserted, 'import_batch_id', v_batch);
end;
$$;
revoke execute on function public.replace_transactions(jsonb) from public, anon;
grant execute on function public.replace_transactions(jsonb) to authenticated;
