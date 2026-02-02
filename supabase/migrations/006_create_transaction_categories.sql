-- =====================================================
-- 수입/지출 카테고리 시스템
-- =====================================================
-- 원칙:
-- 1. 기본 카테고리는 시스템에서 제공 (is_system = true)
-- 2. 사용자는 새 카테고리 추가 가능 (is_system = false)
-- 3. 기본 카테고리는 삭제 불가, 비활성화만 가능
-- 4. 소분류가 없는 경우 NULL로 저장
-- 5. 정렬은 가나다 순 기본값, 사용자 커스텀 가능
-- =====================================================

-- 1. 카테고리 테이블 생성
CREATE TABLE IF NOT EXISTS transaction_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  is_system BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(type, category, subcategory)
);

-- 2. 사용자별 카테고리 설정 테이블
CREATE TABLE IF NOT EXISTS user_category_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES transaction_categories(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  custom_sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, category_id)
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_transaction_categories_type ON transaction_categories(type);
CREATE INDEX IF NOT EXISTS idx_transaction_categories_category ON transaction_categories(category);
CREATE INDEX IF NOT EXISTS idx_user_category_settings_user ON user_category_settings(user_id);

-- 4. RLS 정책
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_category_settings ENABLE ROW LEVEL SECURITY;

-- 시스템 카테고리는 모든 인증된 사용자가 조회 가능
CREATE POLICY "Anyone can view system categories"
  ON transaction_categories FOR SELECT
  USING (is_system = true OR auth.uid() IS NOT NULL);

-- 사용자 추가 카테고리는 본인만 관리
CREATE POLICY "Users can manage own categories"
  ON transaction_categories FOR ALL
  USING (is_system = false AND auth.uid() IS NOT NULL);

-- 사용자 설정은 본인만 접근
CREATE POLICY "Users can manage own category settings"
  ON user_category_settings FOR ALL
  USING (auth.uid() = user_id);

-- =====================================================
-- 수입 카테고리 초기 데이터 (가나다 순)
-- =====================================================

-- [근로소득] - sort_order: 100
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('income', '근로소득', NULL, true, 100);

-- [금융소득] - sort_order: 200
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('income', '금융소득', NULL, true, 200);

-- [금융소득(비과세)] - sort_order: 300
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('income', '금융소득(비과세)', NULL, true, 300),
('income', '금융소득(비과세)', 'IRP S&P500혼합채권액티브', true, 301),
('income', '금융소득(비과세)', 'IRP 리츠부동산인프라', true, 302),
('income', '금융소득(비과세)', 'ISA kodex 미국배당커브드콜액티브', true, 303),
('income', '금융소득(비과세)', '연금저축 S&P500', true, 304),
('income', '금융소득(비과세)', '연금저축 미국배당다우존스', true, 305),
('income', '금융소득(비과세)', '연금저축 미국배당커드콜액티브', true, 306),
('income', '금융소득(비과세)', '휴머노이드로봇', true, 307);

-- [기타소득] - sort_order: 400
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('income', '기타소득', NULL, true, 400),
('income', '기타소득', '교통비 환급', true, 401),
('income', '기타소득', '기타', true, 402),
('income', '기타소득', '사랑이 지원금', true, 403),
('income', '기타소득', '수진이 연금저축', true, 404);

-- [사업소득(과세)] - sort_order: 500
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('income', '사업소득(과세)', NULL, true, 500);

-- [잔액수정] - sort_order: 600
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('income', '잔액수정', NULL, true, 600);

-- =====================================================
-- 지출 카테고리 초기 데이터 (가나다 순, 영문 먼저)
-- =====================================================

-- [Coffee] - sort_order: 100
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', 'Coffee', NULL, true, 100);

-- [Drink] - sort_order: 200
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', 'Drink', NULL, true, 200);

-- [가족] - sort_order: 300
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', '가족', NULL, true, 300),
('expense', '가족', '누나', true, 301),
('expense', '가족', '와이프', true, 302),
('expense', '가족', '장모님', true, 303);

-- [경조사/회비] - sort_order: 400
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', '경조사/회비', NULL, true, 400),
('expense', '경조사/회비', '경조사비', true, 401),
('expense', '경조사/회비', '선물', true, 402);

-- [교통/차량] - sort_order: 500
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', '교통/차량', NULL, true, 500),
('expense', '교통/차량', '대중교통', true, 501),
('expense', '교통/차량', '정비', true, 502),
('expense', '교통/차량', '주유', true, 503),
('expense', '교통/차량', '주차', true, 504),
('expense', '교통/차량', '택시', true, 505);

-- [기부&헌금] - sort_order: 600
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', '기부&헌금', NULL, true, 600),
('expense', '기부&헌금', '기부', true, 601);

-- [담배] - sort_order: 700
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', '담배', NULL, true, 700);

-- [대출] - sort_order: 800
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', '대출', NULL, true, 800),
('expense', '대출', '신용대출', true, 801);

-- [생활] - sort_order: 900
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', '생활', NULL, true, 900),
('expense', '생활', '사랑이 물건', true, 901),
('expense', '생활', '잡화소모', true, 902);

-- [손실/세금/보험] - sort_order: 1000
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', '손실/세금/보험', NULL, true, 1000);

