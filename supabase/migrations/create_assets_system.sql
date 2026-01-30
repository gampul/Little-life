-- ============================================
-- ASSET MANAGEMENT SYSTEM MIGRATION
-- ============================================

-- Step 1: Create assets table
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'other',
  currency TEXT NOT NULL DEFAULT 'KRW',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Indexes for assets table
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);

-- RLS for assets
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets" ON assets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets" ON assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets" ON assets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets" ON assets
  FOR DELETE USING (auth.uid() = user_id);

-- Step 2: Add asset_id columns to ledger_transactions
ALTER TABLE ledger_transactions 
ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES assets(id) ON DELETE SET NULL;

ALTER TABLE ledger_transactions 
ADD COLUMN IF NOT EXISTS to_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL;

-- Index for asset lookups
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_asset_id ON ledger_transactions(asset_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_to_asset_id ON ledger_transactions(to_asset_id);

-- Step 3: Function to classify asset type from name
CREATE OR REPLACE FUNCTION classify_asset_type(asset_name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Loan detection
  IF asset_name ILIKE '%대출%' THEN
    RETURN 'loan';
  END IF;
  
  -- Bank detection (Korean banks, account numbers)
  IF asset_name ILIKE '%은행%' 
     OR asset_name ILIKE '%bank%'
     OR asset_name ~ '\d{3,4}-\d{3,4}-\d{4,}' THEN
    RETURN 'bank';
  END IF;
  
  -- Card detection
  IF asset_name ILIKE '%카드%' 
     OR asset_name ILIKE '%card%' THEN
    RETURN 'card';
  END IF;
  
  -- Cash detection
  IF asset_name ILIKE '%현금%' 
     OR asset_name ILIKE '%cash%' THEN
    RETURN 'cash';
  END IF;
  
  RETURN 'other';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Function to populate assets from existing ledger_transactions
CREATE OR REPLACE FUNCTION migrate_assets_from_transactions()
RETURNS void AS $$
BEGIN
  -- Insert distinct assets from ledger_transactions
  INSERT INTO assets (user_id, name, asset_type, currency)
  SELECT DISTINCT 
    user_id,
    asset,
    classify_asset_type(asset),
    'KRW'
  FROM ledger_transactions
  WHERE asset IS NOT NULL AND asset != ''
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Function to backfill asset_id from asset text
CREATE OR REPLACE FUNCTION backfill_asset_ids()
RETURNS void AS $$
BEGIN
  -- Update asset_id based on asset text
  UPDATE ledger_transactions lt
  SET asset_id = a.id
  FROM assets a
  WHERE lt.asset = a.name 
    AND lt.user_id = a.user_id
    AND lt.asset_id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Run migration
SELECT migrate_assets_from_transactions();
SELECT backfill_asset_ids();

-- Step 7: Create asset_balances view with RPC function
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
    a.id AS asset_id,
    a.name AS asset_name,
    a.asset_type AS asset_type,
    (
      -- Income to this asset
      COALESCE((
        SELECT SUM(amount)::BIGINT 
        FROM ledger_transactions 
        WHERE ledger_transactions.asset_id = a.id 
          AND type = 'income'
          AND user_id = p_user_id
      ), 0)
      -- Minus expense from this asset
      - COALESCE((
        SELECT SUM(amount)::BIGINT 
        FROM ledger_transactions 
        WHERE ledger_transactions.asset_id = a.id 
          AND type = 'expense'
          AND user_id = p_user_id
      ), 0)
      -- Minus transfer FROM this asset
      - COALESCE((
        SELECT SUM(amount)::BIGINT 
        FROM ledger_transactions 
        WHERE ledger_transactions.asset_id = a.id 
          AND type = 'transfer'
          AND user_id = p_user_id
      ), 0)
      -- Plus transfer TO this asset
      + COALESCE((
        SELECT SUM(amount)::BIGINT 
        FROM ledger_transactions 
        WHERE ledger_transactions.to_asset_id = a.id 
          AND type = 'transfer'
          AND user_id = p_user_id
      ), 0)
    )::BIGINT AS balance
  FROM assets a
  WHERE a.user_id = p_user_id
  ORDER BY a.asset_type, a.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create trigger to auto-create asset when inserting transaction
CREATE OR REPLACE FUNCTION auto_create_asset()
RETURNS TRIGGER AS $$
DECLARE
  v_asset_id UUID;
BEGIN
  -- Check if asset exists, create if not
  SELECT id INTO v_asset_id
  FROM assets
  WHERE user_id = NEW.user_id AND name = NEW.asset;
  
  IF v_asset_id IS NULL THEN
    INSERT INTO assets (user_id, name, asset_type, currency)
    VALUES (NEW.user_id, NEW.asset, classify_asset_type(NEW.asset), 'KRW')
    RETURNING id INTO v_asset_id;
  END IF;
  
  NEW.asset_id := v_asset_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_auto_create_asset ON ledger_transactions;
CREATE TRIGGER trg_auto_create_asset
  BEFORE INSERT ON ledger_transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_asset();
