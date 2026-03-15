export interface Team {
  id: string;
  name: string;
  members: string[];
  color: string;
}

export interface Employee {
  id: string;
  firstName: string;
  isTemp: boolean;
  comment?: string;
}

export interface Chantier {
  id: string;
  name: string;
  color: string;
  address?: string;
}

export interface Assignment {
  id: string;
  teamId: string;
  chantierId: string | null;
  commandeId: string | null;
  name: string;
  startDate: string;
  startPeriod: 'Matin' | 'Après-midi';
  endDate: string;
  endPeriod: 'Matin' | 'Après-midi';
  isFixed: boolean;
  comment?: string;
  isValid: boolean;
  isAbsent?: boolean;
  isConfirmed?: boolean;
  secondTechnicianId?: string;
  assignment_group_id?: string;
  absence_reason?: string;
}

export interface Note {
  id: string;
  text: string;
  teamId: string;
  date: string;
  period: 'Matin' | 'Après-midi';
  chantierId: string;
}

export interface ProjectMargin {
  name: string;
  amount: string;
}
