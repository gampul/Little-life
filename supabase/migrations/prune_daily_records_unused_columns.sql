-- Prune unused/legacy columns from daily_records.
-- Keeps only the columns currently used by the app.
--
-- Kept columns (whitelist):
-- - id, user_id, date
-- - weight
-- - meal_breakfast, meal_lunch, meal_dinner
-- - meal_memo, meal_images
-- - daily_memo
-- - created_at, updated_at
--
-- This migration drops every other column on public.daily_records (IF EXISTS, safe to re-run).

BEGIN;

DO $$
DECLARE
  col record;
  keep_cols text[] := ARRAY[
    'id',
    'user_id',
    'date',
    'weight',
    'meal_breakfast',
    'meal_lunch',
    'meal_dinner',
    'meal_memo',
    'meal_images',
    'daily_memo',
    'created_at',
    'updated_at'
  ];
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'daily_records'
  ) THEN
    FOR col IN
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'daily_records'
        AND NOT (column_name = ANY(keep_cols))
    LOOP
      EXECUTE format('ALTER TABLE public.daily_records DROP COLUMN IF EXISTS %I;', col.column_name);
    END LOOP;
  END IF;
END $$;

COMMIT;