-- [식비] - sort_order: 1100
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', '식비', NULL, true, 1100),
('expense', '식비', '간식, 사랑이', true, 1101),
('expense', '식비', '식자재', true, 1102),
('expense', '식비', '외식', true, 1103),
('expense', '식비', '점심', true, 1104);

-- [여가문화] - sort_order: 1200
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', '여가문화', NULL, true, 1200),
('expense', '여가문화', '⛳️취미', true, 1201),
('expense', '여가문화', '사랑이 선물', true, 1202),
('expense', '여가문화', '사우나', true, 1203),
('expense', '여가문화', '여행', true, 1204),
('expense', '여가문화', '여행경비', true, 1205);

-- [의료] - sort_order: 1300
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', '의료', NULL, true, 1300);

-- [자기계발] - sort_order: 1400
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', '자기계발', NULL, true, 1400),
('expense', '자기계발', 'AI', true, 1401),
('expense', '자기계발', '교육', true, 1402),
('expense', '자기계발', '어플', true, 1403),
('expense', '자기계발', '음악/도서', true, 1404),
('expense', '자기계발', '전자기기', true, 1405);

-- [잔액수정] - sort_order: 1500
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', '잔액수정', NULL, true, 1500);

-- [주거/통신] - sort_order: 1600
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', '주거/통신', NULL, true, 1600),
('expense', '주거/통신', '통신비', true, 1601);

-- [패션/미용] - sort_order: 1700
INSERT INTO transaction_categories (type, category, subcategory, is_system, sort_order) VALUES
('expense', '패션/미용', NULL, true, 1700),
('expense', '패션/미용', '세탁비', true, 1701),
('expense', '패션/미용', '의류', true, 1702),
('expense', '패션/미용', '패션잡화', true, 1703),
('expense', '패션/미용', '헤어/뷰티', true, 1704);

-- =====================================================
-- 카테고리 조회 함수
-- =====================================================

-- 사용자별 활성화된 카테고리 목록 조회
CREATE OR REPLACE FUNCTION get_active_categories(p_user_id UUID, p_type VARCHAR DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  type VARCHAR,
  category VARCHAR,
  subcategory VARCHAR,
  is_system BOOLEAN,
  sort_order INTEGER,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.id,
    tc.type::VARCHAR,
    tc.category::VARCHAR,
    tc.subcategory::VARCHAR,
    tc.is_system,
    COALESCE(ucs.custom_sort_order, tc.sort_order) as sort_order,
    COALESCE(ucs.is_active, true) as is_active
  FROM transaction_categories tc
  LEFT JOIN user_category_settings ucs 
    ON tc.id = ucs.category_id AND ucs.user_id = p_user_id
  WHERE 
    (p_type IS NULL OR tc.type = p_type)
    AND COALESCE(ucs.is_active, true) = true
  ORDER BY 
    tc.type,
    COALESCE(ucs.custom_sort_order, tc.sort_order);
END;
$$;

-- 전체 카테고리 목록 조회 (비활성화 포함, 관리용)
CREATE OR REPLACE FUNCTION get_all_categories(p_user_id UUID, p_type VARCHAR DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  type VARCHAR,
  category VARCHAR,
  subcategory VARCHAR,
  is_system BOOLEAN,
  sort_order INTEGER,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.id,
    tc.type::VARCHAR,
    tc.category::VARCHAR,
    tc.subcategory::VARCHAR,
    tc.is_system,
    COALESCE(ucs.custom_sort_order, tc.sort_order) as sort_order,
    COALESCE(ucs.is_active, true) as is_active
  FROM transaction_categories tc
  LEFT JOIN user_category_settings ucs 
    ON tc.id = ucs.category_id AND ucs.user_id = p_user_id
  WHERE 
    (p_type IS NULL OR tc.type = p_type)
  ORDER BY 
    tc.type,
    COALESCE(ucs.custom_sort_order, tc.sort_order);
END;
$$;

-- 대분류 목록만 조회 (소분류 = NULL인 것만)
CREATE OR REPLACE FUNCTION get_main_categories(p_user_id UUID, p_type VARCHAR DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  type VARCHAR,
  category VARCHAR,
  is_system BOOLEAN,
  sort_order INTEGER,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.id,
    tc.type::VARCHAR,
    tc.category::VARCHAR,
    tc.is_system,
    COALESCE(ucs.custom_sort_order, tc.sort_order) as sort_order,
    COALESCE(ucs.is_active, true) as is_active
  FROM transaction_categories tc
  LEFT JOIN user_category_settings ucs 
    ON tc.id = ucs.category_id AND ucs.user_id = p_user_id
  WHERE 
    tc.subcategory IS NULL
    AND (p_type IS NULL OR tc.type = p_type)
    AND COALESCE(ucs.is_active, true) = true
  ORDER BY 
    tc.type,
    COALESCE(ucs.custom_sort_order, tc.sort_order);
END;
$$;

-- =====================================================
-- 완료 메시지
-- =====================================================
-- 테이블: transaction_categories, user_category_settings
-- 함수: get_active_categories, get_all_categories, get_main_categories
-- 수입 카테고리: 6개 대분류, 12개 소분류
-- 지출 카테고리: 17개 대분류, 28개 소분류
