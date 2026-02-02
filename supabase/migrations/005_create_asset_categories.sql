-- 자산 카테고리 테이블
CREATE TABLE IF NOT EXISTS asset_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'debt')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name, type)
);

-- 자산-카테고리 매핑 테이블
CREATE TABLE IF NOT EXISTS asset_category_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_name TEXT NOT NULL,
  category_id UUID REFERENCES asset_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, asset_name)
);

-- RLS 정책
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_category_mappings ENABLE ROW LEVEL SECURITY;

-- asset_categories RLS
CREATE POLICY "Users can view own categories"
  ON asset_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON asset_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON asset_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON asset_categories FOR DELETE
  USING (auth.uid() = user_id);

-- asset_category_mappings RLS
CREATE POLICY "Users can view own mappings"
  ON asset_category_mappings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mappings"
  ON asset_category_mappings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mappings"
  ON asset_category_mappings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mappings"
  ON asset_category_mappings FOR DELETE
  USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX idx_asset_categories_user_id ON asset_categories(user_id);
CREATE INDEX idx_asset_categories_type ON asset_categories(user_id, type);
CREATE INDEX idx_asset_category_mappings_user_id ON asset_category_mappings(user_id);
CREATE INDEX idx_asset_category_mappings_category_id ON asset_category_mappings(category_id);
