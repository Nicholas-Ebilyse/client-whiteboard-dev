import { useState } from 'react';
import { StickyNote, GripVertical, Check, Receipt } from 'lucide-react';
import { NoteContextMenu } from './NoteContextMenu';
import { cn } from '@/lib/utils';
import type { DraggedNote } from '@/hooks/useDragAndDropNote';

interface DayNote {
  id: string;
  text: string;
  is_confirmed?: boolean;
}

interface TechnicianDayCellProps {
  technicianId: string;
  technicianName: string;
  date: string;
  dayNotes: DayNote[];
  isAdmin: boolean;
  onAddNote?: () => void;
  onNoteClick?: (note: DayNote) => void;
  onNoteDuplicate?: (note: DayNote) => void;
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

export const TechnicianDayCell = ({ 
  technicianId,
  technicianName,
  date,
  dayNotes,
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
}: TechnicianDayCellProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const getFullNote = (noteId: string): DraggedNote | undefined => {
    return fullNotes.find(n => n.id === noteId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (onNoteDragOver && e.dataTransfer.types.includes('application/note-json')) {
      onNoteDragOver(e, technicianId, date, 'Matin');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (onNoteDrop && e.dataTransfer.types.includes('application/note-json')) {
      // For technician day cell, drop as full-day note - preserve duration
      onNoteDrop(e, technicianId, date, 'Matin', true);
    }
  };

  const isNoteDropTarget = noteDropTarget?.technicianId === technicianId &&
    noteDropTarget?.date === date &&
    noteDropTarget?.period === 'Matin';

  return (
    <div 
      className={cn(
        "relative h-full min-h-[32px] flex flex-col items-center justify-start p-1 transition-all",
        isNoteDropTarget && "ring-2 ring-amber-500 ring-inset bg-amber-100/50 dark:bg-amber-900/30",
        isNoteDragging && !isNoteDropTarget && "bg-amber-50/30 dark:bg-amber-950/10"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isAdmin && isHovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddNote?.();
          }}
          className="absolute top-1 right-1 p-1 rounded hover:bg-primary/20 transition-colors z-10"
          title={`Ajouter une note pour ${technicianName} (${date})`}
        >
          <StickyNote className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
      
      {/* Display day notes for this technician */}
      {dayNotes.map((note) => {
        const fullNote = getFullNote(note.id);
        const canDragNote = isAdmin && fullNote && onNoteDragStart;
        
        return (
          <NoteContextMenu
            key={note.id}
            note={note}
            onEdit={(n) => onNoteClick?.(n as DayNote)}
            onDuplicate={(n) => onNoteDuplicate?.(n as DayNote)}
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
              className={cn("w-full", canDragNote && "cursor-grab active:cursor-grabbing")}
            >
              <div
                onClick={() => onNoteClick?.(note)}
                className={cn(
                  "w-full text-xs p-1 rounded transition-colors text-left border-l-2 mb-1 flex items-center gap-1 cursor-pointer group/note",
                  note.is_confirmed 
                    ? "bg-note-confirmed text-note-confirmed-foreground hover:bg-note-confirmed/80 border-cyan-500" 
                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-900/50 border-amber-500"
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
