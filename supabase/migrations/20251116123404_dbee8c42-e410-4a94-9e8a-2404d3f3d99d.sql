-- Issue #3: Add address field to commandes table
ALTER TABLE public.commandes ADD COLUMN address TEXT;

-- Issue #1 & #6: Fix Johan's position to be 4 (currently 5)
UPDATE public.technicians SET position = 4 WHERE name = 'Johan';

-- Add some dummy addresses to commandes for testing
UPDATE public.commandes SET address = '15 Rue des Granges, 25000 Besançon' WHERE client = 'BLANC IMMOBILIER';
UPDATE public.commandes SET address = '8 Avenue de Chardonnet, 25000 Besançon' WHERE client = 'SIMON IMMOBILIER';
UPDATE public.commandes SET address = '22 Rue de Dole, 25000 Besançon' WHERE client = 'RESEAU DAVID';