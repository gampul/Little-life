-- 체중 기록에 메모·사진(최대 5장) 추가: daily_records.weight_memo / weight_images
-- Supabase SQL Editor 에서 1회 실행. 여러 번 실행해도 안전.

alter table daily_records add column if not exists weight_memo   text;
alter table daily_records add column if not exists weight_images text[] not null default '{}';

comment on column daily_records.weight_memo   is '체중 기록 메모';
comment on column daily_records.weight_images is '체중 기록 사진 URL (최대 5장, meal-images 버킷)';

-- (선택) 예전 체중 팝업이 식사 메모/사진 칸(meal_memo/meal_images)에 저장했던 내용을
-- 체중 메모/사진으로 옮기고 싶으면 아래 주석을 풀고 실행하세요. 식사 칸의 내용은 그대로 둡니다.
-- update daily_records
--    set weight_memo   = coalesce(weight_memo, meal_memo),
--        weight_images = case when coalesce(array_length(weight_images, 1), 0) = 0 then coalesce(meal_images, '{}') else weight_images end
--  where weight is not null;
