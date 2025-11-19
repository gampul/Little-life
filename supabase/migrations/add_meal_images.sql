-- Add meal_images column to daily_records table
ALTER TABLE daily_records 
ADD COLUMN IF NOT EXISTS meal_images TEXT[] DEFAULT '{}';

-- Add comment
COMMENT ON COLUMN daily_records.meal_images IS 'Array of image URLs for meal photos';

-- Create storage bucket for meal images if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('meal-images', 'meal-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for meal images bucket
CREATE POLICY "Public Access for meal images"
ON storage.objects FOR SELECT
USING (bucket_id = 'meal-images');

CREATE POLICY "Authenticated users can upload meal images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'meal-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own meal images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'meal-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own meal images"
ON storage.objects FOR DELETE
USING (bucket_id = 'meal-images' AND auth.role() = 'authenticated');

