-- "나중에" 보관: 확인 팝업이 무한 반복되던 문제
-- 2026-10-28 프로덕션 적용 (Supabase migration: pending_transactions_snoozed_at)
-- 나중에/임시저장을 누르면 snoozed_at 을 기록 → Daily 자동 팝업에서는 빠지고, 상단 종 아이콘을 눌렀을 때만 다시 보여준다.
alter table public.pending_transactions add column if not exists snoozed_at timestamptz;
comment on column public.pending_transactions.snoozed_at is '나중에(또는 임시저장)를 누른 시각 — 자동 팝업에서 제외, 종 아이콘으로 열 때만 표시';
