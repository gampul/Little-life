-- ==================================================
-- LOCK FINANCIAL SUMMARY (FINAL)
-- ==================================================
-- Verified baseline values:
-- Total Income: 1,353,594,213 KRW
-- Total Expense: 127,138,721 KRW
-- Current Net Asset: 1,226,455,492 KRW

-- ==================================================
-- STEP 1: CANONICAL BASELINE (LOCKED REFERENCE)
-- ==================================================

DROP VIEW IF EXISTS canonical_financial_summary CASCADE;

CREATE OR REPLACE VIEW canonical_financial_summary AS
SELECT
  1353594213::BIGINT AS total_income,
  127138721::BIGINT AS total_expense,
  (1353594213 - 127138721)::BIGINT AS current_net_asset;

-- ==================================================
-- STEP 2: DYNAMIC VERIFICATION VIEW
-- ==================================================

DROP VIEW IF EXISTS dynamic_financial_summary CASCADE;

CREATE OR REPLACE VIEW dynamic_financial_summary AS
SELECT
  SUM(CASE
        WHEN type = 'income'
         AND COALESCE(category, '') NOT IN ('중도금대출', '잔금대출', '대출실행', '대출', '잔액수정', '보정', '잔액보정', '조정')
        THEN amount
        ELSE 0
      END)::BIGINT AS total_income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)::BIGINT AS total_expense,
  (
    SUM(CASE
          WHEN type = 'income'
           AND COALESCE(category, '') NOT IN ('중도금대출', '잔금대출', '대출실행', '대출', '잔액수정', '보정', '잔액보정', '조정')
          THEN amount
          ELSE 0
        END)
    -
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)
  )::BIGINT AS current_net_asset
FROM ledger_transactions;

-- ==================================================
-- STEP 3: RPC FUNCTION FOR APP (USES DYNAMIC VIEW)
-- ==================================================

DROP FUNCTION IF EXISTS get_canonical_net_asset(UUID);
DROP FUNCTION IF EXISTS get_financial_summary(UUID);

CREATE OR REPLACE FUNCTION get_financial_summary(p_user_id UUID)
RETURNS TABLE (
  total_income BIGINT,
  total_expense BIGINT,
  current_net_asset BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    SUM(CASE
          WHEN lt.type = 'income'
           AND COALESCE(lt.category, '') NOT IN ('중도금대출', '잔금대출', '대출실행', '대출', '잔액수정', '보정', '잔액보정', '조정')
          THEN lt.amount
          ELSE 0
        END)::BIGINT AS total_income,
    SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END)::BIGINT AS total_expense,
    (
      SUM(CASE
            WHEN lt.type = 'income'
             AND COALESCE(lt.category, '') NOT IN ('중도금대출', '잔금대출', '대출실행', '대출', '잔액수정', '보정', '잔액보정', '조정')
            THEN lt.amount
            ELSE 0
          END)
      -
      SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END)
    )::BIGINT AS current_net_asset
  FROM ledger_transactions lt
  WHERE lt.user_id = p_user_id
    AND lt.type IN ('income', 'expense');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alias for backward compatibility
CREATE OR REPLACE FUNCTION get_canonical_net_asset(p_user_id UUID)
RETURNS TABLE (
  total_income BIGINT,
  total_expense BIGINT,
  current_net_asset BIGINT
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM get_financial_summary(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 4: CASH FLOW DELTA (SECONDARY, includes transfer)
-- ==================================================

DROP FUNCTION IF EXISTS get_cash_flow_delta(UUID);

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
    SUM(CASE
          WHEN lt.type = 'income'
           AND COALESCE(lt.category, '') NOT IN ('중도금대출', '잔금대출', '대출실행', '대출', '잔액수정', '보정', '잔액보정', '조정')
          THEN lt.amount
          ELSE 0
        END)::BIGINT AS total_inflow,
    SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END)::BIGINT AS total_outflow,
    SUM(CASE WHEN lt.type = 'transfer' THEN lt.amount ELSE 0 END)::BIGINT AS total_transfer,
    (
      SUM(CASE
            WHEN lt.type = 'income'
             AND COALESCE(lt.category, '') NOT IN ('중도금대출', '잔금대출', '대출실행', '대출', '잔액수정', '보정', '잔액보정', '조정')
            THEN lt.amount
            ELSE 0
          END)
      - SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END)
      - SUM(CASE WHEN lt.type = 'transfer' THEN lt.amount ELSE 0 END)
    )::BIGINT AS cash_flow_delta
  FROM ledger_transactions lt
  WHERE lt.user_id = p_user_id
    AND lt.type IN ('income', 'expense', 'transfer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 5: VALIDATION QUERY
-- ==================================================
-- Run this after migration to verify:

-- SELECT * FROM canonical_financial_summary;
-- SELECT * FROM dynamic_financial_summary;
-- SELECT * FROM get_financial_summary('aff522a6-106f-48d8-9c64-e76252d42f49');

-- All must return:
-- total_income: 1,353,594,213
-- total_expense: 127,138,721
-- current_net_asset: 1,226,455,492
