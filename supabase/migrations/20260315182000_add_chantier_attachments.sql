-- Add attachments column to invoices table
ALTER TABLE public.invoices
ADD COLUMN attachments TEXT[] DEFAULT '{}';

-- Create storage bucket for chantier files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chantier_files', 'chantier_files', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for chantier_files bucket
CREATE POLICY "Public Access" 
  ON storage.objects FOR SELECT 
  USING ( bucket_id = 'chantier_files' );

CREATE POLICY "Auth Insert" 
  ON storage.objects FOR INSERT 
  TO authenticated 
  WITH CHECK ( bucket_id = 'chantier_files' );

CREATE POLICY "Auth Update" 
  ON storage.objects FOR UPDATE 
  TO authenticated 
  USING ( bucket_id = 'chantier_files' );

CREATE POLICY "Auth Delete" 
  ON storage.objects FOR DELETE 
  TO authenticated 
  USING ( bucket_id = 'chantier_files' );
