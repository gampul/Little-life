-- Add user_id to finance_records and backfill existing rows
-- NOTE: This migration is defensive: if the table doesn't exist, it does nothing.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'finance_records'
  ) THEN
    -- 1) Add column if missing
    ALTER TABLE public.finance_records
      ADD COLUMN IF NOT EXISTS user_id uuid;

    -- 2) Backfill (force unify all existing rows)
    UPDATE public.finance_records
      SET user_id = 'aff522a6-106f-48d8-9c64-e76252d42f49'::uuid;

    -- 3) Enforce not null going forward
    ALTER TABLE public.finance_records
      ALTER COLUMN user_id SET NOT NULL;

    -- 4) Index for query performance
    CREATE INDEX IF NOT EXISTS idx_finance_records_user_id
      ON public.finance_records(user_id);
  END IF;
END $$;

COMMIT;


