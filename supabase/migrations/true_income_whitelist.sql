-- ==================================================
-- TRUE INCOME WHITELIST IMPLEMENTATION
-- ==================================================
-- Verified target:
-- Total Income: 1,353,594,213 KRW
-- Total Expense: 127,138,721 KRW
-- Current Net Asset: 1,226,455,492 KRW

-- ==================================================
-- STEP 1: DROP OLD FUNCTIONS AND VIEWS
-- ==================================================

DROP VIEW IF EXISTS canonical_financial_summary CASCADE;
DROP VIEW IF EXISTS dynamic_financial_summary CASCADE;
DROP FUNCTION IF EXISTS get_financial_summary(UUID);
DROP FUNCTION IF EXISTS get_canonical_net_asset(UUID);
DROP FUNCTION IF EXISTS get_cash_flow_delta(UUID);

-- ==================================================
-- STEP 2: CANONICAL FINANCIAL SUMMARY VIEW
-- ==================================================
-- Uses TRUE INCOME WHITELIST

CREATE OR REPLACE VIEW canonical_financial_summary AS
SELECT
  SUM(
    CASE
      WHEN type = 'income'
       AND category IN (
         '근로소득',
         '급여',
         '금융소득',
         '금융소득(미과세)',
         '이자',
         '배당',
         '기타소득'
       )
      THEN amount
      ELSE 0
    END
  )::BIGINT AS total_income,

  SUM(
    CASE
      WHEN type = 'expense'
      THEN amount
      ELSE 0
    END
  )::BIGINT AS total_expense,

  (
    SUM(
      CASE
        WHEN type = 'income'
         AND category IN (
           '근로소득',
           '급여',
           '금융소득',
           '금융소득(미과세)',
           '이자',
           '배당',
           '기타소득'
         )
        THEN amount
        ELSE 0
      END
    )
    -
    SUM(
      CASE
        WHEN type = 'expense'
        THEN amount
        ELSE 0
      END
    )
  )::BIGINT AS current_net_asset
FROM ledger_transactions;

-- ==================================================
-- STEP 3: RPC FOR APP (PER USER)
-- ==================================================

CREATE OR REPLACE FUNCTION get_financial_summary(p_user_id UUID)
RETURNS TABLE (
  total_income BIGINT,
  total_expense BIGINT,
  current_net_asset BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    SUM(
      CASE
        WHEN lt.type = 'income'
         AND lt.category IN (
           '근로소득',
           '급여',
           '금융소득',
           '금융소득(미과세)',
           '이자',
           '배당',
           '기타소득'
         )
        THEN lt.amount
        ELSE 0
      END
    )::BIGINT AS total_income,

    SUM(
      CASE
        WHEN lt.type = 'expense'
        THEN lt.amount
        ELSE 0
      END
    )::BIGINT AS total_expense,

    (
      SUM(
        CASE
          WHEN lt.type = 'income'
           AND lt.category IN (
             '근로소득',
             '급여',
             '금융소득',
             '금융소득(미과세)',
             '이자',
             '배당',
             '기타소득'
           )
          THEN lt.amount
          ELSE 0
        END
      )
      -
      SUM(
        CASE
          WHEN lt.type = 'expense'
          THEN lt.amount
          ELSE 0
        END
      )
    )::BIGINT AS current_net_asset
  FROM ledger_transactions lt
  WHERE lt.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 4: CASH FLOW DELTA (includes transfer)
-- ==================================================

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
    SUM(
      CASE
        WHEN lt.type = 'income'
         AND lt.category IN (
           '근로소득',
           '급여',
           '금융소득',
           '금융소득(미과세)',
           '이자',
           '배당',
           '기타소득'
         )
        THEN lt.amount
        ELSE 0
      END
    )::BIGINT AS total_inflow,

    SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END)::BIGINT AS total_outflow,
    SUM(CASE WHEN lt.type = 'transfer' THEN lt.amount ELSE 0 END)::BIGINT AS total_transfer,

    (
      SUM(
        CASE
          WHEN lt.type = 'income'
           AND lt.category IN (
             '근로소득',
             '급여',
             '금융소득',
             '금융소득(미과세)',
             '이자',
             '배당',
             '기타소득'
           )
          THEN lt.amount
          ELSE 0
        END
      )
      - SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END)
      - SUM(CASE WHEN lt.type = 'transfer' THEN lt.amount ELSE 0 END)
    )::BIGINT AS cash_flow_delta
  FROM ledger_transactions lt
  WHERE lt.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 5: VALIDATION
-- ==================================================
-- Run after migration:

-- SELECT * FROM canonical_financial_summary;
-- Expected:
-- total_income: 1,353,594,213
-- total_expense: 127,138,721
-- current_net_asset: 1,226,455,492

-- SELECT * FROM get_financial_summary('aff522a6-106f-48d8-9c64-e76252d42f49');
-- Same expected values
