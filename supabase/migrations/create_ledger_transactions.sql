-- ledger_transactions 테이블 생성
CREATE TABLE IF NOT EXISTS ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  asset TEXT NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT,
  description TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  currency TEXT NOT NULL DEFAULT 'KRW',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_user_id ON ledger_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_date ON ledger_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_type ON ledger_transactions(type);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_category ON ledger_transactions(category);

-- RLS 정책 활성화
ALTER TABLE ledger_transactions ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 데이터만 접근 가능
CREATE POLICY "Users can view own transactions" ON ledger_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON ledger_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON ledger_transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON ledger_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- 집계 함수 (RPC)
CREATE OR REPLACE FUNCTION get_ledger_summary(p_user_id UUID)
RETURNS TABLE (
  total_income BIGINT,
  total_expense BIGINT,
  total_transfer BIGINT,
  net_cash_position BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::BIGINT AS total_income,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::BIGINT AS total_expense,
    COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0)::BIGINT AS total_transfer,
    (
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0)
    )::BIGINT AS net_cash_position
  FROM ledger_transactions
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
