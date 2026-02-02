-- ==================================================
-- CURRENT ASSET CALCULATION
-- ==================================================
-- Assumptions:
-- 1. All initial balances = 0
-- 2. Transfers are EXCLUDED (asset-to-asset movement only)
-- 3. current_asset = total_income - total_expense

SELECT
  COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
  COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
  COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS current_asset
FROM ledger_transactions;

-- ==================================================
-- BREAKDOWN BY TYPE (verification)
-- ==================================================

SELECT
  type,
  COUNT(*) AS transaction_count,
  SUM(amount) AS total_amount
FROM ledger_transactions
GROUP BY type
ORDER BY type;
