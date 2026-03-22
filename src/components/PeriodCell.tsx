import { useState } from 'react';
import { StickyNote, GripVertical, Check, Receipt } from 'lucide-react';
import { NoteContextMenu } from './NoteContextMenu';
import { cn } from '@/lib/utils';
import type { DraggedNote } from '@/hooks/useDragAndDropNote';

interface GeneralNote {
  id: string;
  text: string;
  is_confirmed?: boolean;
  start_period: string;
  end_period: string;
}

interface PeriodCellProps {
  period: string;
  dayDate: string;
  generalNotes: GeneralNote[];
  isAdmin: boolean;
  onAddNote?: () => void;
  onNoteClick?: (note: GeneralNote) => void;
  onNoteDuplicate?: (note: GeneralNote) => void;
  onNoteDelete?: (noteId: string) => void;
  onNoteToggleConfirm?: (noteId: string, isConfirmed: boolean) => void;
  // Note drag props
  fullNotes?: DraggedNote[];
  onNoteDragStart?: (e: React.DragEvent, note: DraggedNote) => void;
  onNoteDragOver?: (e: React.DragEvent, technicianId: string | null, date: string, period: string) => void;
  onNoteDrop?: (e: React.DragEvent, technicianId: string | null, date: string, period: string, preserveDuration?: boolean) => void;
  onNoteDragEnd?: () => void;
  noteDropTarget?: { technicianId: string | null; date: string; period: string } | null;
  isNoteDragging?: boolean;
}

export const PeriodCell = ({ 
  period,
  dayDate,
  generalNotes, 
  isAdmin, 
  onAddNote,
  onNoteClick,
  onNoteDuplicate,
  onNoteDelete,
  onNoteToggleConfirm,
  fullNotes = [],
  onNoteDragStart,
  onNoteDragOver,
  onNoteDrop,
  onNoteDragEnd,
  noteDropTarget,
  isNoteDragging = false,
}: PeriodCellProps) => {
  const [isHovered, setIsHovered] = useState(false);

  // Filter notes that are only for this specific period (same start and end)
  const periodNotes = generalNotes.filter(n => 
    n.start_period === period && n.end_period === period
  );

  const getFullNote = (noteId: string): DraggedNote | undefined => {
    return fullNotes.find(n => n.id === noteId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (onNoteDragOver && e.dataTransfer.types.includes('application/note-json')) {
      onNoteDragOver(e, null, dayDate, period);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (onNoteDrop && e.dataTransfer.types.includes('application/note-json')) {
      // Pass false to NOT preserve duration - note becomes single-period
      onNoteDrop(e, null, dayDate, period, false);
    }
  };

  const isNoteDropTarget = noteDropTarget?.technicianId === null &&
    noteDropTarget?.date === dayDate &&
    noteDropTarget?.period === period;

  return (
    <div 
      className={cn(
        "p-2 text-base sm:text-lg font-semibold text-muted-foreground border-r border-border relative h-full flex flex-col transition-all",
        isNoteDropTarget && "ring-2 ring-amber-500 ring-inset bg-amber-100/50 dark:bg-amber-900/30",
        isNoteDragging && !isNoteDropTarget && "bg-muted/30"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex-1 flex items-center justify-center">
        {period}
        {isAdmin && isHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddNote?.();
            }}
            className="absolute top-1 right-1 p-1 rounded hover:bg-primary/20 transition-colors"
            title={`Ajouter une note générale pour ${period.toLowerCase()}`}
          >
            <StickyNote className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
      
      {/* Display general notes for this period - uses blue/indigo to distinguish from amber technician notes */}
      {periodNotes.map((note) => {
        const fullNote = getFullNote(note.id);
        const canDragNote = isAdmin && fullNote && onNoteDragStart;
        
        return (
          <NoteContextMenu
            key={note.id}
            note={note}
            onEdit={(n) => onNoteClick?.(n as GeneralNote)}
            onDuplicate={(n) => onNoteDuplicate?.(n as GeneralNote)}
            onDelete={(n) => onNoteDelete?.(n.id)}
            disabled={!isAdmin}
          >
            <div
              draggable={!!canDragNote}
              onDragStart={(e) => {
                if (canDragNote && fullNote) {
                  e.stopPropagation();
                  onNoteDragStart(e, fullNote);
                }
              }}
              onDragEnd={onNoteDragEnd}
              className={cn(canDragNote && "cursor-grab active:cursor-grabbing")}
            >
              <div
                onClick={() => onNoteClick?.(note)}
                className={cn(
                  "mt-1 w-full text-xs p-1 rounded transition-colors text-left border-l-2 flex items-center gap-1 cursor-pointer group/note",
                  note.is_confirmed 
                    ? "bg-note-confirmed text-note-confirmed-foreground hover:bg-note-confirmed/80 border-cyan-500" 
                    : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-100 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 border-indigo-500"
                )}
                title={note.text}
              >
                {canDragNote && <GripVertical className="h-3 w-3 flex-shrink-0 opacity-30" />}
                {/* Quick confirm toggle - after drag handle, before text */}
                {isAdmin && onNoteToggleConfirm && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNoteToggleConfirm(note.id, !note.is_confirmed);
                    }}
                    className={cn(
                      "flex-shrink-0 p-0.5 rounded transition-all",
                      note.is_confirmed 
                        ? "bg-cyan-500 text-white hover:bg-cyan-600" 
                        : "bg-transparent border border-current opacity-40 hover:opacity-100"
                    )}
                    title={note.is_confirmed ? "Marquer comme non confirmé" : "Marquer comme confirmé"}
                  >
                    <Check className="h-2.5 w-2.5" />
                  </button>
                )}

                <span className="truncate flex-1">{note.text}</span>
              </div>
            </div>
          </NoteContextMenu>
        );
      })}
    </div>
  );
};
