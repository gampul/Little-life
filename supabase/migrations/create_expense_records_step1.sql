-- ============================================
-- STEP 1: 테이블 생성
-- ============================================

-- 기존 테이블이 있다면 삭제 (주의: 데이터 손실!)
-- DROP TABLE IF EXISTS expense_records CASCADE;

-- 가계부 테이블 생성
CREATE TABLE IF NOT EXISTS expense_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  account TEXT,
  category TEXT,
  sub_category TEXT,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('입금', '출금', '이체입금', '이체출금')),
  memo TEXT,
  balance NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'KRW',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 테이블 확인
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'expense_records'
ORDER BY ordinal_position;

