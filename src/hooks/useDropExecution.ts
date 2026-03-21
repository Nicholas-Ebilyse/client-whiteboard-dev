import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DragData } from './useDragValidation';

export interface UndoState {
  type?: 'move' | 'copy';
  copiedIds?: string[];
  assignments?: Array<{
    id: string;
    team_id: string | null;
    start_date: string;
    end_date: string;
  }>;
}

export const useDropExecution = (
  assignments: any[],
  calculateNewDates: (dragData: DragData, targetDate: string, targetTeamId: string) => any[]
) => {
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const queryClient = useQueryClient();

  const handleUndo = useCallback(async () => {
    if (!undoState || isUndoing) return;
    setIsUndoing(true);
    try {
      if (undoState.type === 'copy' && undoState.copiedIds) {
        // Undo a copy by deleting the newly created assignments
        for (const newId of undoState.copiedIds) {
          const { error } = await supabase
            .from('assignments')
            .delete()
            .eq('id', newId);
          if (error) throw error;
        }
      } else if (undoState.assignments) {
        // Undo a move by restoring original positions
        for (const a of undoState.assignments) {
          const { error } = await supabase
            .from('assignments')
            .update({
              team_id: a.team_id,
              start_date: a.start_date,
              end_date: a.end_date,
            })
            .eq('id', a.id);
          if (error) throw error;
        }
      }
      toast.success('Déplacement annulé');
      setUndoState(null);
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    } catch (error) {
      console.error('Undo error:', error);
      toast.error("Erreur lors de l'annulation");
    } finally {
      setIsUndoing(false);
    }
  }, [undoState, isUndoing, queryClient]);

  const executeDrop = useCallback(async (
    dragData: DragData,
    targetTeamId: string,
    targetDate: string,
    isCopy: boolean
  ) => {
    try {
      const newPositions = calculateNewDates(dragData, targetDate, targetTeamId);

      if (isCopy) {
        const newGroupId = crypto.randomUUID();
        const createdIds: string[] = [];
        
        for (const pos of newPositions) {
          const original = pos.originalAssignment;
          const { data, error } = await supabase
            .from('assignments')
            .insert({
              name: original.name,
              team_id: targetTeamId,
              start_date: pos.newStartDate.toISOString().split('T')[0],
              end_date: pos.newEndDate.toISOString().split('T')[0],
              commande_id: original.commande_id,

              comment: original.comment,
              is_absent: original.is_absent,
              absence_reason: original.absence_reason,
              is_confirmed: false,
              is_fixed: original.is_fixed,
              assignment_group_id: newPositions.length > 1 ? newGroupId : null,
            })
            .select('id')
            .single();
            
          if (error) throw error;
          if (data) createdIds.push(data.id);
        }
        
        setUndoState({
          type: 'copy',
          copiedIds: createdIds,
        });
        
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
          type: 'move',
          assignments: assignmentsToSave.map(a => ({
            id: a.id,
            team_id: a.team_id ?? null,
            start_date: a.start_date,
            end_date: a.end_date,
          })),
        });

        for (const pos of newPositions) {
          const { error } = await supabase
            .from('assignments')
            .update({
              team_id: targetTeamId,
              start_date: pos.newStartDate.toISOString().split('T')[0],
              end_date: pos.newEndDate.toISOString().split('T')[0],
            })
            .eq('id', pos.id);
          if (error) throw error;
        }
        toast.success(newPositions.length > 1
          ? `Groupe de ${newPositions.length} affectation(s) déplacé`
          : 'Affectation assignée à l\'équipe'
        );
      }

      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    } catch (error) {
      console.error('Drop error:', error);
      toast.error('Erreur lors du déplacement');
    }
  }, [calculateNewDates, queryClient, assignments]);

  /** Move just the dragged assignment out of its group */
  const executeConfirmLinkedDropSingle = useCallback(async (
    dragData: DragData,
    targetTeamId: string,
    targetDate: string
  ) => {
    try {
      const assignment = dragData.assignment;
      const sourceDateObj = new Date(dragData.sourceDate);
      const targetDateObj = new Date(targetDate);
      const dayOffset = Math.round(
        (targetDateObj.getTime() - sourceDateObj.getTime()) / (1000 * 60 * 60 * 24)
      );

      const newStartDate = new Date(assignment.startDate);
      newStartDate.setDate(newStartDate.getDate() + dayOffset);

      const newEndDate = new Date(assignment.endDate);
      newEndDate.setDate(newEndDate.getDate() + dayOffset);

      setUndoState({
        type: 'move',
        assignments: [{
          id: assignment.id,
          team_id: dragData.sourceTeamId,
          start_date: assignment.startDate,
          end_date: assignment.endDate,
        }],
      });

      const groupId = assignment.assignment_group_id;
      const { error } = await supabase
        .from('assignments')
        .update({
          team_id: targetTeamId,
          start_date: newStartDate.toISOString().split('T')[0],
          end_date: newEndDate.toISOString().split('T')[0],
          assignment_group_id: null,
        })
        .eq('id', assignment.id);
      if (error) throw error;

      if (groupId) {
        const remaining = assignments.filter(
          a => a.assignment_group_id === groupId && a.id !== assignment.id
        );
        if (remaining.length === 1) {
          await supabase.from('assignments').update({ assignment_group_id: null }).eq('id', remaining[0].id);
        }
      }

      toast.success('Affectation déplacée (détachée du groupe)');
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    } catch (error) {
      console.error('Single linked drop error:', error);
      toast.error('Erreur lors du déplacement');
    }
  }, [assignments, queryClient]);

  /** Move the entire group together */
  const executeConfirmLinkedDropAll = useCallback(async (
    dragData: DragData,
    targetDate: string,
    executeLinkedSingleCallback: () => Promise<void>
  ) => {
    const groupId = dragData.assignment.assignment_group_id;
    if (!groupId) {
      await executeLinkedSingleCallback();
      return;
    }

    try {
      const newPositions = calculateNewDates(dragData, targetDate, dragData.sourceTeamId);
      const groupAssignments = assignments.filter(a => a.assignment_group_id === groupId);

      setUndoState({
        type: 'move',
        assignments: groupAssignments.map(a => ({
          id: a.id,
          team_id: a.team_id ?? null,
          start_date: a.start_date,
          end_date: a.end_date,
        })),
      });

      const draggedPos = newPositions[0];
      if (!draggedPos) throw new Error('Could not calculate new position');

      for (const a of groupAssignments) {
        const { error } = await supabase
          .from('assignments')
          .update({
            start_date: draggedPos.newStartDate.toISOString().split('T')[0],
            end_date: draggedPos.newEndDate.toISOString().split('T')[0],
          })
          .eq('id', a.id);
        if (error) throw error;
      }

      toast.success(`${groupAssignments.length} affectation(s) liée(s) déplacée(s)`);
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    } catch (error) {
      console.error('Linked drop error:', error);
      toast.error('Erreur lors du déplacement des affectations liées');
    }
  }, [calculateNewDates, assignments, queryClient]);

  return {
    undoState,
    setUndoState,
    isUndoing,
    handleUndo,
    executeDrop,
    executeConfirmLinkedDropSingle,
    executeConfirmLinkedDropAll,
  };
};
