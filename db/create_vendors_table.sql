-- ==========================================
-- CREATE VENDORS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendors;

-- Enable RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Allow all access policy
CREATE POLICY "Allow all access" ON public.vendors FOR ALL USING (true);

-- Insert default vendors
INSERT INTO public.vendors (name) VALUES 
('SPP'),
('RMC'),
('RTE')
ON CONFLICT (name) DO NOTHING;
