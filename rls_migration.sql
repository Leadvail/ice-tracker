-- RLS Security Migration for ICE Master Tables
-- 1. Enable Row Level Security on all public tables
ALTER TABLE public.exercise_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Create global access policies for authenticated users
CREATE POLICY "Allow authenticated users full access" 
ON public.exercise_templates 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access" 
ON public.timeline_nodes 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access" 
ON public.exercise_sessions 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access" 
ON public.audit_logs 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
