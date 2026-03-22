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
  teamId: string; // The team this assignment belongs to

  commandeId: string | null;
  name: string;
  startDate: string; // 'yyyy-MM-dd'
  endDate: string;   // 'yyyy-MM-dd'
  isFixed: boolean;
  comment?: string | null;
  isValid: boolean; // Frontend only
  isConfirmed?: boolean;

  assignment_group_id?: string | null;
}

// ─── Note ────────────────────────────────────────────────────────────────────
export interface Note {
  id: string;
  text: string;
  technicianId?: string | null;
  date: string;
  endDate?: string | null;

  isSav?: boolean;

}

