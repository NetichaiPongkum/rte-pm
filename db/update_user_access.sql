-- ==========================================
-- UPDATE USERS TABLE FOR MODULE ACCESS CONTROL
-- ==========================================

-- เพิ่มคอลัมน์สำหรับกำหนดสิทธิ์เข้าถึงโมดูลต่างๆ
-- กำหนดค่าเริ่มต้นเป็น true เพื่อให้ผู้ใช้เดิมยังคงใช้งานได้ตามปกติ
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS can_access_pm BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_inspection BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_access_dashboard BOOLEAN DEFAULT true;

-- หมายเหตุ: สามารถรันสคริปต์นี้ใน Supabase SQL Editor ได้เลย
