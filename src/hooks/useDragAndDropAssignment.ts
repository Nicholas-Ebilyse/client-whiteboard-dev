import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Assignment } from '@/types/planning';
import { toast } from 'sonner';
import { useDragValidation, DragData, DropTarget, PreviewCell } from './useDragValidation';
import { useDropExecution } from './useDropExecution';

interface PendingDrop {
  dragData: DragData;
  targetTechnicianId: string;
  targetDate: string;
  targetPeriod: string;
  isCopy: boolean;
}

interface LinkedTechnicianPendingDrop {
  dragData: DragData;
  targetTechnicianId: string;
  targetDate: string;
  targetPeriod: string;
  isCopy: boolean;
  linkedTechnicianNames: string[];
}

interface CrossWeekDrag {
  dragData: DragData;
  targetWeek: number;
  targetYear: number;
  relativePeriodOffset: number;
}

export const useDragAndDropAssignment = (
  assignments: any[],
  commandes: any[],
  technicians: any[],
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
  const [linkedTechPendingDrop, setLinkedTechPendingDrop] = useState<LinkedTechnicianPendingDrop | null>(null);
  const [crossWeekDrag, setCrossWeekDrag] = useState<CrossWeekDrag | null>(null);
  const [copyModeIntent, setCopyModeIntent] = useState(false);
  const [copyModeEnabled, setCopyModeEnabled] = useState(false);
  
  const ctrlEverPressedDuringDrag = useRef(false);
  const isDraggingRef = useRef(false);

  const isCopyMode = copyModeEnabled || (isDragging && ctrlPressed);
  
  const toggleCopyMode = useCallback(() => {
    setCopyModeEnabled(prev => !prev);
  }, []);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const { calculateNewPositions, validateDrop } = useDragValidation(assignments, weekStart, weekEnd);
  
  const {
    undoState,
    isUndoing,
    handleUndo,
    executeDrop,
    executeConfirmLinkedDropSingle,
    executeConfirmLinkedDropAll
  } = useDropExecution(assignments, calculateNewPositions);

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
      // Ctrl+Z for undo
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

  const getLinkedTechnicians = useCallback((assignment: Assignment): string[] => {
    if (!assignment.assignment_group_id) return [];
    
    const groupAssignments = assignments.filter(
      a => a.assignment_group_id === assignment.assignment_group_id
    );
    
    const currentTechId = assignment.teamId || (assignment as any).technician_id;
    const linkedTechnicianIds = [...new Set(
      groupAssignments
        .map(a => a.technician_id)
        .filter(id => id !== currentTechId)
    )];
    
    return linkedTechnicianIds
      .map(id => technicians.find(t => t.id === id)?.name)
      .filter((name): name is string => !!name);
  }, [assignments, technicians]);

  const previewCells = useMemo((): PreviewCell[] => {
    if (!draggedItem || !dropTarget) return [];
    try {
      const newPositions = calculateNewPositions(draggedItem, dropTarget.date, dropTarget.period, dropTarget.technicianId);
      const cells: PreviewCell[] = [];
      const periodToNum = (p: string) => p === 'Matin' ? 0 : 1;
      const numToPeriod = (n: number) => n === 0 ? 'Matin' : 'Après-midi';

      for (const pos of newPositions) {
        const startDateStr = pos.newStartDate.toISOString().split('T')[0];
        const endDateStr = pos.newEndDate.toISOString().split('T')[0];
        const currentDate = new Date(pos.newStartDate);
        
        while (currentDate <= pos.newEndDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          let periodsToAdd: string[] = [];
          
          if (dateStr === startDateStr && dateStr === endDateStr) {
            const start = periodToNum(pos.newStartPeriod);
            const end = periodToNum(pos.newEndPeriod);
            for (let i = start; i <= end; i++) periodsToAdd.push(numToPeriod(i));
          } else if (dateStr === startDateStr) {
            periodsToAdd = periodToNum(pos.newStartPeriod) === 0 ? ['Matin', 'Après-midi'] : ['Après-midi'];
          } else if (dateStr === endDateStr) {
            periodsToAdd = periodToNum(pos.newEndPeriod) === 1 ? ['Matin', 'Après-midi'] : ['Matin'];
          } else {
            periodsToAdd = ['Matin', 'Après-midi'];
          }

          for (const period of periodsToAdd) {
            cells.push({ technicianId: dropTarget.technicianId, date: dateStr, period });
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
      return cells;
    } catch (e) {
      return [];
    }
  }, [draggedItem, dropTarget, calculateNewPositions]);

  const handleDragStart = useCallback((e: React.DragEvent, assignment: Assignment, date: string, period: string, technicianId: string) => {
    if (!isDraggable(assignment)) {
      e.preventDefault();
      return;
    }
    const dragData: DragData = { assignment, sourceDate: date, sourcePeriod: period, sourceTechnicianId: technicianId };
    setDraggedItem(dragData);
    setIsDragging(true);
    
    const initialCopyMode = e.ctrlKey || e.metaKey;
    setCopyModeIntent(initialCopyMode);
    ctrlEverPressedDuringDrag.current = initialCopyMode;
    
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
  }, [isDraggable]);

  const handleDragOver = useCallback((e: React.DragEvent, technicianId: string, date: string, period: string) => {
    e.preventDefault();
    const isCtrlPressed = e.ctrlKey || e.metaKey;
    setCtrlPressed(isCtrlPressed);
    setCopyModeIntent(isCtrlPressed);
    
    let isValid = true;
    if (draggedItem) {
      const validation = validateDrop(draggedItem, technicianId, date, period, isCtrlPressed);
      isValid = validation.valid;
    }
    
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ technicianId, date, period, isValid });
  }, [draggedItem, validateDrop]);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetTechnicianId: string, targetDate: string, targetPeriod: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    setIsDragging(false);

    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) {
      setDraggedItem(null);
      setCopyModeIntent(false);
      setCtrlPressed(false);
      ctrlEverPressedDuringDrag.current = false;
      return;
    }

    const everPressedDuringDrag = ctrlEverPressedDuringDrag.current;
    const eventCtrl = e.ctrlKey || e.metaKey;
    const isCopy = copyModeEnabled || everPressedDuringDrag || eventCtrl || copyModeIntent;
    
    setCopyModeIntent(false);
    setCtrlPressed(false);
    ctrlEverPressedDuringDrag.current = false;

    try {
      const dragData: DragData = JSON.parse(dataStr);
      const validation = validateDrop(dragData, targetTechnicianId, targetDate, targetPeriod, isCopy);
      
      if (!validation.valid) {
        toast.error(validation.reason || 'Déplacement non autorisé');
        setDraggedItem(null);
        return;
      }

      const isCrossTechnician = dragData.sourceTechnicianId !== targetTechnicianId && !isCopy;
      if (isCrossTechnician) {
        setPendingDrop({ dragData, targetTechnicianId, targetDate, targetPeriod, isCopy });
        setDraggedItem(null);
        return;
      }

      const linkedTechnicianNames = getLinkedTechnicians(dragData.assignment);
      if (linkedTechnicianNames.length > 0 && !isCopy) {
        setLinkedTechPendingDrop({ dragData, targetTechnicianId, targetDate, targetPeriod, isCopy, linkedTechnicianNames });
        setDraggedItem(null);
        return;
      }

      await executeDrop(dragData, targetTechnicianId, targetDate, targetPeriod, isCopy);
      setDraggedItem(null);
    } catch (error) {
      console.error('Drop error:', error);
      toast.error('Erreur lors du déplacement');
      setDraggedItem(null);
    }
  }, [validateDrop, executeDrop, copyModeIntent, copyModeEnabled, getLinkedTechnicians]);

  const confirmPendingDrop = useCallback(async () => {
    if (!pendingDrop) return;
    await executeDrop(pendingDrop.dragData, pendingDrop.targetTechnicianId, pendingDrop.targetDate, pendingDrop.targetPeriod, pendingDrop.isCopy);
    setPendingDrop(null);
  }, [pendingDrop, executeDrop]);

  const cancelPendingDrop = useCallback(() => setPendingDrop(null), []);

  const confirmLinkedDropSingle = useCallback(async () => {
    if (!linkedTechPendingDrop) return;
    await executeConfirmLinkedDropSingle(
      linkedTechPendingDrop.dragData,
      linkedTechPendingDrop.targetTechnicianId,
      linkedTechPendingDrop.targetDate,
      linkedTechPendingDrop.targetPeriod
    );
    setLinkedTechPendingDrop(null);
  }, [linkedTechPendingDrop, executeConfirmLinkedDropSingle]);

  const confirmLinkedDropAll = useCallback(async () => {
    if (!linkedTechPendingDrop) return;
    await executeConfirmLinkedDropAll(
      linkedTechPendingDrop.dragData,
      linkedTechPendingDrop.targetDate,
      linkedTechPendingDrop.targetPeriod,
      () => executeConfirmLinkedDropSingle(
        linkedTechPendingDrop.dragData,
        linkedTechPendingDrop.targetTechnicianId,
        linkedTechPendingDrop.targetDate,
        linkedTechPendingDrop.targetPeriod
      )
    );
    setLinkedTechPendingDrop(null);
  }, [linkedTechPendingDrop, executeConfirmLinkedDropAll, executeConfirmLinkedDropSingle]);

  const cancelLinkedTechPendingDrop = useCallback(() => setLinkedTechPendingDrop(null), []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDropTarget(null);
    setIsDragging(false);
    setCopyModeIntent(false);
    ctrlEverPressedDuringDrag.current = false;
  }, []);

  const handleWeekNavDragOver = useCallback((e: React.DragEvent, direction: 'prev' | 'next') => {
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
      const dragData: DragData = JSON.parse(dataStr);
      let targetWeek = currentWeek;
      let targetYear = currentYear;
      
      if (direction === 'prev') {
        if (currentWeek === 1) {
          targetWeek = 52;
          targetYear = currentYear - 1;
        } else {
          targetWeek = currentWeek - 1;
        }
      } else {
        if (currentWeek === 52) {
          targetWeek = 1;
          targetYear = currentYear + 1;
        } else {
          targetWeek = currentWeek + 1;
        }
      }

      setCrossWeekDrag({ dragData, targetWeek, targetYear, relativePeriodOffset: 0 });
      onWeekChange(targetWeek, targetYear);
      setDraggedItem(null);
    } catch (error) {
      console.error('Cross-week drop error:', error);
      setDraggedItem(null);
    }
  }, [onWeekChange, currentWeek, currentYear]);

  useEffect(() => {
    if (!crossWeekDrag || !weekStart) return;

    const executeCrossWeekDrop = async () => {
      const { dragData } = crossWeekDrag;
      
      const sourceDate = new Date(dragData.sourceDate);
      const dayOfWeek = sourceDate.getDay();
      const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 
      
      const weekStartDate = new Date(weekStart);
      const targetDate = new Date(weekStartDate);
      targetDate.setDate(weekStartDate.getDate() + adjustedDay);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      const validation = validateDrop(dragData, dragData.sourceTechnicianId, targetDateStr, dragData.sourcePeriod, false);

      if (validation.valid) {
        await executeDrop(dragData, dragData.sourceTechnicianId, targetDateStr, dragData.sourcePeriod, false);
        toast.success('Affectation déplacée vers une autre semaine');
      } else {
        toast.error(validation.reason || 'Impossible de déplacer vers cette semaine');
      }

      setCrossWeekDrag(null);
    };

    executeCrossWeekDrop();
  }, [crossWeekDrag, weekStart, validateDrop, executeDrop]);

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
    pendingDrop,
    confirmPendingDrop,
    cancelPendingDrop,
    linkedTechPendingDrop,
    confirmLinkedDropSingle,
    confirmLinkedDropAll,
    cancelLinkedTechPendingDrop,
    handleWeekNavDragOver,
    handleWeekNavDrop,
    isDragging,
  };
};