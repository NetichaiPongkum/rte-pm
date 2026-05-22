-- ==========================================
-- INSPECTION MODULE TABLES
-- ==========================================

-- INSPECTION CATEGORIES
CREATE TABLE IF NOT EXISTS public.inspection_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INSPECTION TEMPLATES
CREATE TABLE IF NOT EXISTS public.inspection_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name TEXT NOT NULL,
    category_id UUID REFERENCES public.inspection_categories(id),
    pm_level INTEGER DEFAULT 1,
    items JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INSPECTION RECORDS
CREATE TABLE IF NOT EXISTS public.inspection_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.inspection_templates(id),
    template_name TEXT,
    category_name TEXT,
    pm_level INTEGER,
    mold_code TEXT NOT NULL,
    vendor TEXT,
    performed_by TEXT,
    performed_date DATE,
    checklist_data JSONB DEFAULT '[]',
    notes TEXT,
    status TEXT DEFAULT 'completed',
    pass_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    na_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- REALTIME & RLS
-- ==========================================

ALTER TABLE public.inspection_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_records ENABLE ROW LEVEL SECURITY;

-- Allow all access for now (consistent with existing policies)
CREATE POLICY "Allow all access" ON public.inspection_categories FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.inspection_templates FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.inspection_records FOR ALL USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.inspection_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inspection_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inspection_records;
