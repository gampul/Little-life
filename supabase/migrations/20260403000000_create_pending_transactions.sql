-- pending_transactions: SMS 파싱 임시 저장 테이블
-- 주의: 기존 transactions 테이블은 수정하지 않는다

CREATE TABLE IF NOT EXISTS pending_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_sms             text NOT NULL,
  sender              text,
  amount              numeric,
  amount_before_tax   numeric,
  transaction_date    date,
  transaction_time    time,
  account_number      text,
  item_name           text,
  transaction_type    text CHECK (transaction_type IN ('income', 'expense', 'transfer') OR transaction_type IS NULL),
  category            text,
  memo                text,
  status              text NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  parsed_data         jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_pending_transactions_user_id ON pending_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_transactions_status ON pending_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pending_transactions_created_at ON pending_transactions(created_at DESC);

-- RLS
ALTER TABLE pending_transactions ENABLE ROW LEVEL SECURITY;

-- 정책: 본인 데이터만 접근 허용
DROP POLICY IF EXISTS "pt_select_own" ON pending_transactions;
CREATE POLICY "pt_select_own" ON pending_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pt_insert_own" ON pending_transactions;
CREATE POLICY "pt_insert_own" ON pending_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pt_update_own" ON pending_transactions;
CREATE POLICY "pt_update_own" ON pending_transactions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pt_delete_own" ON pending_transactions;
CREATE POLICY "pt_delete_own" ON pending_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- updated_at 자동 갱신 트리거 함수 (없으면 생성)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'set_updated_at_timestamp'
  ) THEN
    CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- 트리거 생성/교체
DROP TRIGGER IF EXISTS trg_pending_transactions_set_updated_at ON pending_transactions;
CREATE TRIGGER trg_pending_transactions_set_updated_at
  BEFORE UPDATE ON pending_transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

-- 완료 알림
DO $$
BEGIN
  RAISE NOTICE 'pending_transactions 테이블 생성 및 RLS/인덱스/트리거 설정 완료';
END $$;

