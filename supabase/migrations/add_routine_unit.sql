-- Add unit column to routine_templates table
ALTER TABLE routine_templates
ADD COLUMN IF NOT EXISTS unit VARCHAR(50);

-- Add comment to the column
COMMENT ON COLUMN routine_templates.unit IS 'Unit for number type routines (e.g., 분, Km, 원)';

