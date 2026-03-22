-- Add display_name to commandes if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'commandes' AND COLUMN_NAME = 'display_name') THEN
        ALTER TABLE commandes ADD COLUMN display_name TEXT;
    END IF;
END $$;

-- Backfill display_name from assignments table
-- We take the most common name for each commande_id
WITH name_frequency AS (
    SELECT 
        commande_id, 
        name,
        ROW_NUMBER() OVER(PARTITION BY commande_id ORDER BY COUNT(*) DESC) as rank
    FROM assignments
    WHERE commande_id IS NOT NULL AND name IS NOT NULL AND name != ''
    GROUP BY commande_id, name
)
UPDATE commandes c
SET display_name = nf.name
FROM name_frequency nf
WHERE c.id = nf.commande_id AND nf.rank = 1 AND (c.display_name IS NULL OR c.display_name = '');

-- For any remaining NULL display_names, use a default short name logic (fallback)
-- Note: PostgreSQL regex is different, but for backfill we'll just use a simple split or ignore
-- and let the frontend/sync handle it.
