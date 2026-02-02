-- =============================================
-- 재무 계산 함수 (핵심 로직)
-- =============================================
-- 기준값:
--   총수입: 1,353,594,213원
--   총지출: 127,138,721원
--   순자산: 1,226,455,492원
-- =============================================

-- 1. 핵심 재무 요약 함수
-- 총수입 = transaction_type = '수입' 인 금액 합계
-- 총지출 = transaction_type = '지출' AND is_transfer = false 인 금액 합계
-- 순자산 = 총수입 - 총지출
CREATE OR REPLACE FUNCTION get_financial_summary(p_user_id UUID)
RETURNS TABLE (
  total_income BIGINT,
  total_expense BIGINT,
  net_asset BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- 총수입: 거래유형 = '수입'
    COALESCE(SUM(
      CASE WHEN transaction_type = '수입' THEN amount ELSE 0 END
    ), 0)::BIGINT AS total_income,
    
    -- 총지출: 거래유형 = '지출' AND 이체 = false
    COALESCE(SUM(
      CASE WHEN transaction_type = '지출' AND is_transfer = FALSE THEN amount ELSE 0 END
    ), 0)::BIGINT AS total_expense,
    
    -- 순자산: 총수입 - 총지출
    (
      COALESCE(SUM(CASE WHEN transaction_type = '수입' THEN amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN transaction_type = '지출' AND is_transfer = FALSE THEN amount ELSE 0 END), 0)
    )::BIGINT AS net_asset
  FROM transactions
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. 기간별 재무 요약 함수
CREATE OR REPLACE FUNCTION get_financial_summary_by_period(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  total_income BIGINT,
  total_expense BIGINT,
  net_asset BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(
      CASE WHEN transaction_type = '수입' THEN amount ELSE 0 END
    ), 0)::BIGINT,
    
    COALESCE(SUM(
      CASE WHEN transaction_type = '지출' AND is_transfer = FALSE THEN amount ELSE 0 END
    ), 0)::BIGINT,
    
    (
      COALESCE(SUM(CASE WHEN transaction_type = '수입' THEN amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN transaction_type = '지출' AND is_transfer = FALSE THEN amount ELSE 0 END), 0)
    )::BIGINT
  FROM transactions
  WHERE user_id = p_user_id
    AND (p_start_date IS NULL OR date >= p_start_date)
    AND (p_end_date IS NULL OR date <= p_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. 월별 통계 함수
CREATE OR REPLACE FUNCTION get_monthly_stats(p_user_id UUID, p_months INTEGER DEFAULT 12)
RETURNS TABLE (
  month TEXT,
  income BIGINT,
  expense BIGINT,
  net BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(date, 'YYYY-MM') AS month,
    COALESCE(SUM(
      CASE WHEN transaction_type = '수입' THEN amount ELSE 0 END
    ), 0)::BIGINT AS income,
    COALESCE(SUM(
      CASE WHEN transaction_type = '지출' AND is_transfer = FALSE THEN amount ELSE 0 END
    ), 0)::BIGINT AS expense,
    (
      COALESCE(SUM(CASE WHEN transaction_type = '수입' THEN amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN transaction_type = '지출' AND is_transfer = FALSE THEN amount ELSE 0 END), 0)
    )::BIGINT AS net
  FROM transactions
  WHERE user_id = p_user_id
    AND date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
  GROUP BY TO_CHAR(date, 'YYYY-MM')
  ORDER BY month DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. 카테고리별 통계 함수
CREATE OR REPLACE FUNCTION get_category_stats(p_user_id UUID, p_transaction_type TEXT DEFAULT NULL)
RETURNS TABLE (
  category TEXT,
  total_amount BIGINT,
  transaction_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.category,
    SUM(t.amount)::BIGINT AS total_amount,
    COUNT(*)::BIGINT AS transaction_count
  FROM transactions t
  WHERE t.user_id = p_user_id
    AND t.is_transfer = FALSE
    AND (p_transaction_type IS NULL OR t.transaction_type = p_transaction_type)
  GROUP BY t.category
  ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. 자산별 통계 함수
CREATE OR REPLACE FUNCTION get_asset_stats(p_user_id UUID)
RETURNS TABLE (
  asset TEXT,
  income BIGINT,
  expense BIGINT,
  transfer_out BIGINT,
  balance BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.asset,
    COALESCE(SUM(CASE WHEN transaction_type = '수입' THEN amount ELSE 0 END), 0)::BIGINT AS income,
    COALESCE(SUM(CASE WHEN transaction_type = '지출' AND is_transfer = FALSE THEN amount ELSE 0 END), 0)::BIGINT AS expense,
    COALESCE(SUM(CASE WHEN transaction_type = '자산이체' THEN amount ELSE 0 END), 0)::BIGINT AS transfer_out,
    (
      COALESCE(SUM(CASE WHEN transaction_type = '수입' THEN amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN transaction_type = '지출' THEN amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN transaction_type = '자산이체' THEN amount ELSE 0 END), 0)
    )::BIGINT AS balance
  FROM transactions t
  WHERE t.user_id = p_user_id
  GROUP BY t.asset
  ORDER BY balance DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '재무 계산 함수 생성 완료';
END $$;
