-- ==================================================
-- CANONICAL NET ASSET VIEW (SINGLE SOURCE OF TRUTH)
-- ==================================================
-- Definition: SUM(income) - SUM(expense)
-- EXCLUDED: transfer, opening_balance, adjustments
-- This is the ONLY definition of "현재 순자산"

DROP VIEW IF EXISTS canonical_net_asset CASCADE;

CREATE OR REPLACE VIEW canonical_net_asset AS
SELECT
  user_id,
  COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::BIGINT AS total_income,
  COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::BIGINT AS total_expense,
  (COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)
   - COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0))::BIGINT AS current_net_asset
FROM ledger_transactions
WHERE type IN ('income', 'expense')
GROUP BY user_id;

-- ==================================================
-- RPC FUNCTION FOR APP ACCESS (CANONICAL)
-- ==================================================

CREATE OR REPLACE FUNCTION get_canonical_net_asset(p_user_id UUID)
RETURNS TABLE (
  total_income BIGINT,
  total_expense BIGINT,
  current_net_asset BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::BIGINT,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::BIGINT,
    (COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0))::BIGINT
  FROM ledger_transactions
  WHERE user_id = p_user_id
    AND type IN ('income', 'expense');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- CASH FLOW DELTA (RENAMED FROM net_cash_position)
-- ==================================================
-- This is NOT "자산". This is cash flow movement.
-- Label: "현금 흐름" or "자금 이동"

CREATE OR REPLACE FUNCTION get_cash_flow_delta(p_user_id UUID)
RETURNS TABLE (
  total_inflow BIGINT,
  total_outflow BIGINT,
  total_transfer BIGINT,
  cash_flow_delta BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::BIGINT AS total_inflow,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::BIGINT AS total_outflow,
    COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0)::BIGINT AS total_transfer,
    (COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0))::BIGINT AS cash_flow_delta
  FROM ledger_transactions
  WHERE user_id = p_user_id
    AND type IN ('income', 'expense', 'transfer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
