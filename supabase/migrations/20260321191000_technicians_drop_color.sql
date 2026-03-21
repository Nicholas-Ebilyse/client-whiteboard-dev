-- Migration: Drop unused color field from technicians table

ALTER TABLE technicians
  DROP COLUMN IF EXISTS color;
