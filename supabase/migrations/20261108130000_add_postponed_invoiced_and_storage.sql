-- Migration: Add postponed and invoiced flags, assignment attachments, and attachments storage bucket

-- 1. Add columns to public.assignments
ALTER TABLE public.assignments 
  ADD COLUMN IF NOT EXISTS attachments text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_postponed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_invoiced boolean NOT NULL DEFAULT false;

-- 2. Add columns to public.commandes
ALTER TABLE public.commandes 
  ADD COLUMN IF NOT EXISTS is_postponed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_invoiced boolean NOT NULL DEFAULT false;

-- 3. Create and configure storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies for attachments bucket
DROP POLICY IF EXISTS "Public select on attachments" ON storage.objects;
CREATE POLICY "Public select on attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "Authenticated users can insert attachments" ON storage.objects;
CREATE POLICY "Authenticated users can insert attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "Authenticated users can update attachments" ON storage.objects;
CREATE POLICY "Authenticated users can update attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "Authenticated users can delete attachments" ON storage.objects;
CREATE POLICY "Authenticated users can delete attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'attachments');

-- Also ensure public read on commandes_files fallback bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('commandes_files', 'commandes_files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public select on commandes_files" ON storage.objects;
CREATE POLICY "Public select on commandes_files"
ON storage.objects FOR SELECT
USING (bucket_id = 'commandes_files');

DROP POLICY IF EXISTS "Authenticated users can insert commandes_files" ON storage.objects;
CREATE POLICY "Authenticated users can insert commandes_files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'commandes_files');

-- 4. Performance indexes for postponed and invoiced queries
CREATE INDEX IF NOT EXISTS idx_assignments_postponed ON public.assignments(is_postponed) WHERE is_postponed = true;
CREATE INDEX IF NOT EXISTS idx_assignments_invoiced ON public.assignments(is_invoiced) WHERE is_invoiced = true;
