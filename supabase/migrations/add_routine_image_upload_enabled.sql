BEGIN;

ALTER TABLE routine_templates
ADD COLUMN IF NOT EXISTS image_upload_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN routine_templates.image_upload_enabled IS
  '루틴 아코디언의 월 캘린더에서 날짜별 사진 업로드 기능 사용 여부';

-- 기존 "독서", "사랑이 30분" 루틴은 기본 ON으로 마이그레이션
UPDATE routine_templates
SET image_upload_enabled = true
WHERE (label ILIKE '%독서%' OR label ILIKE '%사랑이%')
  AND deleted_at IS NULL;

COMMIT;
