-- Migration: Drop 'is_confirmed' from 'notes'

ALTER TABLE public.notes DROP COLUMN IF EXISTS is_confirmed;
