-- Align repo drift: live memo_categories already has updated_at;
-- local migration_memo_categories.sql omitted it. Idempotent for live.

ALTER TABLE memo_categories
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
