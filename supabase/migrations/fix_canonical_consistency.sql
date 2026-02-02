-- ==================================================
-- FIX CANONICAL CONSISTENCY
-- ==================================================
-- This migration ensures ALL screens use the SAME
-- canonical definition of net asset.
--
-- PROBLEM: Different screens show different values
-- CAUSE: Multiple calculation paths, fallback logic inconsistencies
-- SOLUTION: ONE RPC, ONE definition, NO fallback recalculation

-- ==================================================
-- STEP 1: DROP ALL CONFLICTING FUNCTIONS
-- ==================================================

DROP FUNCTION IF EXISTS get_canonical_net_asset(UUID);
DROP FUNCTION IF EXISTS get_cash_flow_delta(UUID);
DROP FUNCTION IF EXISTS get_user_ledger_summary(UUID);
DROP VIEW IF EXISTS canonical_net_asset CASCADE;

-- ==================================================
-- STEP 2: CREATE CANONICAL NET ASSET (SINGLE SOURCE OF TRUTH)
-- ==================================================
-- Definition: income - expense
-- EXCLUDED: transfer, opening_balance, adjustments
-- This is the ONLY definition of "현재 순자산"

CREATE OR REPLACE FUNCTION get_canonical_net_asset(p_user_id UUID)
RETURNS TABLE (
  total_income BIGINT,
  total_expense BIGINT,
  current_net_asset BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN lt.type = 'income' THEN lt.amount ELSE 0 END), 0)::BIGINT AS total_income,
    COALESCE(SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END), 0)::BIGINT AS total_expense,
    (COALESCE(SUM(CASE WHEN lt.type = 'income' THEN lt.amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END), 0))::BIGINT AS current_net_asset
  FROM ledger_transactions lt
  WHERE lt.user_id = p_user_id
    AND lt.type IN ('income', 'expense');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 3: CREATE CASH FLOW DELTA (SECONDARY, NOT "자산")
-- ==================================================
-- This includes transfer and is for reference only
-- Label: "현금 흐름" NOT "자산"

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
    COALESCE(SUM(CASE WHEN lt.type = 'income' THEN lt.amount ELSE 0 END), 0)::BIGINT AS total_inflow,
    COALESCE(SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END), 0)::BIGINT AS total_outflow,
    COALESCE(SUM(CASE WHEN lt.type = 'transfer' THEN lt.amount ELSE 0 END), 0)::BIGINT AS total_transfer,
    (COALESCE(SUM(CASE WHEN lt.type = 'income' THEN lt.amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN lt.type = 'transfer' THEN lt.amount ELSE 0 END), 0))::BIGINT AS cash_flow_delta
  FROM ledger_transactions lt
  WHERE lt.user_id = p_user_id
    AND lt.type IN ('income', 'expense', 'transfer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 4: DEPRECATE OLD LEDGER SUMMARY
-- ==================================================
-- Old function included opening_balance in income
-- This caused inconsistency

CREATE OR REPLACE FUNCTION get_user_ledger_summary(p_user_id UUID)
RETURNS TABLE (
  total_income BIGINT,
  total_expense BIGINT,
  total_transfer BIGINT,
  net_cash_position BIGINT
) AS $$
BEGIN
  -- DEPRECATED: Use get_canonical_net_asset instead
  -- This function now returns cash_flow_delta for backwards compatibility
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN lt.type = 'income' THEN lt.amount ELSE 0 END), 0)::BIGINT,
    COALESCE(SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END), 0)::BIGINT,
    COALESCE(SUM(CASE WHEN lt.type = 'transfer' THEN lt.amount ELSE 0 END), 0)::BIGINT,
    (COALESCE(SUM(CASE WHEN lt.type = 'income' THEN lt.amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN lt.type = 'transfer' THEN lt.amount ELSE 0 END), 0))::BIGINT
  FROM ledger_transactions lt
  WHERE lt.user_id = p_user_id
    AND lt.type IN ('income', 'expense', 'transfer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- VERIFICATION QUERY (Run after migration)
-- ==================================================
-- This should return the canonical values:
-- total_income: 1,353,594,213
-- total_expense: 127,138,721
-- current_net_asset: 1,226,455,492

-- SELECT * FROM get_canonical_net_asset('YOUR_USER_ID');
