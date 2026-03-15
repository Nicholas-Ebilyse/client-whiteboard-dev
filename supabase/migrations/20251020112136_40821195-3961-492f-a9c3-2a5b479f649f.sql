-- Add is_temp column to technicians table
ALTER TABLE public.technicians 
ADD COLUMN is_temp boolean NOT NULL DEFAULT false;