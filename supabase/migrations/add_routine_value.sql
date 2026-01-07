-- Add value column to daily_routine_checks table
-- This allows storing numeric values for routines (e.g., exercise count, water intake)

BEGIN;

-- Add value column (nullable, default NULL)
-- Changed from INTEGER to NUMERIC to support decimal values (e.g., 1.5L)
ALTER TABLE daily_routine_checks 
ADD COLUMN IF NOT EXISTS value NUMERIC;

-- If column already exists as INTEGER, alter its type
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_routine_checks' 
    AND column_name = 'value' 
    AND data_type = 'integer'
  ) THEN
    ALTER TABLE daily_routine_checks 
    ALTER COLUMN value TYPE NUMERIC USING value::NUMERIC;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN daily_routine_checks.value IS 'Numeric value for routine tracking (e.g., exercise count, water intake in ml, decimal values supported)';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_routine_checks_value 
ON daily_routine_checks(value) 
WHERE value IS NOT NULL;

COMMIT;

