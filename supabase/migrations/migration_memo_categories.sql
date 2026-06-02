-- 카테고리 테이블 생성
CREATE TABLE IF NOT EXISTS memo_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책 활성화
ALTER TABLE memo_categories ENABLE ROW LEVEL SECURITY;

-- 사용자별 접근 제어 정책
CREATE POLICY "users_own_categories" ON memo_categories
  FOR ALL USING (auth.uid() = user_id);

-- memos 테이블에 category_id 컬럼 추가
ALTER TABLE memos ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES memo_categories(id) ON DELETE SET NULL;
