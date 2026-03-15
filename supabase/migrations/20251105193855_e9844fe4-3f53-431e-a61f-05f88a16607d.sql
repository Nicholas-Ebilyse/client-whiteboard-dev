-- Add commande_id to assignments table and make chantier_id nullable
ALTER TABLE assignments
ADD COLUMN commande_id uuid REFERENCES commandes(id);

-- Make chantier_id nullable since we're now using commande_id
ALTER TABLE assignments
ALTER COLUMN chantier_id DROP NOT NULL;