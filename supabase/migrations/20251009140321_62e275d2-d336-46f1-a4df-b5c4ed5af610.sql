-- Create technicians table (renamed from teams)
CREATE TABLE public.technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#e0e7ff',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create chantiers table
CREATE TABLE public.chantiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#dbeafe',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create assignments table
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID REFERENCES public.technicians(id) ON DELETE CASCADE NOT NULL,
  chantier_id UUID REFERENCES public.chantiers(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  start_period TEXT NOT NULL CHECK (start_period IN ('Matin', 'Après-midi')),
  end_date DATE NOT NULL,
  end_period TEXT NOT NULL CHECK (end_period IN ('Matin', 'Après-midi')),
  is_fixed BOOLEAN DEFAULT false,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create notes table
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  technician_id UUID REFERENCES public.technicians(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('Matin', 'Après-midi')),
  chantier_id UUID REFERENCES public.chantiers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create week_config table for managing current week display
CREATE TABLE public.week_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chantiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.week_config ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth required for now)
CREATE POLICY "Allow public read on technicians" ON public.technicians FOR SELECT USING (true);
CREATE POLICY "Allow public insert on technicians" ON public.technicians FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on technicians" ON public.technicians FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on technicians" ON public.technicians FOR DELETE USING (true);

CREATE POLICY "Allow public read on chantiers" ON public.chantiers FOR SELECT USING (true);
CREATE POLICY "Allow public insert on chantiers" ON public.chantiers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on chantiers" ON public.chantiers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on chantiers" ON public.chantiers FOR DELETE USING (true);

CREATE POLICY "Allow public read on assignments" ON public.assignments FOR SELECT USING (true);
CREATE POLICY "Allow public insert on assignments" ON public.assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on assignments" ON public.assignments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on assignments" ON public.assignments FOR DELETE USING (true);

CREATE POLICY "Allow public read on notes" ON public.notes FOR SELECT USING (true);
CREATE POLICY "Allow public insert on notes" ON public.notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on notes" ON public.notes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on notes" ON public.notes FOR DELETE USING (true);

CREATE POLICY "Allow public read on week_config" ON public.week_config FOR SELECT USING (true);
CREATE POLICY "Allow public insert on week_config" ON public.week_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on week_config" ON public.week_config FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on week_config" ON public.week_config FOR DELETE USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_technicians_updated_at BEFORE UPDATE ON public.technicians
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chantiers_updated_at BEFORE UPDATE ON public.chantiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_week_config_updated_at BEFORE UPDATE ON public.week_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();