-- 복합 루틴(체크박스 + 단위 값 하위 항목) 지원
-- Supabase SQL Editor 에서 1회 실행. 여러 번 실행해도 안전.

-- 1) 루틴 타입에 'multi'(복합) 허용
alter table routine_templates drop constraint if exists routine_type_check;
alter table routine_templates
  add constraint routine_type_check check (type in ('checkbox', 'number', 'multi'));

-- 2) 하위 항목 정의: [{ "key": "km800", "label": "800km", "unit": "km" }, ...]
alter table routine_templates
  add column if not exists sub_items jsonb not null default '[]'::jsonb;

-- 3) 날짜별 하위 항목 값: { "km800": 5.2, "devops": 30, "class1day": null }
--    키가 있으면 체크됨, 값이 null 이면 체크만 하고 수치는 입력하지 않은 것
alter table daily_routine_checks
  add column if not exists sub_values jsonb;

-- 4) 기존 "800km/Devops/1Day Class" 루틴을 복합 타입으로 전환 (라벨에 dev/ops 가 포함된 루틴)
update routine_templates
set type = 'multi',
    sub_items = '[
      { "key": "km800",     "label": "800km",      "unit": "km" },
      { "key": "devops",    "label": "Devops",     "unit": "분" },
      { "key": "class1day", "label": "1Day Class", "unit": "분" }
    ]'::jsonb
where deleted_at is null
  and label ilike '%dev%ops%'
  and (sub_items is null or sub_items = '[]'::jsonb);
