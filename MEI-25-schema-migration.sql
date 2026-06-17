-- MEI-25: Add measurements and reference_images columns to enquiries table
-- Execute this in Supabase Dashboard > SQL Editor

-- Add measurements column (stores measurement data as JSONB)
ALTER TABLE public.enquiries
ADD COLUMN IF NOT EXISTS measurements JSONB;

-- Add reference_images column (stores image URLs as JSONB array)
ALTER TABLE public.enquiries
ADD COLUMN IF NOT EXISTS reference_images JSONB;

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'enquiries'
ORDER BY ordinal_position;
