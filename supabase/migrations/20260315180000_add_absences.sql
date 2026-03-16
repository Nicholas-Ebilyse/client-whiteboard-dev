-- Migration: Add absences table and RLS policies

CREATE TABLE IF NOT EXISTS public.absences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT valid_date_range CHECK (start_date <= end_date)
);

-- Enable Row Level Security
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Enable read access for all users" ON public.absences
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.absences
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only" ON public.absences
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users only" ON public.absences
    FOR DELETE
    TO authenticated
    USING (true);

-- Create an index to improve date filtering performance
CREATE INDEX IF NOT EXISTS absences_technician_date_idx ON public.absences(technician_id, start_date, end_date);
