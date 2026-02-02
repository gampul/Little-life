-- =============================================
-- Asset 메뉴용 자산/부채 계산 함수
-- =============================================

-- 1. 자산별 잔액 계산 함수
-- 수입 - 지출 - 이체출금 + 이체입금
CREATE OR REPLACE FUNCTION get_asset_balances(p_user_id UUID)
RETURNS TABLE (
  asset_name TEXT,
  income BIGINT,
  expense BIGINT,
  transfer_out BIGINT,
  transfer_in BIGINT,
  balance BIGINT,
  is_debt BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- 일반 거래 (수입/지출)
  normal_tx AS (
    SELECT 
      asset,
      SUM(CASE WHEN transaction_type = '수입' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN transaction_type = '지출' THEN amount ELSE 0 END) as expense
    FROM transactions
    WHERE user_id = p_user_id
    GROUP BY asset
  ),
  -- 이체 출금 (asset에서 나감)
  transfer_out_tx AS (
    SELECT 
      asset,
      SUM(amount) as amount_out
    FROM transactions
    WHERE user_id = p_user_id AND transaction_type = '자산이체'
    GROUP BY asset
  ),
  -- 이체 입금 (transfer_asset으로 들어옴)
  transfer_in_tx AS (
    SELECT 
      transfer_asset as asset,
      SUM(amount) as amount_in
    FROM transactions
    WHERE user_id = p_user_id AND transaction_type = '자산이체' AND transfer_asset IS NOT NULL
    GROUP BY transfer_asset
  ),
  -- 모든 자산 목록 통합
  all_assets AS (
    SELECT asset FROM normal_tx
    UNION
    SELECT asset FROM transfer_out_tx
    UNION
    SELECT asset FROM transfer_in_tx WHERE asset IS NOT NULL
  )
  SELECT 
    a.asset as asset_name,
    COALESCE(n.income, 0)::BIGINT as income,
    COALESCE(n.expense, 0)::BIGINT as expense,
    COALESCE(o.amount_out, 0)::BIGINT as transfer_out,
    COALESCE(i.amount_in, 0)::BIGINT as transfer_in,
    (COALESCE(n.income, 0) - COALESCE(n.expense, 0) - COALESCE(o.amount_out, 0) + COALESCE(i.amount_in, 0))::BIGINT as balance,
    (a.asset ILIKE '%대출%')::BOOLEAN as is_debt
  FROM all_assets a
  LEFT JOIN normal_tx n ON a.asset = n.asset
  LEFT JOIN transfer_out_tx o ON a.asset = o.asset
  LEFT JOIN transfer_in_tx i ON a.asset = i.asset
  WHERE a.asset IS NOT NULL
  ORDER BY 
    (a.asset ILIKE '%대출%'),
    ABS(COALESCE(n.income, 0) - COALESCE(n.expense, 0) - COALESCE(o.amount_out, 0) + COALESCE(i.amount_in, 0)) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. 자산/부채 요약 함수
CREATE OR REPLACE FUNCTION get_asset_summary(p_user_id UUID)
RETURNS TABLE (
  total_assets BIGINT,
  total_liabilities BIGINT,
  net_worth BIGINT,
  asset_count INTEGER,
  liability_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH balances AS (
    SELECT * FROM get_asset_balances(p_user_id)
  )
  SELECT
    -- 총자산: 부채가 아니고 잔액이 양수인 것
    COALESCE(SUM(CASE WHEN NOT is_debt AND balance > 0 THEN balance ELSE 0 END), 0)::BIGINT as total_assets,
    -- 총부채: 부채이거나 잔액이 음수인 것의 절대값
    COALESCE(SUM(CASE WHEN is_debt OR balance < 0 THEN ABS(balance) ELSE 0 END), 0)::BIGINT as total_liabilities,
    -- 순자산
    COALESCE(SUM(balance), 0)::BIGINT as net_worth,
    -- 자산 개수
    COUNT(CASE WHEN NOT is_debt AND balance > 0 THEN 1 END)::INTEGER as asset_count,
    -- 부채 개수
    COUNT(CASE WHEN is_debt OR balance < 0 THEN 1 END)::INTEGER as liability_count
  FROM balances;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE 'Asset 메뉴용 함수 생성 완료';
END $$;
