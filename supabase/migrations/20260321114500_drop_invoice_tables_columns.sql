-- Drop invoices table and any dependent objects (foreign keys)
DROP TABLE IF EXISTS public.invoices CASCADE;

-- Drop invoice-related columns from other tables if they exist
DO $$
BEGIN
    -- From commandes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='commandes' AND column_name='facture') THEN
        ALTER TABLE public.commandes DROP COLUMN facture;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='commandes' AND column_name='montant_ht') THEN
        ALTER TABLE public.commandes DROP COLUMN montant_ht;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='commandes' AND column_name='achats') THEN
        ALTER TABLE public.commandes DROP COLUMN achats;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='commandes' AND column_name='is_invoiced') THEN
        ALTER TABLE public.commandes DROP COLUMN is_invoiced;
    END IF;

    -- From assignments
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assignments' AND column_name='is_billed') THEN
        ALTER TABLE public.assignments DROP COLUMN is_billed;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assignments' AND column_name='chantier_id') THEN
        ALTER TABLE public.assignments DROP COLUMN chantier_id;
    END IF;

    -- From notes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notes' AND column_name='is_invoiced') THEN
        ALTER TABLE public.notes DROP COLUMN is_invoiced;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notes' AND column_name='is_billed') THEN
        ALTER TABLE public.notes DROP COLUMN is_billed;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notes' AND column_name='chantier_id') THEN
        ALTER TABLE public.notes DROP COLUMN chantier_id;
    END IF;
END $$;
