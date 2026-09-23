-- 루틴 아이콘 선택: routine_templates.icon
-- Supabase SQL Editor 에서 1회 실행. 여러 번 실행해도 안전.

alter table routine_templates add column if not exists icon text;

-- 지금 화면에 보이는 아이콘을 그대로 저장 (이름 키워드 규칙과 같은 순서, 아직 icon 이 없는 루틴만)
update routine_templates
   set icon = case
     when label like '%800km%'      then 'run'
     when label like '%글쓰기%'      then 'pencil'
     when label like '%주변정리%'    then 'sparkles'
     when label like '%1Day class%' then 'code'
     when label like '%DevOps%'     then 'code'
     when label like '%1Day%'       then 'laptop'
     when label like '%가계부%'      then 'wallet'
     when label like '%기도%'        then 'clock'
     when label like '%OKR%'        then 'target'
     when label like '%금주%'        then 'bottle-off'
     when label like '%사랑이%'      then 'heart'
     when label like '%brush%'      then 'toothbrush'
     when label like '%독서%'        then 'book'
     when label like '%500km%'      then 'run'
     when label like '%Dev ops%'    then 'code'
     when label like '%사색%'        then 'bulb'
     else 'checkbox'
   end
 where icon is null;
