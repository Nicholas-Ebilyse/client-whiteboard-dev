-- Migration: Insert default teams (Equipe 1 to Equipe 8)

-- Clear assignments and technicians team_id to prevent FK constraint violations when deleting mock teams
UPDATE assignments SET team_id = NULL;
UPDATE technicians SET team_id = NULL;

-- Delete all existing mock teams
DELETE FROM teams;

-- Insert 8 default teams
INSERT INTO teams (id, name, color, position) VALUES
  (gen_random_uuid(), 'Équipe 1', '#3b82f6', 0),
  (gen_random_uuid(), 'Équipe 2', '#10b981', 1),
  (gen_random_uuid(), 'Équipe 3', '#f59e0b', 2),
  (gen_random_uuid(), 'Équipe 4', '#8b5cf6', 3),
  (gen_random_uuid(), 'Équipe 5', '#ec4899', 4),
  (gen_random_uuid(), 'Équipe 6', '#06b6d4', 5),
  (gen_random_uuid(), 'Équipe 7', '#f43f5e', 6),
  (gen_random_uuid(), 'Équipe 8', '#64748b', 7);
