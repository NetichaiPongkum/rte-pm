-- ==========================================
-- ADD IMAGES COLUMN TO PM & INSPECTION RECORDS
-- ==========================================
ALTER TABLE public.pm_checklist_records ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
ALTER TABLE public.inspection_records ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
