-- 500km 걷기 루틴에 이미지 업로드 기능 활성화

UPDATE routine_templates
SET image_upload_enabled = true
WHERE label ILIKE '%500%'
  AND deleted_at IS NULL;

-- 확인
SELECT 
  id,
  label,
  type,
  unit,
  image_upload_enabled
FROM routine_templates
WHERE label ILIKE '%500%'
ORDER BY sort_order;
