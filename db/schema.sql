-- ==========================================
-- PM MOLD RTE - Supabase Database Schema
-- ==========================================
-- รันสคริปต์นี้ใน Supabase SQL Editor
-- เพื่อสร้างตารางทั้งหมดที่จำเป็น

-- ==========================================
-- USERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',        -- admin, engineer, operator, user
    vendor_access TEXT DEFAULT 'ALL', -- 'ALL' or specific vendor name
    display_name TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- MOLD MASTER TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.mold_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mold_code TEXT UNIQUE NOT NULL,    -- ASSET1
    mold_name TEXT,                   -- NAME MOLD
    dwg_part1 TEXT,                   -- DWG PART
    part_name TEXT,                   -- PART NAME
    vendor TEXT,                      -- VENDOR
    machine_no TEXT,
    cavity INTEGER,
    mold_type TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- PM CATEGORIES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.pm_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- PM CHECKLIST TEMPLATES (Admin-managed)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.pm_checklist_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name TEXT NOT NULL,
    category_id UUID REFERENCES public.pm_categories(id),
    pm_level INTEGER DEFAULT 1,     -- 1, 2, 3
    items JSONB NOT NULL DEFAULT '[]',  -- Array of { name, category }
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- PM CHECKLIST RECORDS (Completed inspections)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.pm_checklist_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.pm_checklist_templates(id),
    template_name TEXT,
    checklist_type TEXT,
    category_name TEXT,
    pm_level INTEGER,
    mold_code TEXT NOT NULL,
    vendor TEXT,
    performed_by TEXT,
    performed_date DATE,
    checklist_data JSONB DEFAULT '[]',  -- Array of { name, category, result: pass|fail|na }
    notes TEXT,
    status TEXT DEFAULT 'completed',
    pass_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    na_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- PM RECORDS (completed PM jobs)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.pm_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mold_id UUID REFERENCES public.mold_master(id),
    mold_code TEXT,
    template_id UUID REFERENCES public.pm_checklist_templates(id),
    performed_by TEXT,
    performed_date DATE,
    shot_count NUMERIC,
    status TEXT DEFAULT 'pending',    -- pending, in_progress, completed, approved
    checklist_data JSONB DEFAULT '{}',
    findings TEXT,
    actions_taken TEXT,
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- PARTS MASTER DATABASE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.parts_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor TEXT,
    "partAssyNo" TEXT,
    "partAssyName" TEXT,
    "partCode" TEXT,
    "partName" TEXT,
    "matNo" TEXT,
    "matName" TEXT,
    "partWeight" TEXT,
    "runnerWeight" TEXT,
    "lossWeight" TEXT,
    "totalWeight" TEXT,
    "lossPercent" TEXT,
    "matSupply" TEXT,
    "totalMatSupply" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- ISSUES / PROBLEM REPORTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.issues_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor TEXT,
    mold_code TEXT,
    "issueType" TEXT,
    "partCode" TEXT,
    "partName" TEXT,
    details TEXT,
    status TEXT DEFAULT 'open',      -- open, in_progress, resolved, closed
    priority TEXT DEFAULT 'medium',  -- low, medium, high, critical
    "reportedBy" TEXT,
    "imageBase64" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "dateStr" TEXT,
    reply TEXT,
    "replyBy" TEXT,
    "replyAt" TIMESTAMP WITH TIME ZONE,
    "acceptedBy" TEXT,
    "acceptedAt" TIMESTAMP WITH TIME ZONE,
    "closedBy" TEXT,
    "closedAt" TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- WASTE/DEFECT REPORTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.waste_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TEXT,
    "partCode" TEXT,
    "partName" TEXT,
    "poNo" TEXT,
    "orderQty" NUMERIC,
    "prodQtyDay" NUMERIC,
    "prodQtyNight" NUMERIC,
    "prodQty" NUMERIC,
    "remainQty" NUMERIC,
    ng NUMERIC,
    "ngPercent" NUMERIC,
    remark TEXT,
    "mcNo" TEXT,
    weight TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE,
    defect_1 NUMERIC, defect_2 NUMERIC, defect_3 NUMERIC,
    defect_4 NUMERIC, defect_5 NUMERIC, defect_6 NUMERIC,
    defect_7 NUMERIC, defect_8 NUMERIC, defect_9 NUMERIC,
    defect_10 NUMERIC, defect_11 NUMERIC, defect_12 NUMERIC,
    defect_13 NUMERIC, defect_14 NUMERIC, defect_15 NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- KNOWLEDGE BASE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    description TEXT,
    category TEXT,
    link TEXT,
    "fileName" TEXT,
    "fileSize" NUMERIC,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "downloadCount" NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- EXTERNAL LINKS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.external_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    url TEXT,
    "isVisible" BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==========================================
-- ENABLE REALTIME
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_checklist_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_checklist_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parts_master;
ALTER PUBLICATION supabase_realtime ADD TABLE public.issues_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waste_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.knowledge_base;
ALTER PUBLICATION supabase_realtime ADD TABLE public.external_links;


-- ==========================================
-- ROW LEVEL SECURITY (RLS) - Basic Setup
-- ==========================================
-- เปิด RLS สำหรับทุกตาราง
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mold_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_checklist_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_links ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all for anon key (ปรับให้เข้มงวดขึ้นในภายหลัง)
CREATE POLICY "Allow all access" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.mold_master FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.pm_categories FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.pm_checklist_templates FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.pm_checklist_records FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.pm_records FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.parts_master FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.issues_reports FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.waste_reports FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.knowledge_base FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.external_links FOR ALL USING (true);
