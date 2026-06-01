-- 독서 루틴의 현재 설정 확인
SELECT 
  id,
  label,
  type,
  unit,
  image_upload_enabled
FROM routine_templates
WHERE label LIKE '%독서%' OR id = 'reading'
ORDER BY sort_order;

-- 모든 루틴 확인 (참고용)
SELECT 
  id,
  label,
  type,
  unit,
  image_upload_enabled,
  sort_order
FROM routine_templates
ORDER BY sort_order;
