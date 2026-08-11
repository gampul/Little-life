-- 목록 카드용 요약/커버 (본문 content 전체 전송 방지)
ALTER TABLE memos ADD COLUMN IF NOT EXISTS excerpt TEXT;
ALTER TABLE memos ADD COLUMN IF NOT EXISTS cover_image TEXT;

-- 기존 행 백필: HTML 태그 제거 후 150자, 첫 img src
UPDATE memos
SET
  excerpt = LEFT(
    TRIM(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(content, ''), '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g')),
    150
  ),
  cover_image = (REGEXP_MATCH(COALESCE(content, ''), 'src="([^"]+)"'))[1]
WHERE content IS NOT NULL
  AND (excerpt IS NULL OR cover_image IS NULL);
