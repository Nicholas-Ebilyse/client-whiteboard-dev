-- Add RLS policies to app_password table for admin-only access
-- This prevents any non-admin user from accessing password hashes

-- Drop any existing policies (safety check)
DROP POLICY IF EXISTS "Only admins can view passwords" ON public.app_password;
DROP POLICY IF EXISTS "Only admins can manage passwords" ON public.app_password;

-- Create admin-only RLS policies
CREATE POLICY "Only admins can view passwords"
ON public.app_password
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can manage passwords"
ON public.app_password
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Add column to track hashing algorithm for migration from SHA-256 to bcrypt
ALTER TABLE public.app_password 
ADD COLUMN IF NOT EXISTS hash_algorithm text NOT NULL DEFAULT 'bcrypt';

-- Mark any existing passwords as SHA-256 (for migration purposes)
UPDATE public.app_password 
SET hash_algorithm = 'sha256' 
WHERE hash_algorithm = 'bcrypt';