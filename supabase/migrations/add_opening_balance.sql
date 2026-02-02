-- ============================================
-- ADD OPENING BALANCE SUPPORT
-- ============================================
-- Option A: Opening Balance as Transaction Type

-- STEP 1: Add 'opening_balance' to type constraint if exists
-- (PostgreSQL doesn't have native ENUM modification, so we handle it via CHECK constraint or allow text)

-- First, check if type column has a constraint and handle accordingly
-- For safety, we'll ensure the type column accepts 'opening_balance'

-- STEP 2: Update asset_balances view to include opening_balance as income
DROP VIEW IF EXISTS asset_summary CASCADE;
DROP VIEW IF EXISTS asset_type_totals CASCADE;
DROP VIEW IF EXISTS asset_balances CASCADE;

CREATE OR REPLACE VIEW asset_balances AS
WITH
-- Opening balance acts as initial income
opening AS (
  SELECT user_id, asset_id, SUM(amount)::BIGINT AS v
  FROM ledger_transactions
  WHERE type = 'opening_balance' AND asset_id IS NOT NULL
  GROUP BY user_id, asset_id
),
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
  (COALESCE(ob.v, 0) + COALESCE(i.v, 0) - COALESCE(e.v, 0) - COALESCE(o.v, 0) + COALESCE(ti.v, 0))::BIGINT AS balance
FROM assets a
LEFT JOIN opening ob ON ob.asset_id = a.id AND ob.user_id = a.user_id
LEFT JOIN income i ON i.asset_id = a.id AND i.user_id = a.user_id
LEFT JOIN expense e ON e.asset_id = a.id AND e.user_id = a.user_id
LEFT JOIN transfer_out o ON o.asset_id = a.id AND o.user_id = a.user_id
LEFT JOIN transfer_in ti ON ti.asset_id = a.id AND ti.user_id = a.user_id;

-- STEP 3: Recreate asset_type_totals view
CREATE OR REPLACE VIEW asset_type_totals AS
SELECT
  user_id,
  asset_type,
  SUM(balance)::BIGINT AS total_balance
FROM asset_balances
GROUP BY user_id, asset_type;

-- STEP 4: Recreate asset_summary view
CREATE OR REPLACE VIEW asset_summary AS
SELECT
  user_id,
  SUM(CASE WHEN asset_type <> 'loan' THEN balance ELSE 0 END)::BIGINT AS total_assets_excl_loan,
  SUM(CASE WHEN asset_type = 'loan' THEN ABS(balance) ELSE 0 END)::BIGINT AS total_liabilities_abs,
  (SUM(CASE WHEN asset_type <> 'loan' THEN balance ELSE 0 END) 
   - SUM(CASE WHEN asset_type = 'loan' THEN ABS(balance) ELSE 0 END))::BIGINT AS net_worth
FROM asset_balances
GROUP BY user_id;

-- STEP 5: Update RPC functions to include opening_balance in ledger summary
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
    COALESCE(SUM(CASE WHEN type IN ('income', 'opening_balance') THEN amount ELSE 0 END), 0)::BIGINT AS total_income,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::BIGINT AS total_expense,
    COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0)::BIGINT AS total_transfer,
    (COALESCE(SUM(CASE WHEN type IN ('income', 'opening_balance') THEN amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0))::BIGINT AS net_cash_position
  FROM ledger_transactions
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 6: RPC to insert opening balance (one per asset)
CREATE OR REPLACE FUNCTION upsert_opening_balance(
  p_user_id UUID,
  p_asset_id UUID,
  p_amount BIGINT,
  p_date DATE DEFAULT '2022-12-31'
)
RETURNS void AS $$
BEGIN
  -- Delete existing opening_balance for this asset
  DELETE FROM ledger_transactions
  WHERE user_id = p_user_id
    AND asset_id = p_asset_id
    AND type = 'opening_balance';
  
  -- Insert new opening_balance if amount is not zero
  IF p_amount <> 0 THEN
    INSERT INTO ledger_transactions (
      user_id,
      asset_id,
      date,
      amount,
      type,
      category,
      description,
      currency,
      source
    ) VALUES (
      p_user_id,
      p_asset_id,
      p_date,
      p_amount,
      'opening_balance',
      '초기잔액',
      '시스템 초기 잔액 설정',
      'KRW',
      'app'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 7: RPC to get computed balance (before opening balance) for an asset
CREATE OR REPLACE FUNCTION get_asset_computed_balance(
  p_user_id UUID,
  p_asset_id UUID
)
RETURNS BIGINT AS $$
DECLARE
  v_income BIGINT;
  v_expense BIGINT;
  v_transfer_out BIGINT;
  v_transfer_in BIGINT;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_income
  FROM ledger_transactions
  WHERE user_id = p_user_id AND asset_id = p_asset_id AND type = 'income';
  
  SELECT COALESCE(SUM(amount), 0) INTO v_expense
  FROM ledger_transactions
  WHERE user_id = p_user_id AND asset_id = p_asset_id AND type = 'expense';
  
  SELECT COALESCE(SUM(amount), 0) INTO v_transfer_out
  FROM ledger_transactions
  WHERE user_id = p_user_id AND asset_id = p_asset_id AND type = 'transfer';
  
  SELECT COALESCE(SUM(amount), 0) INTO v_transfer_in
  FROM ledger_transactions
  WHERE user_id = p_user_id AND to_asset_id = p_asset_id AND type = 'transfer';
  
  RETURN v_income - v_expense - v_transfer_out + v_transfer_in;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 8: RPC to calculate and set opening balance to match real balance
CREATE OR REPLACE FUNCTION set_asset_real_balance(
  p_user_id UUID,
  p_asset_id UUID,
  p_real_balance BIGINT
)
RETURNS void AS $$
DECLARE
  v_computed BIGINT;
  v_opening_needed BIGINT;
BEGIN
  -- Get current computed balance (excluding any existing opening_balance)
  SELECT COALESCE(SUM(
    CASE 
      WHEN type = 'income' THEN amount
      WHEN type = 'expense' THEN -amount
      WHEN type = 'transfer' AND asset_id = p_asset_id THEN -amount
      WHEN type = 'transfer' AND to_asset_id = p_asset_id THEN amount
      ELSE 0
    END
  ), 0) INTO v_computed
  FROM ledger_transactions
  WHERE user_id = p_user_id
    AND (asset_id = p_asset_id OR to_asset_id = p_asset_id)
    AND type <> 'opening_balance';
  
  -- Calculate required opening balance
  v_opening_needed := p_real_balance - v_computed;
  
  -- Upsert the opening balance
  PERFORM upsert_opening_balance(p_user_id, p_asset_id, v_opening_needed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
