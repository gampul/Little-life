-- 루틴 부가 설명 (설정 > 루틴 설정에서 추가/수정/삭제, 최대 200자)
-- 2026-10-27 프로덕션 적용 완료 (Supabase migration: add_routine_description)
alter table public.routine_templates add column if not exists description text;
comment on column public.routine_templates.description is '루틴 부가 설명 (설정에서 추가/수정/삭제, 최대 200자)';
