import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Assignment } from '@/types/planning';
import { toast } from 'sonner';
import { useDragValidation, DragData, DropTarget, PreviewCell } from './useDragValidation';
import { useDropExecution } from './useDropExecution';

interface PendingDrop {
  dragData: DragData;
  targetTeamId: string;
  targetDate: string;
  isCopy: boolean;
}

interface LinkedGroupPendingDrop {
  dragData: DragData;
  targetTeamId: string;
  targetDate: string;
  isCopy: boolean;
  linkedGroupSize: number;
}

export const useDragAndDropAssignment = (
  assignments: any[],
  commandes: any[],
  teams: any[],
  technicians: any[],
  absences: any[],
  weekStart?: string,
  weekEnd?: string,
  onWeekChange?: (week: number, year: number) => void,
  currentWeek?: number,
  currentYear?: number
) => {
  const [draggedItem, setDraggedItem] = useState<DragData | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [linkedGroupPendingDrop, setLinkedGroupPendingDrop] = useState<LinkedGroupPendingDrop | null>(null);
  const [copyModeEnabled, setCopyModeEnabled] = useState(false);
  const [copyModeIntent, setCopyModeIntent] = useState(false);

  const ctrlEverPressedDuringDrag = useRef(false);
  const isDraggingRef = useRef(false);

  const isCopyMode = copyModeEnabled || (isDragging && ctrlPressed);

  const toggleCopyMode = useCallback(() => setCopyModeEnabled(prev => !prev), []);

  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);

  // Build teamId → technician_id[] map for absence checking
  const teamTechnicianMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const t of technicians) {
      if (t.team_id) {
        if (!map[t.team_id]) map[t.team_id] = [];
        map[t.team_id].push(t.id);
      }
    }
    return map;
  }, [technicians]);

  const { validateDrop } = useDragValidation(assignments, absences, teamTechnicianMap);

  /** Calculate new dates when dragging — day offset only (no period) */
  const calculateNewDates = useCallback((
    dragData: DragData,
    targetDate: string,
    targetTeamId: string
  ): any[] => {
    const groupId = dragData.assignment.assignment_group_id;

    const assignmentsToMove = groupId
      ? assignments.filter(a => a.assignment_group_id === groupId)
      : assignments.filter(a => a.id === dragData.assignment.id);

    const sourceDateObj = new Date(dragData.sourceDate);
    const targetDateObj = new Date(targetDate);
    const dayOffset = Math.round(
      (targetDateObj.getTime() - sourceDateObj.getTime()) / (1000 * 60 * 60 * 24)
    );

    return assignmentsToMove.map(a => {
      const newStart = new Date(a.start_date);
      newStart.setDate(newStart.getDate() + dayOffset);
      const newEnd = new Date(a.end_date);
      newEnd.setDate(newEnd.getDate() + dayOffset);
      return {
        id: a.id,
        newStartDate: newStart,
        newEndDate: newEnd,
        originalAssignment: a,
      };
    });
  }, [assignments]);

  const {
    undoState,
    isUndoing,
    handleUndo,
    executeDrop,
    executeConfirmLinkedDropSingle,
    executeConfirmLinkedDropAll,
  } = useDropExecution(assignments, calculateNewDates);

  const handleUndoRef = useRef<(() => void) | null>(null);
  const undoStateRef = useRef(undoState);
  const isUndoingRef = useRef(isUndoing);

  useEffect(() => {
    undoStateRef.current = undoState;
    isUndoingRef.current = isUndoing;
    handleUndoRef.current = handleUndo;
  }, [undoState, isUndoing, handleUndo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && undoStateRef.current && !isUndoingRef.current && handleUndoRef.current) {
        e.preventDefault();
        handleUndoRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isDraggable = useCallback((assignment: Assignment) => {
    if (assignment.isConfirmed) return false;
    const commande = commandes.find(c => c.id === assignment.commandeId);
    if (commande?.is_invoiced) return false;
    return true;
  }, [commandes]);

  /** Preview: highlight the cells that the assignment would occupy after the drop */
  const previewCells = useMemo((): PreviewCell[] => {
    if (!draggedItem || !dropTarget) return [];
    try {
      const positions = calculateNewDates(draggedItem, dropTarget.date, dropTarget.teamId);
      const cells: PreviewCell[] = [];
      for (const pos of positions) {
        const current = new Date(pos.newStartDate);
        while (current <= pos.newEndDate) {
          cells.push({ teamId: dropTarget.teamId, date: current.toISOString().split('T')[0] });
          current.setDate(current.getDate() + 1);
        }
      }
      return cells;
    } catch {
      return [];
    }
  }, [draggedItem, dropTarget, calculateNewDates]);

  const handleDragStart = useCallback((
    e: React.DragEvent,
    assignment: Assignment,
    date: string,
    teamId: string
  ) => {
    if (!isDraggable(assignment)) { e.preventDefault(); return; }
    const dragData: DragData = { assignment, sourceDate: date, sourceTeamId: teamId };
    setDraggedItem(dragData);
    setIsDragging(true);
    const initialCopy = e.ctrlKey || e.metaKey;
    setCopyModeIntent(initialCopy);
    ctrlEverPressedDuringDrag.current = initialCopy;
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
  }, [isDraggable]);

  const handleDragOver = useCallback((e: React.DragEvent, teamId: string, date: string) => {
    e.preventDefault();
    const isCtrl = e.ctrlKey || e.metaKey;
    setCtrlPressed(isCtrl);
    setCopyModeIntent(isCtrl);
    let isValid = true;
    if (draggedItem) {
      const validation = validateDrop(draggedItem, teamId, date);
      isValid = validation.isValid;
    }
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ teamId, date, isValid });
  }, [draggedItem, validateDrop]);

  const handleDragLeave = useCallback(() => setDropTarget(null), []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetTeamId: string, targetDate: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    setIsDragging(false);

    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) { setDraggedItem(null); setCopyModeIntent(false); ctrlEverPressedDuringDrag.current = false; return; }

    const isCopy = copyModeEnabled || ctrlEverPressedDuringDrag.current || e.ctrlKey || e.metaKey || copyModeIntent;
    setCopyModeIntent(false);
    ctrlEverPressedDuringDrag.current = false;

    try {
      const dragData: DragData = JSON.parse(dataStr);
      const validation = validateDrop(dragData, targetTeamId, targetDate);
      if (!validation.isValid) {
        toast.error(validation.reason || 'Déplacement non autorisé');
        setDraggedItem(null);
        return;
      }

      // If dragging to a different team, confirm first
      const isCrossTeam = dragData.sourceTeamId !== targetTeamId && !isCopy;
      if (isCrossTeam) {
        setPendingDrop({ dragData, targetTeamId, targetDate, isCopy });
        setDraggedItem(null);
        return;
      }

      // If linked group, offer choice
      const groupId = dragData.assignment.assignment_group_id;
      if (groupId && !isCopy) {
        const groupSize = assignments.filter(a => a.assignment_group_id === groupId).length;
        if (groupSize > 1) {
          setLinkedGroupPendingDrop({ dragData, targetTeamId, targetDate, isCopy, linkedGroupSize: groupSize });
          setDraggedItem(null);
          return;
        }
      }

      await executeDrop(dragData, targetTeamId, targetDate, isCopy);
      setDraggedItem(null);
    } catch (error) {
      console.error('Drop error:', error);
      toast.error('Erreur lors du déplacement');
      setDraggedItem(null);
    }
  }, [validateDrop, executeDrop, copyModeIntent, copyModeEnabled, assignments]);

  const confirmPendingDrop = useCallback(async () => {
    if (!pendingDrop) return;
    await executeDrop(pendingDrop.dragData, pendingDrop.targetTeamId, pendingDrop.targetDate, pendingDrop.isCopy);
    setPendingDrop(null);
  }, [pendingDrop, executeDrop]);

  const cancelPendingDrop = useCallback(() => setPendingDrop(null), []);

  const confirmLinkedDropSingle = useCallback(async () => {
    if (!linkedGroupPendingDrop) return;
    await executeConfirmLinkedDropSingle(
      linkedGroupPendingDrop.dragData,
      linkedGroupPendingDrop.targetTeamId,
      linkedGroupPendingDrop.targetDate
    );
    setLinkedGroupPendingDrop(null);
  }, [linkedGroupPendingDrop, executeConfirmLinkedDropSingle]);

  const confirmLinkedDropAll = useCallback(async () => {
    if (!linkedGroupPendingDrop) return;
    await executeConfirmLinkedDropAll(
      linkedGroupPendingDrop.dragData,
      linkedGroupPendingDrop.targetDate,
      () => executeConfirmLinkedDropSingle(
        linkedGroupPendingDrop.dragData,
        linkedGroupPendingDrop.targetTeamId,
        linkedGroupPendingDrop.targetDate
      )
    );
    setLinkedGroupPendingDrop(null);
  }, [linkedGroupPendingDrop, executeConfirmLinkedDropAll, executeConfirmLinkedDropSingle]);

  const cancelLinkedGroupPendingDrop = useCallback(() => setLinkedGroupPendingDrop(null), []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDropTarget(null);
    setIsDragging(false);
    setCopyModeIntent(false);
    ctrlEverPressedDuringDrag.current = false;
  }, []);

  const handleWeekNavDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleWeekNavDrop = useCallback((e: React.DragEvent, direction: 'prev' | 'next') => {
    e.preventDefault();
    setDropTarget(null);
    setIsDragging(false);
    setCopyModeIntent(false);
    ctrlEverPressedDuringDrag.current = false;

    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr || !onWeekChange || currentWeek === undefined || currentYear === undefined) {
      setDraggedItem(null);
      return;
    }
    try {
      let targetWeek = currentWeek;
      let targetYear = currentYear;
      if (direction === 'prev') {
        if (currentWeek === 1) { targetWeek = 52; targetYear = currentYear - 1; }
        else targetWeek = currentWeek - 1;
      } else {
        if (currentWeek === 52) { targetWeek = 1; targetYear = currentYear + 1; }
        else targetWeek = currentWeek + 1;
      }
      onWeekChange(targetWeek, targetYear);
    } catch {
      // ignore
    } finally {
      setDraggedItem(null);
    }
  }, [onWeekChange, currentWeek, currentYear]);

  return {
    draggedItem,
    dropTarget,
    previewCells,
    isDraggable,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    canUndo: !!undoState && !isUndoing,
    handleUndo,
    isCopyMode,
    copyModeEnabled,
    toggleCopyMode,
    isDragging,
    // Cross-team confirmation dialog
    pendingDrop,
    confirmPendingDrop,
    cancelPendingDrop,
    // Linked group dialog
    linkedGroupPendingDrop,
    confirmLinkedDropSingle,
    confirmLinkedDropAll,
    cancelLinkedGroupPendingDrop,
    handleWeekNavDragOver,
    handleWeekNavDrop,
  };
};