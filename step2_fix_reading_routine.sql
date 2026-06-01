-- Step 2: 독서 루틴을 숫자 입력 타입으로 복구

UPDATE routine_templates
SET 
  type = 'number',
  unit = '분'
WHERE (label ILIKE '%독서%')
  AND deleted_at IS NULL;

-- 확인
SELECT 
  id,
  label,
  type,
  unit,
  image_upload_enabled
FROM routine_templates
WHERE label ILIKE '%독서%'
ORDER BY sort_order;
