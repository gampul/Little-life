-- Create investment_diary_entries table
CREATE TABLE IF NOT EXISTS investment_diary_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, entry_date)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_investment_diary_user_date 
  ON investment_diary_entries(user_id, entry_date DESC);

-- Enable RLS
ALTER TABLE investment_diary_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own entries
CREATE POLICY "Users can view their own diary entries"
  ON investment_diary_entries
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own diary entries"
  ON investment_diary_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own diary entries"
  ON investment_diary_entries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own diary entries"
  ON investment_diary_entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_investment_diary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_investment_diary_updated_at_trigger
  BEFORE UPDATE ON investment_diary_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_investment_diary_updated_at();

