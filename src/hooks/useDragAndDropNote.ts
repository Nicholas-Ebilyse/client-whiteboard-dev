import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface DraggedNote {
  id: string;
  text: string;
  is_sav: boolean;
  technician_id: string | null;
  start_date: string;
  end_date: string;
  start_period: string;
  end_period: string;
}

interface NoteDropTarget {
  technicianId: string | null;
  date: string;
  period: string;
}

interface NoteUndoState {
  id: string;
  technician_id: string | null;
  start_date: string;
  end_date: string;
  start_period: string;
  end_period: string;
  period: string;
}

export const useDragAndDropNote = () => {
  const [draggedNote, setDraggedNote] = useState<DraggedNote | null>(null);
  const [noteDropTarget, setNoteDropTarget] = useState<NoteDropTarget | null>(null);
  const [isNoteDragging, setIsNoteDragging] = useState(false);
  const [noteUndoState, setNoteUndoState] = useState<NoteUndoState | null>(null);
  const [isNoteUndoing, setIsNoteUndoing] = useState(false);
  const queryClient = useQueryClient();
  
  // Refs for keyboard handler
  const noteUndoStateRef = useRef(noteUndoState);
  const isNoteUndoingRef = useRef(isNoteUndoing);
  const handleNoteUndoRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    noteUndoStateRef.current = noteUndoState;
    isNoteUndoingRef.current = isNoteUndoing;
  }, [noteUndoState, isNoteUndoing]);

  const handleNoteUndo = useCallback(async () => {
    if (!noteUndoState || isNoteUndoing) return;
    
    setIsNoteUndoing(true);
    try {
      const { error } = await supabase
        .from('notes')
        .update({
          technician_id: noteUndoState.technician_id,
          start_date: noteUndoState.start_date,
          end_date: noteUndoState.end_date,
          start_period: noteUndoState.start_period,
          end_period: noteUndoState.end_period,
          period: noteUndoState.period,
        })
        .eq('id', noteUndoState.id);

      if (error) throw error;

      toast.success('Déplacement de note annulé');
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setNoteUndoState(null);
    } catch (error) {
      console.error('Note undo error:', error);
      toast.error("Erreur lors de l'annulation");
    } finally {
      setIsNoteUndoing(false);
    }
  }, [noteUndoState, isNoteUndoing, queryClient]);

  useEffect(() => {
    handleNoteUndoRef.current = handleNoteUndo;
  }, [handleNoteUndo]);

  const handleNoteDragStart = useCallback((
    e: React.DragEvent,
    note: DraggedNote
  ) => {
    setDraggedNote(note);
    setIsNoteDragging(true);
    e.dataTransfer.setData('application/note-json', JSON.stringify(note));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleNoteDragOver = useCallback((
    e: React.DragEvent,
    technicianId: string | null,
    date: string,
    period: string
  ) => {
    // Only handle if we're dragging a note
    if (!e.dataTransfer.types.includes('application/note-json')) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setNoteDropTarget({ technicianId, date, period });
  }, []);

  const handleNoteDragLeave = useCallback(() => {
    setNoteDropTarget(null);
  }, []);

  const handleNoteDrop = useCallback(async (
    e: React.DragEvent,
    targetTechnicianId: string | null,
    targetDate: string,
    targetPeriod: string,
    preserveDuration: boolean = true // If false, note becomes single-period
  ) => {
    e.preventDefault();
    
    const noteData = e.dataTransfer.getData('application/note-json');
    if (!noteData) return;
    
    try {
      const note: DraggedNote = JSON.parse(noteData);
      
      // Save state for undo
      setNoteUndoState({
        id: note.id,
        technician_id: note.technician_id,
        start_date: note.start_date,
        end_date: note.end_date,
        start_period: note.start_period,
        end_period: note.end_period,
        period: note.start_period,
      });
      
      let endDate: string;
      let endPeriod: string;
      
      if (preserveDuration) {
        // Calculate the duration of the note in days and periods
        const originalDuration = calculateNoteDuration(note);
        
        // Calculate new end date and period based on original duration
        const result = calculateNewEndPosition(
          targetDate,
          targetPeriod,
          originalDuration
        );
        endDate = result.endDate;
        endPeriod = result.endPeriod;
      } else {
        // Single period note - same start and end
        endDate = targetDate;
        endPeriod = targetPeriod;
      }
      
      // Update the note in the database
      const { error } = await supabase
        .from('notes')
        .update({
          technician_id: targetTechnicianId,
          start_date: targetDate,
          end_date: endDate,
          start_period: targetPeriod,
          end_period: endPeriod,
          period: targetPeriod, // Legacy field
        })
        .eq('id', note.id);

      if (error) throw error;

      toast.success('Note déplacée');
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    } catch (error) {
      console.error('Note drop error:', error);
      toast.error('Erreur lors du déplacement de la note');
      setNoteUndoState(null);
    } finally {
      setDraggedNote(null);
      setNoteDropTarget(null);
      setIsNoteDragging(false);
    }
  }, [queryClient]);

  const handleNoteDragEnd = useCallback(() => {
    setDraggedNote(null);
    setNoteDropTarget(null);
    setIsNoteDragging(false);
  }, []);

  return {
    draggedNote,
    noteDropTarget,
    isNoteDragging,
    handleNoteDragStart,
    handleNoteDragOver,
    handleNoteDragLeave,
    handleNoteDrop,
    handleNoteDragEnd,
    canUndoNote: !!noteUndoState,
    handleNoteUndo,
  };
};

// Helper to calculate note duration in half-day units
function calculateNoteDuration(note: DraggedNote): number {
  const startDate = new Date(note.start_date);
  const endDate = new Date(note.end_date);
  
  // Calculate days between
  const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Each full day = 2 half-days
  let halfDays = daysDiff * 2;
  
  // Adjust for start period
  if (note.start_period === 'Après-midi') {
    halfDays -= 1;
  }
  
  // Adjust for end period
  if (note.end_period === 'Matin') {
    halfDays -= 1;
  }
  
  return Math.max(1, halfDays + 2); // +2 because we count both start and end
}

// Helper to calculate new end position based on duration
function calculateNewEndPosition(
  startDate: string,
  startPeriod: string,
  halfDays: number
): { endDate: string; endPeriod: string } {
  const date = new Date(startDate);
  let remainingHalfDays = halfDays - 1; // -1 because we start counting from the first half-day
  
  // Start from the given period
  let currentPeriod = startPeriod;
  
  while (remainingHalfDays > 0) {
    if (currentPeriod === 'Matin') {
      currentPeriod = 'Après-midi';
    } else {
      currentPeriod = 'Matin';
      date.setDate(date.getDate() + 1);
    }
    remainingHalfDays--;
  }
  
  return {
    endDate: date.toISOString().split('T')[0],
    endPeriod: currentPeriod,
  };
}
