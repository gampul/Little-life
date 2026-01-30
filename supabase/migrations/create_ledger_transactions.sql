-- ledger_transactions 테이블 삭제 후 재생성
DROP TABLE IF EXISTS ledger_transactions CASCADE;

-- ledger_transactions 테이블 생성
CREATE TABLE ledger_transactions (
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
  source TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('excel', 'app')),
  import_batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_ledger_transactions_user_id ON ledger_transactions(user_id);
CREATE INDEX idx_ledger_transactions_date ON ledger_transactions(date DESC);
CREATE INDEX idx_ledger_transactions_type ON ledger_transactions(type);
CREATE INDEX idx_ledger_transactions_category ON ledger_transactions(category);
CREATE INDEX idx_ledger_transactions_source ON ledger_transactions(source);

-- 중복 방지용 유니크 인덱스 (date + amount + asset + type + user_id)
CREATE UNIQUE INDEX idx_ledger_transactions_unique 
ON ledger_transactions(user_id, date, amount, asset, type);

-- RLS 정책 활성화
ALTER TABLE ledger_transactions ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view own transactions" ON ledger_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON ledger_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON ledger_transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON ledger_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- 집계 VIEW 생성
CREATE OR REPLACE VIEW ledger_summary AS
SELECT
  user_id,
  COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::BIGINT AS total_income,
  COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::BIGINT AS total_expense,
  COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0)::BIGINT AS total_transfer,
  (
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0)
  )::BIGINT AS net_cash_position
FROM ledger_transactions
GROUP BY user_id;

-- VIEW에 대한 RLS (뷰는 기본 테이블의 RLS를 상속하지 않으므로 함수로 대체)
CREATE OR REPLACE FUNCTION get_user_ledger_summary(p_user_id UUID)
RETURNS TABLE (
  total_income BIGINT,
  total_expense BIGINT,
  total_transfer BIGINT,
  net_cash_position BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::BIGINT,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::BIGINT,
    COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0)::BIGINT,
    (
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0)
    )::BIGINT
  FROM ledger_transactions
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
