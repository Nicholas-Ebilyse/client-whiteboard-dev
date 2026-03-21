-- Migration: add write RLS policies for absence_motives so admins and the sync function can manage motives
-- Date: 2026-03-21

-- Allow admins (user_roles table) to insert new motives
CREATE POLICY "Admins can insert absence_motives"
  ON public.absence_motives
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to update motives
CREATE POLICY "Admins can update absence_motives"
  ON public.absence_motives
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to delete motives
CREATE POLICY "Admins can delete absence_motives"
  ON public.absence_motives
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
