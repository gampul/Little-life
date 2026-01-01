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

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_expense_records_date ON expense_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_records_category ON expense_records(category);
CREATE INDEX IF NOT EXISTS idx_expense_records_transaction_type ON expense_records(transaction_type);

-- RLS (Row Level Security) 활성화
ALTER TABLE expense_records ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능하도록 정책 설정 (개발용)
CREATE POLICY "Enable read access for all users" ON expense_records
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON expense_records
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON expense_records
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON expense_records
  FOR DELETE USING (true);

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_expense_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER update_expense_records_updated_at_trigger
  BEFORE UPDATE ON expense_records
  FOR EACH ROW
  EXECUTE FUNCTION update_expense_records_updated_at();

