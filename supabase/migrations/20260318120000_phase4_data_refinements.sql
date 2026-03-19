-- Migration for Phase 4.1: Data Refinements
-- Date: 2026-03-18

-- 1. Add short_id to technicians
-- Using GENERATED ALWAYS AS IDENTITY to auto-increment
ALTER TABLE public.technicians
ADD COLUMN short_id INTEGER GENERATED ALWAYS AS IDENTITY;

-- 2. Create absence_motives table
CREATE TABLE public.absence_motives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.absence_motives ENABLE ROW LEVEL SECURITY;

-- Policies for absence_motives
CREATE POLICY "Enable read access for all users" ON public.absence_motives
    FOR SELECT USING (true);

-- Insert default motives
INSERT INTO public.absence_motives (name) VALUES
    ('Maladie'),
    ('Congés Payés'),
    ('Formation'),
    ('Absence Injustifiée'),
    ('RTT'),
    ('Maternité / Paternité'),
    ('Accident du Travail'),
    ('Récupération'),
    ('Déplacement'),
    ('Autre');
