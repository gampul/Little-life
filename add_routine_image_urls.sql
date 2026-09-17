-- 루틴 기록 사진 다중 업로드(최대 5장)용 컬럼
-- Supabase SQL Editor 에서 1회 실행. 여러 번 실행해도 안전.
alter table daily_routine_checks
  add column if not exists image_urls jsonb not null default '[]'::jsonb;

-- 기존 단일 사진(image_url)을 새 컬럼으로 복사
update daily_routine_checks
set image_urls = jsonb_build_array(image_url)
where image_url is not null
  and image_url <> ''
  and image_urls = '[]'::jsonb;
