-- 1. Drop unused columns from commandes table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='commandes' AND column_name='date') THEN
        ALTER TABLE public.commandes DROP COLUMN date;
    END IF;
    -- These should have been dropped by the previous migration, but ensuring they are gone
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='commandes' AND column_name='montant_ht') THEN
        ALTER TABLE public.commandes DROP COLUMN montant_ht;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='commandes' AND column_name='achats') THEN
        ALTER TABLE public.commandes DROP COLUMN achats;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='commandes' AND column_name='facture') THEN
        ALTER TABLE public.commandes DROP COLUMN facture;
    END IF;
END $$;

-- 2. Remove duplicates from assignments table
-- We identify duplicates by technician, project/commande, and dates
DELETE FROM public.assignments a
USING (
    SELECT 
        MIN(id) as keep_id, 
        technician_id, 
        commande_id, 
        start_date, 
        end_date, 
        start_period, 
        end_period, 
        is_absent
    FROM public.assignments
    GROUP BY 
        technician_id, 
        commande_id, 
        start_date, 
        end_date, 
        start_period, 
        end_period, 
        is_absent
    HAVING COUNT(*) > 1
) b
WHERE a.technician_id = b.technician_id
  AND (a.commande_id = b.commande_id OR (a.commande_id IS NULL AND b.commande_id IS NULL))
  AND a.start_date = b.start_date
  AND a.end_date = b.end_date
  AND a.start_period = b.start_period
  AND a.end_period = b.end_period
  AND a.is_absent = b.is_absent
  AND a.id > b.keep_id;

-- 3. Remove duplicates from notes table
-- We identify duplicates by technician, date, and text
DELETE FROM public.notes n
USING (
    SELECT 
        MIN(id) as keep_id, 
        technician_id, 
        start_date, 
        text
    FROM public.notes
    GROUP BY 
        technician_id, 
        start_date, 
        text
    HAVING COUNT(*) > 1
) b
WHERE (n.technician_id = b.technician_id OR (n.technician_id IS NULL AND b.technician_id IS NULL))
  AND n.start_date = b.start_date
  AND n.text = b.text
  AND n.id > b.keep_id;
