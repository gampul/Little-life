-- Ledger CSV import support:
-- - transaction_import_batches: tracks file uploads (dedupe by file_hash)
-- - transactions: adds import metadata columns & unique row hash index for dedupe
--
-- This migration is defensive (runs only if target tables exist).

BEGIN;

-- 1) Create batch table
CREATE TABLE IF NOT EXISTS public.transaction_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_hash text NOT NULL,
  filename text,
  rows_total integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_import_batches ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent via DO checks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'transaction_import_batches' AND policyname = 'import_batches_select_own'
  ) THEN
    CREATE POLICY import_batches_select_own
      ON public.transaction_import_batches
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'transaction_import_batches' AND policyname = 'import_batches_insert_own'
  ) THEN
    CREATE POLICY import_batches_insert_own
      ON public.transaction_import_batches
      FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Unique index for file-level dedupe per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_import_batches_user_file_hash
  ON public.transaction_import_batches(user_id, file_hash);

-- 2) Alter transactions table (only if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transactions'
  ) THEN
    ALTER TABLE public.transactions
      ADD COLUMN IF NOT EXISTS import_batch_id uuid,
      ADD COLUMN IF NOT EXISTS source text,
      ADD COLUMN IF NOT EXISTS source_row_hash text;

    -- FK (idempotent)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'transactions_import_batch_id_fkey'
    ) THEN
      ALTER TABLE public.transactions
        ADD CONSTRAINT transactions_import_batch_id_fkey
        FOREIGN KEY (import_batch_id)
        REFERENCES public.transaction_import_batches(id)
        ON DELETE SET NULL;
    END IF;

    -- Unique index for row-level dedupe per user
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_user_source_row_hash
      ON public.transactions(user_id, source_row_hash)
      WHERE source_row_hash IS NOT NULL;
  END IF;
END $$;

COMMIT;


