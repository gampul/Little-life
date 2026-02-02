-- ==================================================
-- FIX INVALID INCOME CLASSIFICATION
-- ==================================================
-- Problem: +200,000,000 KRW incorrectly included in income
-- Current income: 1,553,594,213
-- Expected income: 1,353,594,213
-- Difference: 200,000,000

-- ==================================================
-- STEP 1: DIAGNOSTIC QUERIES (RUN FIRST)
-- ==================================================

-- 1-A) Income breakdown by asset and category
SELECT
  asset,
  category,
  SUM(amount) AS total_amount,
  COUNT(*) AS tx_count
FROM ledger_transactions
WHERE type = 'income'
GROUP BY asset, category
ORDER BY total_amount DESC;

-- 1-B) Large income transactions (>= 50M)
SELECT
  id,
  date,
  asset,
  category,
  description,
  amount
FROM ledger_transactions
WHERE type = 'income'
  AND amount >= 50000000
ORDER BY amount DESC;

-- 1-C) Find transactions exactly totaling 200M
SELECT
  id,
  date,
  asset,
  category,
  description,
  amount
FROM ledger_transactions
WHERE type = 'income'
  AND (
    amount = 200000000
    OR amount = 100000000
    OR category IN ('중도금대출', '잔금대출', '대출실행', '대출', '잔액수정', '보정', '잔액보정')
  )
ORDER BY amount DESC;

-- ==================================================
-- STEP 2: IDENTIFY INVALID INCOME CATEGORIES
-- ==================================================

-- Common invalid income categories to check:
-- - 중도금대출 (mid-payment loan)
-- - 잔금대출 (balance loan)
-- - 대출실행 (loan execution)
-- - 잔액수정 (balance adjustment)
-- - 보정 (correction)

SELECT
  category,
  SUM(amount) AS total,
  COUNT(*) AS count
FROM ledger_transactions
WHERE type = 'income'
  AND category IN (
    '중도금대출', '잔금대출', '대출실행', '대출',
    '잔액수정', '보정', '잔액보정', '조정'
  )
GROUP BY category;

-- ==================================================
-- STEP 3: FIX - RECLASSIFY TO TRANSFER
-- ==================================================
-- Uncomment and run after verifying the affected transactions

/*
UPDATE ledger_transactions
SET type = 'transfer'
WHERE type = 'income'
  AND category IN (
    '중도금대출', '잔금대출', '대출실행', '대출',
    '잔액수정', '보정', '잔액보정', '조정'
  );
*/

-- ==================================================
-- STEP 4: ALTERNATIVE - EXCLUDE IN CANONICAL VIEW
-- ==================================================
-- Use this if you don't want to modify transaction types

DROP FUNCTION IF EXISTS get_canonical_net_asset(UUID);

CREATE OR REPLACE FUNCTION get_canonical_net_asset(p_user_id UUID)
RETURNS TABLE (
  total_income BIGINT,
  total_expense BIGINT,
  current_net_asset BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(
      CASE 
        WHEN lt.type = 'income' 
         AND lt.category NOT IN ('중도금대출', '잔금대출', '대출실행', '대출', '잔액수정', '보정', '잔액보정', '조정')
        THEN lt.amount 
        ELSE 0 
      END
    ), 0)::BIGINT AS total_income,
    COALESCE(SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END), 0)::BIGINT AS total_expense,
    (COALESCE(SUM(
      CASE 
        WHEN lt.type = 'income' 
         AND lt.category NOT IN ('중도금대출', '잔금대출', '대출실행', '대출', '잔액수정', '보정', '잔액보정', '조정')
        THEN lt.amount 
        ELSE 0 
      END
    ), 0) - COALESCE(SUM(CASE WHEN lt.type = 'expense' THEN lt.amount ELSE 0 END), 0))::BIGINT AS current_net_asset
  FROM ledger_transactions lt
  WHERE lt.user_id = p_user_id
    AND lt.type IN ('income', 'expense');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 5: VERIFICATION
-- ==================================================

-- Run after applying fix:
-- SELECT * FROM get_canonical_net_asset('YOUR_USER_ID');

-- Expected:
-- total_income: 1,353,594,213
-- total_expense: 127,138,721
-- current_net_asset: 1,226,455,492
