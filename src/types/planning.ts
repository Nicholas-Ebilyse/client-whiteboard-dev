// ─── Teams (new top-level concept — rows on the whiteboard) ─────────────────
export interface Team {
  id: string;
  name: string;
  color: string;
  position: number;
}

// ─── Technician (member of a team) ──────────────────────────────────────────
export interface Technician {
  id: string;
  name: string;
  is_temp: boolean;
  color: string;
  position: number;
  team_id?: string | null;
  skills?: string | null;
}

// ─── Chantier (job site / project tag) ──────────────────────────────────────
export interface Chantier {
  id: string;
  name: string;
  color: string;
  address?: string | null;
  attachments?: string[] | null;
}

// ─── Assignment ──────────────────────────────────────────────────────────────
export interface Assignment {
  id: string;
  teamId: string; // The team row this assignment belongs to
  technicianId?: string | null; // The individual technician within the team
  chantierId: string | null;
  commandeId: string | null;
  name: string;
  startDate: string; // 'yyyy-MM-dd'
  endDate: string;   // 'yyyy-MM-dd'
  isFixed: boolean;
  comment?: string | null;
  isValid: boolean; // Frontend only
  isAbsent?: boolean;
  isConfirmed?: boolean;
  is_billed?: boolean; // Facturé
  assignment_group_id?: string | null;
  absence_reason?: string | null;
}

// ─── Note ────────────────────────────────────────────────────────────────────
export interface Note {
  id: string;
  text: string;
  technicianId?: string | null;
  date: string;
  endDate?: string | null;
  chantierId?: string | null;
  isConfirmed?: boolean;
  isSav?: boolean;
  is_invoiced?: boolean; // Facturé
}

// ─── Misc ────────────────────────────────────────────────────────────────────
export interface ProjectMargin {
  name: string;
  amount: string;
}
