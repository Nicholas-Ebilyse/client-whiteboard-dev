-- Migration: Add true integer sequential short_id to technicians table

ALTER TABLE public.technicians DROP COLUMN IF EXISTS short_id CASCADE;
ALTER TABLE public.technicians ADD COLUMN short_id SERIAL;

-- Update the TypeScript types interface in frontend
-- (This DB migration guarantees that short_id will automatically increment 1, 2, 3...)
