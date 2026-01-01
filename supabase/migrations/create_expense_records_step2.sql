-- ============================================
-- STEP 2: 인덱스 생성
-- ============================================

-- 날짜 인덱스 (내림차순 - 최신 데이터 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_expense_records_date 
ON expense_records(date DESC);

-- 카테고리 인덱스 (카테고리별 필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_expense_records_category 
ON expense_records(category);

-- 거래 유형 인덱스 (수입/지출 필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_expense_records_transaction_type 
ON expense_records(transaction_type);

-- 복합 인덱스 (날짜 + 거래유형)
CREATE INDEX IF NOT EXISTS idx_expense_records_date_type 
ON expense_records(date DESC, transaction_type);

-- 인덱스 확인
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'expense_records';

