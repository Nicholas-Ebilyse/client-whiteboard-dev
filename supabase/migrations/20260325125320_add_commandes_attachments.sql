-- Add attachments array to commandes table
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}';

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('commandes_files', 'commandes_files', false) 
ON CONFLICT (id) DO NOTHING;

-- RLS for storage.objects
CREATE POLICY "Give users select access to commandes_files" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'commandes_files');

CREATE POLICY "Give users insert access to commandes_files" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'commandes_files');

CREATE POLICY "Give users update access to commandes_files" 
ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id = 'commandes_files');

CREATE POLICY "Give users delete access to commandes_files" 
ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'commandes_files');
