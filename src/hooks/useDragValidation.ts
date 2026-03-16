import { useCallback } from 'react';
import { useMaxAssignmentsPerPeriod } from '@/hooks/useAppSettings';

export interface DragData {
  assignment: {
    id: string;
    teamId: string;
    startDate: string;
    endDate: string;
    assignment_group_id?: string;
    isConfirmed?: boolean;
    isAbsent?: boolean;
    [key: string]: unknown;
  };
  sourceDate: string;
  sourceTeamId: string;
}

export interface DropTarget {
  teamId: string;
  date: string;
  isValid: boolean;
}

export interface PreviewCell {
  teamId: string;
  date: string;
}

export const useDragValidation = (
  assignments: any[],
  absences: any[] = [],
  teamTechnicianMap?: Record<string, string[]> // teamId → technician_id[]
) => {
  const { maxAssignments: MAX } = useMaxAssignmentsPerPeriod();

  /** Count non-excluded assignments on a given team+date */
  const countAssignmentsInCell = useCallback((
    targetTeamId: string,
    targetDate: string,
    excludeAssignmentIds: string[]
  ): number => {
    return assignments.filter(a => {
      if (excludeAssignmentIds.includes(a.id)) return false;
      if (a.team_id !== targetTeamId && a.technician_id !== targetTeamId) return false;
      return targetDate >= a.start_date && targetDate <= a.end_date;
    }).length;
  }, [assignments]);

  /** True if any technician in the team is absent on targetDate */
  const isTeamUnavailable = useCallback((
    targetTeamId: string,
    targetDate: string
  ): boolean => {
    if (!teamTechnicianMap) return false;
    const techIds = teamTechnicianMap[targetTeamId] || [];
    return techIds.some(techId =>
      absences.some(a =>
        a.technician_id === techId &&
        targetDate >= a.start_date &&
        targetDate <= a.end_date
      )
    );
  }, [absences, teamTechnicianMap]);

  const validateDrop = useCallback((
    dragData: DragData,
    targetTeamId: string,
    targetDate: string
  ): { isValid: boolean; reason?: string } => {
    // Cannot drop on an unavailable team day
    if (isTeamUnavailable(targetTeamId, targetDate)) {
      return { isValid: false, reason: 'Un technicien de cette équipe est absent ce jour.' };
    }

    // Gather assignments in the group (or just the dragged one)
    const groupId = dragData.assignment.assignment_group_id;
    const excludeIds = groupId
      ? assignments.filter(a => a.assignment_group_id === groupId).map(a => a.id)
      : [dragData.assignment.id];

    // Count available slots
    const duration = Math.round(
      (new Date(dragData.assignment.endDate).getTime() - new Date(dragData.assignment.startDate).getTime())
      / (1000 * 60 * 60 * 24)
    );
    const daysToCheck = Array.from({ length: duration + 1 }, (_, i) => {
      const d = new Date(targetDate);
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    for (const day of daysToCheck) {
      const count = countAssignmentsInCell(targetTeamId, day, excludeIds);
      if (count >= MAX) {
        return { isValid: false, reason: `Capacité maximale atteinte pour le ${day}.` };
      }
    }

    return { isValid: true };
  }, [assignments, countAssignmentsInCell, isTeamUnavailable, MAX]);

  return { validateDrop, isTeamUnavailable, countAssignmentsInCell };
};
