-- ============================================
-- EXCEL DATA MIGRATION TO ASSETS
-- ============================================

-- STEP 1: Populate assets table from ledger_transactions
INSERT INTO assets (id, user_id, name, asset_type, currency, created_at)
SELECT
  gen_random_uuid(),
  lt.user_id,
  lt.asset AS name,
  CASE
    WHEN lt.asset ILIKE '%대출%' THEN 'loan'
    WHEN lt.asset ILIKE '%은행%' OR lt.asset ~ '\d{3,4}-\d{3,4}-\d{4,}' THEN 'bank'
    WHEN lt.asset ILIKE '%카드%' THEN 'card'
    WHEN lt.asset ILIKE '%현금%' THEN 'cash'
    ELSE 'other'
  END AS asset_type,
  'KRW',
  NOW()
FROM ledger_transactions lt
WHERE lt.asset IS NOT NULL AND lt.asset != ''
GROUP BY lt.user_id, lt.asset
ON CONFLICT (user_id, name) DO NOTHING;

-- STEP 2: Backfill asset_id in ledger_transactions
UPDATE ledger_transactions lt
SET asset_id = a.id
FROM assets a
WHERE lt.asset = a.name
  AND lt.user_id = a.user_id
  AND lt.asset_id IS NULL;

-- STEP 3: Historical transfers - to_asset_id remains NULL (intentional)
-- No action needed

-- STEP 4: Create/Replace asset_balances view
CREATE OR REPLACE VIEW asset_balances AS
SELECT
  a.id AS asset_id,
  a.user_id,
  a.name AS asset_name,
  a.asset_type,
  COALESCE(SUM(
    CASE
      WHEN lt.type = 'income' AND lt.asset_id = a.id THEN lt.amount
      WHEN lt.type = 'expense' AND lt.asset_id = a.id THEN -lt.amount
      WHEN lt.type = 'transfer' AND lt.asset_id = a.id THEN -lt.amount
      WHEN lt.type = 'transfer' AND lt.to_asset_id = a.id THEN lt.amount
      ELSE 0
    END
  ), 0)::BIGINT AS balance
FROM assets a
LEFT JOIN ledger_transactions lt
  ON (lt.asset_id = a.id OR lt.to_asset_id = a.id)
  AND lt.user_id = a.user_id
GROUP BY a.id, a.user_id, a.name, a.asset_type;

-- Verification queries (optional - check results)
-- SELECT COUNT(*) AS total_assets FROM assets;
-- SELECT COUNT(*) AS linked_transactions FROM ledger_transactions WHERE asset_id IS NOT NULL;
-- SELECT * FROM asset_balances ORDER BY asset_type, asset_name;
