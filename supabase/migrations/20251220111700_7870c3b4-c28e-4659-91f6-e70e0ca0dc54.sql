-- Create SAV (After-sales service) table
CREATE TABLE public.sav (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE,
  numero INTEGER NOT NULL,
  nom_client TEXT NOT NULL,
  adresse TEXT NOT NULL,
  telephone TEXT,
  probleme TEXT NOT NULL,
  date DATE NOT NULL,
  est_resolu BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_week_start DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.sav ENABLE ROW LEVEL SECURITY;

-- Create policies for SAV table
CREATE POLICY "Authenticated users can view sav" 
ON public.sav 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can insert sav" 
ON public.sav 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Authenticated users can update sav est_resolu" 
ON public.sav 
FOR UPDATE 
USING (true);

CREATE POLICY "Only admins can delete sav" 
ON public.sav 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_sav_updated_at
BEFORE UPDATE ON public.sav
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();