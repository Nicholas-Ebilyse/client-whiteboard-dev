import { useCallback } from 'react';
import { Assignment } from '@/types/planning';
import { useMaxAssignmentsPerPeriod } from '@/hooks/useAppSettings';

export interface DragData {
  assignment: Assignment;
  sourceDate: string;
  sourcePeriod: string;
  sourceTechnicianId: string;
}

export interface DropTarget {
  technicianId: string;
  date: string;
  period: string;
  isValid: boolean;
}

export interface PreviewCell {
  technicianId: string;
  date: string;
  period: string;
}

export const periodToNum = (p: string) => p === 'Matin' ? 0 : 1;
export const numToPeriod = (n: number) => n === 0 ? 'Matin' : 'Après-midi';

export const useDragValidation = (
  assignments: any[],
  weekStart?: string,
  weekEnd?: string
) => {
  const { maxAssignments: MAX_ASSIGNMENTS_PER_PERIOD } = useMaxAssignmentsPerPeriod();

  const countAssignmentsInPeriod = useCallback((
    targetTechnicianId: string,
    targetDate: string,
    targetPeriod: string,
    excludeAssignmentIds: string[]
  ): number => {
    return assignments.filter(a => {
      if (excludeAssignmentIds.includes(a.id)) return false;
      if (a.technician_id !== targetTechnicianId) return false;
      
      const assignmentStart = a.start_date;
      const assignmentEnd = a.end_date;
      
      if (targetDate < assignmentStart || targetDate > assignmentEnd) return false;
      
      if (targetDate === assignmentStart && targetDate === assignmentEnd) {
        const assignmentStartPeriod = periodToNum(a.start_period);
        const assignmentEndPeriod = periodToNum(a.end_period);
        const targetPeriodNum = periodToNum(targetPeriod);
        return targetPeriodNum >= assignmentStartPeriod && targetPeriodNum <= assignmentEndPeriod;
      } else if (targetDate === assignmentStart) {
        return periodToNum(targetPeriod) >= periodToNum(a.start_period);
      } else if (targetDate === assignmentEnd) {
        return periodToNum(targetPeriod) <= periodToNum(a.end_period);
      }
      
      return true;
    }).length;
  }, [assignments]);

  const hasConflict = useCallback((
    targetTechnicianId: string,
    targetDate: string,
    targetPeriod: string,
    excludeAssignmentIds: string[]
  ) => {
    const count = countAssignmentsInPeriod(targetTechnicianId, targetDate, targetPeriod, excludeAssignmentIds);
    return count >= MAX_ASSIGNMENTS_PER_PERIOD;
  }, [countAssignmentsInPeriod, MAX_ASSIGNMENTS_PER_PERIOD]);

  const calculateNewPositions = useCallback((
    dragData: DragData,
    targetDate: string,
    targetPeriod: string,
    targetTechnicianId: string
  ) => {
    const { assignment, sourceDate, sourcePeriod } = dragData;
    
    const sourceDateObj = new Date(sourceDate);
    const targetDateObj = new Date(targetDate);
    const dayOffset = Math.round((targetDateObj.getTime() - sourceDateObj.getTime()) / (1000 * 60 * 60 * 24));
    const periodOffset = periodToNum(targetPeriod) - periodToNum(sourcePeriod);

    const groupId = assignment.assignment_group_id;
    const assignmentsToMove = groupId 
      ? assignments.filter(a => a.assignment_group_id === groupId)
      : [assignment];

    const newPositions: Array<{
      id: string;
      newStartDate: Date;
      newEndDate: Date;
      newStartPeriod: string;
      newEndPeriod: string;
      originalAssignment: any;
    }> = [];

    for (const a of assignmentsToMove) {
      const newStartDate = new Date(a.start_date || a.startDate);
      newStartDate.setDate(newStartDate.getDate() + dayOffset);
      
      const newEndDate = new Date(a.end_date || a.endDate);
      newEndDate.setDate(newEndDate.getDate() + dayOffset);
      
      let newStartPeriodNum = periodToNum(a.start_period || a.startPeriod) + periodOffset;
      let newEndPeriodNum = periodToNum(a.end_period || a.endPeriod) + periodOffset;
      
      if (newStartPeriodNum > 1) {
        newStartPeriodNum = 0;
        newStartDate.setDate(newStartDate.getDate() + 1);
      } else if (newStartPeriodNum < 0) {
        newStartPeriodNum = 1;
        newStartDate.setDate(newStartDate.getDate() - 1);
      }
      
      if (newEndPeriodNum > 1) {
        newEndPeriodNum = 0;
        newEndDate.setDate(newEndDate.getDate() + 1);
      } else if (newEndPeriodNum < 0) {
        newEndPeriodNum = 1;
        newEndDate.setDate(newEndDate.getDate() - 1);
      }

      newPositions.push({
        id: a.id,
        newStartDate,
        newEndDate,
        newStartPeriod: numToPeriod(newStartPeriodNum),
        newEndPeriod: numToPeriod(newEndPeriodNum),
        originalAssignment: a,
      });
    }

    return newPositions;
  }, [assignments]);

  const validateDrop = useCallback((
    dragData: DragData,
    targetTechnicianId: string,
    targetDate: string,
    targetPeriod: string,
    isCopy: boolean = false
  ): { valid: boolean; reason?: string } => {
    const newPositions = calculateNewPositions(dragData, targetDate, targetPeriod, targetTechnicianId);
    const assignmentIds = isCopy ? [] : newPositions.map(p => p.id);

    if (weekStart && weekEnd) {
      const weekStartDate = new Date(weekStart);
      const weekEndDate = new Date(weekEnd);
      
      for (const pos of newPositions) {
        if (pos.newStartDate < weekStartDate || pos.newEndDate > weekEndDate) {
          return { valid: false, reason: 'Déplacement hors de la semaine' };
        }
      }
    }

    for (const pos of newPositions) {
      const startDateStr = pos.newStartDate.toISOString().split('T')[0];
      const endDateStr = pos.newEndDate.toISOString().split('T')[0];
      
      const currentDate = new Date(pos.newStartDate);
      while (currentDate <= pos.newEndDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        let periodsToCheck: string[] = [];
        if (dateStr === startDateStr && dateStr === endDateStr) {
          const start = periodToNum(pos.newStartPeriod);
          const end = periodToNum(pos.newEndPeriod);
          for (let i = start; i <= end; i++) {
            periodsToCheck.push(numToPeriod(i));
          }
        } else if (dateStr === startDateStr) {
          periodsToCheck = periodToNum(pos.newStartPeriod) === 0 ? ['Matin', 'Après-midi'] : ['Après-midi'];
        } else if (dateStr === endDateStr) {
          periodsToCheck = periodToNum(pos.newEndPeriod) === 1 ? ['Matin', 'Après-midi'] : ['Matin'];
        } else {
          periodsToCheck = ['Matin', 'Après-midi'];
        }

        for (const period of periodsToCheck) {
          if (hasConflict(targetTechnicianId, dateStr, period, assignmentIds)) {
            return { valid: false, reason: 'Maximum d\'affectations atteint pour cette période' };
          }
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return { valid: true };
  }, [calculateNewPositions, hasConflict, weekStart, weekEnd]);

  return { calculateNewPositions, validateDrop };
};
