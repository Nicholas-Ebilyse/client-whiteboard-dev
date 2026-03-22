import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface DraggedNote {
  id: string;
  text: string;
  team_id: string | null;
  start_date: string;
  end_date: string;
}

interface NoteDropTarget {
  teamId: string | null;
  date: string;
}

interface NoteUndoState {
  id: string;
  team_id: string | null;
  start_date: string;
  end_date: string;
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
          team_id: noteUndoState.team_id,
          start_date: noteUndoState.start_date,
          end_date: noteUndoState.end_date,
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
    teamId: string | null,
    date: string
  ) => {
    // Only handle if we're dragging a note
    if (!e.dataTransfer.types.includes('application/note-json')) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setNoteDropTarget({ teamId, date });
  }, []);

  const handleNoteDragLeave = useCallback(() => {
    setNoteDropTarget(null);
  }, []);

  const handleNoteDrop = useCallback(async (
    e: React.DragEvent,
    targetTeamId: string | null,
    targetDate: string,
    preserveDuration: boolean = true
  ) => {
    e.preventDefault();
    
    const noteData = e.dataTransfer.getData('application/note-json');
    if (!noteData) return;
    
    try {
      const note: DraggedNote = JSON.parse(noteData);
      
      // Save state for undo
      setNoteUndoState({
        id: note.id,
        team_id: note.team_id,
        start_date: note.start_date,
        end_date: note.end_date,
      });
      
      let endDate: string;
      
      if (preserveDuration) {
        // Calculate the duration of the note in days
        const startDate = new Date(note.start_date);
        const oldEndDate = new Date(note.end_date);
        const daysDiff = Math.round((oldEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate new end date based on original duration
        const newStartDate = new Date(targetDate);
        newStartDate.setDate(newStartDate.getDate() + daysDiff);
        endDate = newStartDate.toISOString().split('T')[0];
      } else {
        // Single day note
        endDate = targetDate;
      }
      
      // Update the note in the database
      const { error } = await supabase
        .from('notes')
        .update({
          team_id: targetTeamId,
          start_date: targetDate,
          end_date: endDate,
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
