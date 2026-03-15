-- Create commandes table for order tracking
CREATE TABLE public.commandes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id text UNIQUE,
  numero text,
  client text NOT NULL,
  chantier text NOT NULL,
  montant_ht numeric,
  achats numeric,
  date date,
  facture text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commandes ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read on commandes" 
ON public.commandes 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert on commandes" 
ON public.commandes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update on commandes" 
ON public.commandes 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete on commandes" 
ON public.commandes 
FOR DELETE 
USING (true);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_commandes_updated_at
BEFORE UPDATE ON public.commandes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();