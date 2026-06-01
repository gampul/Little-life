-- 독서 루틴을 원래 설정으로 복구
-- type을 'number'로, image_upload_enabled를 true로 설정

UPDATE routine_templates
SET 
  type = 'number',
  unit = '분',
  image_upload_enabled = true
WHERE label LIKE '%독서%' OR id = 'reading';

-- 확인
SELECT 
  id,
  label,
  type,
  unit,
  image_upload_enabled
FROM routine_templates
WHERE label LIKE '%독서%' OR id = 'reading';
