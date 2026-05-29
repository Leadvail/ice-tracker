-- RLS Security Policy Fix for ICE Master Tables
-- Drops existing policies and recreates them with full CRUD access for authenticated users

-- 1. exercise_templates
DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.exercise_templates;
CREATE POLICY "Allow authenticated users full access" 
ON public.exercise_templates 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 2. timeline_nodes
DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.timeline_nodes;
CREATE POLICY "Allow authenticated users full access" 
ON public.timeline_nodes 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. exercise_sessions
DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.exercise_sessions;
CREATE POLICY "Allow authenticated users full access" 
ON public.exercise_sessions 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 4. audit_logs
DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.audit_logs;
CREATE POLICY "Allow authenticated users full access" 
ON public.audit_logs 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
