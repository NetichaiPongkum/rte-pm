-- ==========================================
-- ADD VENDOR COLUMN TO RECORDS TABLES
-- ==========================================
-- รันสคริปต์นี้ใน Supabase SQL Editor
-- เพื่อเพิ่มคอลัมน์ vendor สำหรับเก็บข้อมูล vendor ขณะบันทึก

-- เพิ่มคอลัมน์ vendor ในตาราง pm_checklist_records
ALTER TABLE public.pm_checklist_records 
ADD COLUMN IF NOT EXISTS vendor TEXT;

-- เพิ่มคอลัมน์ vendor ในตาราง inspection_records
ALTER TABLE public.inspection_records 
ADD COLUMN IF NOT EXISTS vendor TEXT;

-- (Optional) อัปเดต record เก่าที่ยังไม่มี vendor ด้วยค่าจาก mold_master
-- UPDATE public.pm_checklist_records r
-- SET vendor = m.vendor
-- FROM public.mold_master m
-- WHERE r.mold_code = m.mold_code AND r.vendor IS NULL;

-- UPDATE public.inspection_records r
-- SET vendor = m.vendor
-- FROM public.mold_master m
-- WHERE r.mold_code = m.mold_code AND r.vendor IS NULL;
