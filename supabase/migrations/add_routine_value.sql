-- Add value column to daily_routine_checks table
-- This allows storing numeric values for routines (e.g., exercise count, water intake)

BEGIN;

-- Add value column (nullable, default NULL)
ALTER TABLE daily_routine_checks 
ADD COLUMN IF NOT EXISTS value INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN daily_routine_checks.value IS 'Numeric value for routine tracking (e.g., exercise count, water intake in ml)';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_routine_checks_value 
ON daily_routine_checks(value) 
WHERE value IS NOT NULL;

COMMIT;

