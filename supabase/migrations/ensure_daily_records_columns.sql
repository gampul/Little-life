-- Ensure daily_records table has all required columns for chart memo feature
-- Run this in Supabase SQL Editor

-- 1. Check if daily_records table exists, create if not
CREATE TABLE IF NOT EXISTS public.daily_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weight DECIMAL(5,2),
    meal_breakfast BOOLEAN DEFAULT FALSE,
    meal_lunch BOOLEAN DEFAULT FALSE,
    meal_dinner BOOLEAN DEFAULT FALSE,
    meal_memo TEXT,
    meal_images TEXT[] DEFAULT '{}',
    daily_memo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- 2. Add missing columns if they don't exist
DO $$ 
BEGIN
    -- meal_memo column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'daily_records' 
                   AND column_name = 'meal_memo') THEN
        ALTER TABLE public.daily_records ADD COLUMN meal_memo TEXT;
    END IF;
    
    -- meal_images column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'daily_records' 
                   AND column_name = 'meal_images') THEN
        ALTER TABLE public.daily_records ADD COLUMN meal_images TEXT[] DEFAULT '{}';
    END IF;
    
    -- daily_memo column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'daily_records' 
                   AND column_name = 'daily_memo') THEN
        ALTER TABLE public.daily_records ADD COLUMN daily_memo TEXT;
    END IF;
    
    -- updated_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'daily_records' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE public.daily_records ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 3. Enable RLS (Row Level Security)
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies (drop first if exists to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own daily records" ON public.daily_records;
DROP POLICY IF EXISTS "Users can insert own daily records" ON public.daily_records;
DROP POLICY IF EXISTS "Users can update own daily records" ON public.daily_records;
DROP POLICY IF EXISTS "Users can delete own daily records" ON public.daily_records;

CREATE POLICY "Users can view own daily records"
ON public.daily_records FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily records"
ON public.daily_records FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily records"
ON public.daily_records FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily records"
ON public.daily_records FOR DELETE
USING (auth.uid() = user_id);

-- 5. Create Storage bucket for meal images
INSERT INTO storage.buckets (id, name, public)
VALUES ('meal-images', 'meal-images', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage policies
DROP POLICY IF EXISTS "Public read meal images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload meal images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users update meal images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users delete meal images" ON storage.objects;

CREATE POLICY "Public read meal images"
ON storage.objects FOR SELECT
USING (bucket_id = 'meal-images');

CREATE POLICY "Auth users upload meal images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'meal-images' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users update meal images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'meal-images' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users delete meal images"
ON storage.objects FOR DELETE
USING (bucket_id = 'meal-images' AND auth.role() = 'authenticated');

-- Done!
SELECT 'Migration completed successfully!' as result;
