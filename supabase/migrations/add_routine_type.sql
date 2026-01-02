-- Add type column to routine_templates table
ALTER TABLE routine_templates 
ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'checkbox';

-- Add check constraint to ensure type is either 'checkbox' or 'number'
ALTER TABLE routine_templates
ADD CONSTRAINT routine_type_check 
CHECK (type IN ('checkbox', 'number'));

-- Update existing records to have 'checkbox' type if NULL
UPDATE routine_templates 
SET type = 'checkbox' 
WHERE type IS NULL;

