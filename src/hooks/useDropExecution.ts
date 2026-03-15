import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DragData, periodToNum, numToPeriod } from './useDragValidation';

export interface UndoState {
  assignments: Array<{
    id: string;
    technician_id: string;
    start_date: string;
    end_date: string;
    start_period: string;
    end_period: string;
  }>;
}

export const useDropExecution = (
  assignments: any[],
  calculateNewPositions: (dragData: DragData, targetDate: string, targetPeriod: string, targetTechnicianId: string) => any[]
) => {
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const queryClient = useQueryClient();

  const handleUndo = useCallback(async () => {
    if (!undoState || isUndoing) return;

    setIsUndoing(true);
    try {
      for (const assignment of undoState.assignments) {
        const { error } = await supabase
          .from('assignments')
          .update({
            technician_id: assignment.technician_id,
            start_date: assignment.start_date,
            end_date: assignment.end_date,
            start_period: assignment.start_period,
            end_period: assignment.end_period,
          })
          .eq('id', assignment.id);

        if (error) throw error;
      }

      toast.success('Déplacement annulé');
      setUndoState(null);
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    } catch (error) {
      console.error('Undo error:', error);
      toast.error('Erreur lors de l\'annulation');
    } finally {
      setIsUndoing(false);
    }
  }, [undoState, isUndoing, queryClient]);

  const executeDrop = useCallback(async (
    dragData: DragData,
    targetTechnicianId: string,
    targetDate: string,
    targetPeriod: string,
    isCopy: boolean
  ) => {
    console.log('[DROP] executeDrop called', {
      isCopy,
      targetTechnicianId,
      targetDate,
      targetPeriod,
      sourceAssignmentId: dragData.assignment.id,
      sourceTechnicianId: dragData.sourceTechnicianId,
    });
    
    try {
      const newPositions = calculateNewPositions(dragData, targetDate, targetPeriod, targetTechnicianId);
      console.log('[DROP] newPositions calculated', { count: newPositions.length });

      if (isCopy) {
        console.log('[DROP] Executing COPY mode');
        const newGroupId = crypto.randomUUID();
        
        for (const pos of newPositions) {
          const original = pos.originalAssignment;
          const { error } = await supabase
            .from('assignments')
            .insert({
              name: original.name,
              technician_id: targetTechnicianId,
              start_date: pos.newStartDate.toISOString().split('T')[0],
              end_date: pos.newEndDate.toISOString().split('T')[0],
              start_period: pos.newStartPeriod,
              end_period: pos.newEndPeriod,
              commande_id: original.commande_id,
              chantier_id: original.chantier_id,
              comment: original.comment,
              is_absent: original.is_absent,
              absence_reason: original.absence_reason,
              is_confirmed: false,
              is_fixed: original.is_fixed,
              assignment_group_id: newPositions.length > 1 ? newGroupId : null,
            });

          if (error) throw error;
        }

        toast.success(newPositions.length > 1 
          ? `Groupe de ${newPositions.length} affectation(s) copié`
          : 'Affectation copiée'
        );
      } else {
        const groupId = dragData.assignment.assignment_group_id;
        const assignmentsToSave = groupId 
          ? assignments.filter(a => a.assignment_group_id === groupId)
          : assignments.filter(a => a.id === dragData.assignment.id);

        setUndoState({
          assignments: assignmentsToSave.map(a => ({
            id: a.id,
            technician_id: a.technician_id,
            start_date: a.start_date,
            end_date: a.end_date,
            start_period: a.start_period,
            end_period: a.end_period,
          })),
        });

        for (const pos of newPositions) {
          const { error } = await supabase
            .from('assignments')
            .update({
              technician_id: targetTechnicianId,
              start_date: pos.newStartDate.toISOString().split('T')[0],
              end_date: pos.newEndDate.toISOString().split('T')[0],
              start_period: pos.newStartPeriod,
              end_period: pos.newEndPeriod,
            })
            .eq('id', pos.id);

          if (error) throw error;
        }

        toast.success(newPositions.length > 1 
          ? `Groupe de ${newPositions.length} affectation(s) déplacé`
          : 'Affectation déplacée'
        );
      }

      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    } catch (error) {
      console.error('Drop error:', error);
      toast.error('Erreur lors du déplacement');
    }
  }, [calculateNewPositions, queryClient, assignments]);

  const executeConfirmLinkedDropSingle = useCallback(async (
    dragData: DragData,
    targetTechnicianId: string,
    targetDate: string,
    targetPeriod: string
  ) => {
    try {
      const assignment = dragData.assignment;
      const sourceDateObj = new Date(dragData.sourceDate);
      const targetDateObj = new Date(targetDate);
      const dayOffset = Math.round((targetDateObj.getTime() - sourceDateObj.getTime()) / (1000 * 60 * 60 * 24));
      const periodOffset = periodToNum(targetPeriod) - periodToNum(dragData.sourcePeriod);
      
      const newStartDate = new Date(assignment.startDate || (assignment as any).start_date);
      newStartDate.setDate(newStartDate.getDate() + dayOffset);
      
      const newEndDate = new Date(assignment.endDate || (assignment as any).end_date);
      newEndDate.setDate(newEndDate.getDate() + dayOffset);
      
      let newStartPeriodNum = periodToNum(assignment.startPeriod || (assignment as any).start_period) + periodOffset;
      let newEndPeriodNum = periodToNum(assignment.endPeriod || (assignment as any).end_period) + periodOffset;
      
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
      
      setUndoState({
        assignments: [{
          id: assignment.id,
          technician_id: dragData.sourceTechnicianId,
          start_date: assignment.startDate || (assignment as any).start_date,
          end_date: assignment.endDate || (assignment as any).end_date,
          start_period: assignment.startPeriod || (assignment as any).start_period,
          end_period: assignment.endPeriod || (assignment as any).end_period,
        }],
      });
      
      const groupId = assignment.assignment_group_id;
      
      const { error } = await supabase
        .from('assignments')
        .update({
          technician_id: targetTechnicianId,
          start_date: newStartDate.toISOString().split('T')[0],
          end_date: newEndDate.toISOString().split('T')[0],
          start_period: numToPeriod(newStartPeriodNum),
          end_period: numToPeriod(newEndPeriodNum),
          assignment_group_id: null,
        })
        .eq('id', assignment.id);
      
      if (error) throw error;
      
      if (groupId) {
        const remainingInGroup = assignments.filter(
          a => a.assignment_group_id === groupId && a.id !== assignment.id
        );
        if (remainingInGroup.length === 1) {
          await supabase
            .from('assignments')
            .update({ assignment_group_id: null })
            .eq('id', remainingInGroup[0].id);
        }
      }
      
      toast.success('Affectation déplacée (détachée du groupe)');
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    } catch (error) {
      console.error('Single linked drop error:', error);
      toast.error('Erreur lors du déplacement');
    }
  }, [assignments, queryClient]);

  const executeConfirmLinkedDropAll = useCallback(async (
    dragData: DragData,
    targetDate: string,
    targetPeriod: string,
    executeLinkedSingleCallback: () => Promise<void>
  ) => {
    const groupId = dragData.assignment.assignment_group_id;
    
    if (!groupId) {
      await executeLinkedSingleCallback();
      return;
    }

    try {
      const newPositions = calculateNewPositions(dragData, targetDate, targetPeriod, dragData.sourceTechnicianId);
      const groupAssignments = assignments.filter(a => a.assignment_group_id === groupId);
      
      setUndoState({
        assignments: groupAssignments.map(a => ({
          id: a.id,
          technician_id: a.technician_id,
          start_date: a.start_date,
          end_date: a.end_date,
          start_period: a.start_period,
          end_period: a.end_period,
        })),
      });

      const draggedPos = newPositions[0];
      if (!draggedPos) {
        throw new Error('Could not calculate new position');
      }

      for (const assignment of groupAssignments) {
        const { error } = await supabase
          .from('assignments')
          .update({
            start_date: draggedPos.newStartDate.toISOString().split('T')[0],
            end_date: draggedPos.newEndDate.toISOString().split('T')[0],
            start_period: draggedPos.newStartPeriod,
            end_period: draggedPos.newEndPeriod,
          })
          .eq('id', assignment.id);

        if (error) throw error;
      }

      toast.success(`${groupAssignments.length} affectation(s) liée(s) déplacée(s)`);
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    } catch (error) {
      console.error('Linked drop error:', error);
      toast.error('Erreur lors du déplacement des affectations liées');
    }
  }, [calculateNewPositions, assignments, queryClient]);

  return {
    undoState,
    setUndoState,
    isUndoing,
    handleUndo,
    executeDrop,
    executeConfirmLinkedDropSingle,
    executeConfirmLinkedDropAll
  };
};
