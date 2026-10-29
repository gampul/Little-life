-- 2026-10-29 가계부 업로드 정리 (원격 DB 에 적용 완료, 기록용)
-- 백업 → 예전(4월) 배치 삭제 → 10/29 배치 시각 -9h(KST 를 UTC 로 잘못 저장) → 전세자금대출 잔액수정 부호
create table if not exists public.transactions_backup_20261029 as
  select * from public.transactions where user_id = 'aff522a6-106f-48d8-9c64-e76252d42f49';
alter table public.transactions_backup_20261029 enable row level security;
delete from public.transactions
 where user_id = 'aff522a6-106f-48d8-9c64-e76252d42f49' and import_batch_id = '103eafc6-0615-489c-bd29-73c806fd4005';
update public.transactions set date = date - interval '9 hours'
 where user_id = 'aff522a6-106f-48d8-9c64-e76252d42f49' and import_batch_id = '502ee825-9fcb-4ca3-a7bd-f31ec6c316ef';
update public.transactions set transaction_type = '지출' where id = 'b4776fa5-8621-4b14-8bc4-788c1b496ee8';
