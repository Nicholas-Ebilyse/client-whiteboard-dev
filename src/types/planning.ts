// ─── Teams (new top-level concept — rows on the whiteboard) ─────────────────
export interface Team {
  id: string;
  name: string;
  color: string;
  position: number;
}

// ─── Technician (member of a team) ──────────────────────────────────────────
export interface Employee {
  id: string;
  firstName: string;
  isTemp: boolean;
  teamId?: string;
  comment?: string;
}

// ─── Chantier (job site / project tag) ──────────────────────────────────────
export interface Chantier {
  id: string;
  name: string;
  color: string;
  address?: string;
  attachments?: string[] | null;
}

// ─── Assignment ──────────────────────────────────────────────────────────────
// Assignments are now full-day or multi-day. Periods (Matin/Après-midi) are gone.
export interface Assignment {
  id: string;
  /** The team row this assignment belongs to (replaces old technician_id logic) */
  teamId: string;
  /** The individual technician within the team (still stored on DB row) */
  technicianId?: string;
  chantierId: string | null;
  commandeId: string | null;
  name: string;
  startDate: string; // 'yyyy-MM-dd'
  endDate: string;   // 'yyyy-MM-dd'
  isFixed: boolean;
  comment?: string;
  isValid: boolean;
  isAbsent?: boolean;
  isConfirmed?: boolean;
  assignment_group_id?: string;
  absence_reason?: string;
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
}

// ─── Misc ────────────────────────────────────────────────────────────────────
export interface ProjectMargin {
  name: string;
  amount: string;
}
