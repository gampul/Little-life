-- ==================================================
-- FINAL FINANCIAL SUMMARY (LOCKED)
-- ==================================================
-- Target values:
-- Total Income: 1,353,594,213 KRW
-- Total Expense: 127,138,721 KRW
-- Current Net Asset: 1,226,455,492 KRW

-- ==================================================
-- STEP 1: DIAGNOSTIC - Check current data
-- ==================================================

-- 1-A) All income categories
-- SELECT category, SUM(amount) as total, COUNT(*) as count
-- FROM ledger_transactions
-- WHERE user_id = 'aff522a6-106f-48d8-9c64-e76252d42f49' AND type = 'income'
-- GROUP BY category ORDER BY total DESC;

-- 1-B) All expense categories
-- SELECT category, SUM(amount) as total, COUNT(*) as count
-- FROM ledger_transactions
-- WHERE user_id = 'aff522a6-106f-48d8-9c64-e76252d42f49' AND type = 'expense'
-- GROUP BY category ORDER BY total DESC;

-- 1-C) All transfer categories
-- SELECT category, SUM(amount) as total, COUNT(*) as count
-- FROM ledger_transactions
-- WHERE user_id = 'aff522a6-106f-48d8-9c64-e76252d42f49' AND type = 'transfer'
-- GROUP BY category ORDER BY total DESC;

-- ==================================================
-- STEP 2: CLEAN VIEWS AND FUNCTIONS
-- ==================================================

DROP VIEW IF EXISTS canonical_financial_summary CASCADE;
DROP FUNCTION IF EXISTS get_financial_summary(UUID);
DROP FUNCTION IF EXISTS get_cash_flow_delta(UUID);

-- ==================================================
-- STEP 3: TRUE INCOME CATEGORIES (SEMANTIC MATCHING)
-- ==================================================
-- Real income = 근로소득, 사업소득, 금융소득, 기타소득 variations
-- Exclude: 잔액수정, 대출, 보정, 조정

CREATE OR REPLACE FUNCTION get_financial_summary(p_user_id UUID)
RETURNS TABLE (
  total_income BIGINT,
  total_expense BIGINT,
  current_net_asset BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- TRUE INCOME: semantic matching with LIKE
    COALESCE(SUM(
      CASE
        WHEN lt.type = 'income'
         AND (
           lt.category ILIKE '%근로소득%'
           OR lt.category ILIKE '%사업소득%'
           OR lt.category ILIKE '%금융소득%'
           OR lt.category ILIKE '%이자%'
           OR lt.category ILIKE '%배당%'
           OR lt.category ILIKE '%기타소득%'
           OR lt.category ILIKE '%급여%'
         )
         AND lt.category NOT ILIKE '%잔액%'
         AND lt.category NOT ILIKE '%대출%'
         AND lt.category NOT ILIKE '%보정%'
         AND lt.category NOT ILIKE '%조정%'
        THEN lt.amount
        ELSE 0
      END
    ), 0)::BIGINT AS total_income,

    -- EXPENSE: real consumption only
    COALESCE(SUM(
      CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END
    ), 0)::BIGINT AS total_expense,

    -- NET ASSET
    (
      COALESCE(SUM(
        CASE
          WHEN lt.type = 'income'
           AND (
             lt.category ILIKE '%근로소득%'
             OR lt.category ILIKE '%사업소득%'
             OR lt.category ILIKE '%금융소득%'
             OR lt.category ILIKE '%이자%'
             OR lt.category ILIKE '%배당%'
             OR lt.category ILIKE '%기타소득%'
             OR lt.category ILIKE '%급여%'
           )
           AND lt.category NOT ILIKE '%잔액%'
           AND lt.category NOT ILIKE '%대출%'
           AND lt.category NOT ILIKE '%보정%'
           AND lt.category NOT ILIKE '%조정%'
          THEN lt.amount
          ELSE 0
        END
      ), 0)
      -
      COALESCE(SUM(
        CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END
      ), 0)
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
    COALESCE(SUM(
      CASE
        WHEN lt.type = 'income'
         AND (
           lt.category ILIKE '%근로소득%'
           OR lt.category ILIKE '%사업소득%'
           OR lt.category ILIKE '%금융소득%'
           OR lt.category ILIKE '%이자%'
           OR lt.category ILIKE '%배당%'
           OR lt.category ILIKE '%기타소득%'
           OR lt.category ILIKE '%급여%'
         )
         AND lt.category NOT ILIKE '%잔액%'
         AND lt.category NOT ILIKE '%대출%'
         AND lt.category NOT ILIKE '%보정%'
         AND lt.category NOT ILIKE '%조정%'
        THEN lt.amount
        ELSE 0
      END
    ), 0)::BIGINT AS total_inflow,

    COALESCE(SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END), 0)::BIGINT AS total_outflow,
    COALESCE(SUM(CASE WHEN lt.type = 'transfer' THEN lt.amount ELSE 0 END), 0)::BIGINT AS total_transfer,

    (
      COALESCE(SUM(
        CASE
          WHEN lt.type = 'income'
           AND (
             lt.category ILIKE '%근로소득%'
             OR lt.category ILIKE '%사업소득%'
             OR lt.category ILIKE '%금융소득%'
             OR lt.category ILIKE '%이자%'
             OR lt.category ILIKE '%배당%'
             OR lt.category ILIKE '%기타소득%'
             OR lt.category ILIKE '%급여%'
           )
           AND lt.category NOT ILIKE '%잔액%'
           AND lt.category NOT ILIKE '%대출%'
           AND lt.category NOT ILIKE '%보정%'
           AND lt.category NOT ILIKE '%조정%'
          THEN lt.amount
          ELSE 0
        END
      ), 0)
      - COALESCE(SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN lt.type = 'transfer' THEN lt.amount ELSE 0 END), 0)
    )::BIGINT AS cash_flow_delta
  FROM ledger_transactions lt
  WHERE lt.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 5: VERIFICATION
-- ==================================================
-- SELECT * FROM get_financial_summary('aff522a6-106f-48d8-9c64-e76252d42f49');
-- Expected:
-- total_income: 1,353,594,213
-- total_expense: 127,138,721
-- current_net_asset: 1,226,455,492
