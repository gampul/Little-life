-- ============================================
-- FIX ASSET BALANCES - NO DOUBLE COUNTING
-- ============================================

-- STEP 0: Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_asset_id ON ledger_transactions(asset_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_to_asset_id ON ledger_transactions(to_asset_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_type ON ledger_transactions(type);

-- STEP 1: Backfill asset_id (idempotent)
UPDATE ledger_transactions lt
SET asset_id = a.id
FROM assets a
WHERE lt.asset_id IS NULL
  AND lt.asset IS NOT NULL
  AND lt.asset = a.name
  AND lt.user_id = a.user_id;

-- STEP 2: VIEW 1 — asset_balances (CORRECT, NO DOUBLE COUNT)
DROP VIEW IF EXISTS asset_summary CASCADE;
DROP VIEW IF EXISTS asset_type_totals CASCADE;
DROP VIEW IF EXISTS asset_balances CASCADE;

CREATE OR REPLACE VIEW asset_balances AS
WITH
income AS (
  SELECT user_id, asset_id, SUM(amount)::BIGINT AS v
  FROM ledger_transactions
  WHERE type = 'income' AND asset_id IS NOT NULL
  GROUP BY user_id, asset_id
),
expense AS (
  SELECT user_id, asset_id, SUM(amount)::BIGINT AS v
  FROM ledger_transactions
  WHERE type = 'expense' AND asset_id IS NOT NULL
  GROUP BY user_id, asset_id
),
transfer_out AS (
  SELECT user_id, asset_id, SUM(amount)::BIGINT AS v
  FROM ledger_transactions
  WHERE type = 'transfer' AND asset_id IS NOT NULL
  GROUP BY user_id, asset_id
),
transfer_in AS (
  SELECT user_id, to_asset_id AS asset_id, SUM(amount)::BIGINT AS v
  FROM ledger_transactions
  WHERE type = 'transfer' AND to_asset_id IS NOT NULL
  GROUP BY user_id, to_asset_id
)
SELECT
  a.id AS asset_id,
  a.user_id,
  a.name AS asset_name,
  a.asset_type,
  (COALESCE(i.v, 0) - COALESCE(e.v, 0) - COALESCE(o.v, 0) + COALESCE(ti.v, 0))::BIGINT AS balance
FROM assets a
LEFT JOIN income i ON i.asset_id = a.id AND i.user_id = a.user_id
LEFT JOIN expense e ON e.asset_id = a.id AND e.user_id = a.user_id
LEFT JOIN transfer_out o ON o.asset_id = a.id AND o.user_id = a.user_id
LEFT JOIN transfer_in ti ON ti.asset_id = a.id AND ti.user_id = a.user_id;

-- STEP 3: VIEW 2 — asset_type_totals
CREATE OR REPLACE VIEW asset_type_totals AS
SELECT
  user_id,
  asset_type,
  SUM(balance)::BIGINT AS total_balance
FROM asset_balances
GROUP BY user_id, asset_type;

-- STEP 4: VIEW 3 — asset_summary
CREATE OR REPLACE VIEW asset_summary AS
SELECT
  user_id,
  SUM(CASE WHEN asset_type <> 'loan' THEN balance ELSE 0 END)::BIGINT AS total_assets_excl_loan,
  SUM(CASE WHEN asset_type = 'loan' THEN ABS(balance) ELSE 0 END)::BIGINT AS total_liabilities_abs,
  (SUM(CASE WHEN asset_type <> 'loan' THEN balance ELSE 0 END) 
   - SUM(CASE WHEN asset_type = 'loan' THEN ABS(balance) ELSE 0 END))::BIGINT AS net_worth
FROM asset_balances
GROUP BY user_id;

-- STEP 5: RPC function for UI (uses views)
CREATE OR REPLACE FUNCTION get_user_asset_balances(p_user_id UUID)
RETURNS TABLE (
  asset_id UUID,
  asset_name TEXT,
  asset_type TEXT,
  balance BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ab.asset_id,
    ab.asset_name,
    ab.asset_type,
    ab.balance
  FROM asset_balances ab
  WHERE ab.user_id = p_user_id
  ORDER BY ab.asset_type, ab.asset_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 6: RPC for asset type totals
CREATE OR REPLACE FUNCTION get_user_asset_type_totals(p_user_id UUID)
RETURNS TABLE (
  asset_type TEXT,
  total_balance BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    att.asset_type,
    att.total_balance
  FROM asset_type_totals att
  WHERE att.user_id = p_user_id
  ORDER BY att.asset_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 7: RPC for asset summary
CREATE OR REPLACE FUNCTION get_user_asset_summary(p_user_id UUID)
RETURNS TABLE (
  total_assets_excl_loan BIGINT,
  total_liabilities_abs BIGINT,
  net_worth BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(s.total_assets_excl_loan, 0),
    COALESCE(s.total_liabilities_abs, 0),
    COALESCE(s.net_worth, 0)
  FROM asset_summary s
  WHERE s.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
