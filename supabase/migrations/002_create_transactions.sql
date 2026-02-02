-- =============================================
-- transactions 테이블 생성 (새 데이터 모델)
-- =============================================

-- transactions 테이블 생성
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 핵심 컬럼
  date TIMESTAMPTZ NOT NULL,
  asset TEXT NOT NULL,                              -- 거래 자산/계좌
  category TEXT NOT NULL,                           -- 수입/지출 분류
  sub_category TEXT,                                -- 소분류 (nullable)
  transaction_type TEXT NOT NULL                    -- '수입' | '지출' | '자산이체'
    CHECK (transaction_type IN ('수입', '지출', '자산이체')),
  
  -- 이체 관련
  is_transfer BOOLEAN NOT NULL DEFAULT FALSE,       -- 이체 여부
  transfer_asset TEXT,                              -- 이체 대상 자산 (이체시에만)
  
  -- 금액/메모
  amount INTEGER NOT NULL CHECK (amount > 0),       -- 거래 금액 (항상 양수)
  memo TEXT,                                        -- 메모
  
  -- 메타데이터
  currency TEXT NOT NULL DEFAULT 'KRW',
  source TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('csv', 'app')),
  import_batch_id UUID,                             -- CSV 업로드 배치 ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_is_transfer ON transactions(is_transfer);

-- 중복 방지용 유니크 인덱스
CREATE UNIQUE INDEX idx_transactions_unique 
ON transactions(user_id, date, amount, asset, transaction_type);

-- RLS 정책 활성화
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 거래만 접근 가능
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (auth.uid() = user_id);

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE 'transactions 테이블 생성 완료';
END $$;
