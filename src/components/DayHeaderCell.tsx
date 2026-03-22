import { useState } from 'react';
import { StickyNote, GripVertical, Check, Receipt } from 'lucide-react';
import { NoteContextMenu } from './NoteContextMenu';
import { cn } from '@/lib/utils';
import type { DraggedNote } from '@/hooks/useDragAndDropNote';

interface GeneralNote {
  id: string;
  text: string;
  start_period: string;
  end_period: string;
}

interface DayHeaderCellProps {
  dayDate: string;
  dayLabel: string;
  generalNotes: GeneralNote[];
  isAdmin: boolean;
  onAddNote?: () => void;
  onNoteClick?: (note: GeneralNote) => void;
  onNoteDuplicate?: (note: GeneralNote) => void;
  onNoteDelete?: (noteId: string) => void;

  // Note drag props
  fullNotes?: DraggedNote[];
  onNoteDragStart?: (e: React.DragEvent, note: DraggedNote) => void;
  onNoteDragOver?: (e: React.DragEvent, technicianId: string | null, date: string, period: string) => void;
  onNoteDrop?: (e: React.DragEvent, technicianId: string | null, date: string, period: string, preserveDuration?: boolean) => void;
  onNoteDragEnd?: () => void;
  noteDropTarget?: { technicianId: string | null; date: string; period: string } | null;
  isNoteDragging?: boolean;
}

export const DayHeaderCell = ({ 
  dayDate, 
  dayLabel, 
  generalNotes, 
  isAdmin, 
  onAddNote,
  onNoteClick,
  onNoteDuplicate,
  onNoteDelete,

  fullNotes = [],
  onNoteDragStart,
  onNoteDragOver,
  onNoteDrop,
  onNoteDragEnd,
  noteDropTarget,
  isNoteDragging = false,
}: DayHeaderCellProps) => {
  const [isHovered, setIsHovered] = useState(false);

  // Filter notes that span the full day (Matin to Après-midi)
  const dayNotes = generalNotes.filter(n => 
    n.start_period === 'Matin' && n.end_period === 'Après-midi'
  );

  const getFullNote = (noteId: string): DraggedNote | undefined => {
    return fullNotes.find(n => n.id === noteId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (onNoteDragOver && e.dataTransfer.types.includes('application/note-json')) {
      onNoteDragOver(e, null, dayDate, 'Matin');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (onNoteDrop && e.dataTransfer.types.includes('application/note-json')) {
      // For day header, we drop as a full-day note - preserve duration
      onNoteDrop(e, null, dayDate, 'Matin', true);
    }
  };

  const isNoteDropTarget = noteDropTarget?.technicianId === null &&
    noteDropTarget?.date === dayDate &&
    noteDropTarget?.period === 'Matin';

  return (
    <div 
      className={cn(
        "p-2 sm:p-3 font-bold text-base sm:text-lg lg:text-xl text-center border-r border-border relative transition-all flex flex-col items-center justify-center min-h-[60px]",
        isNoteDropTarget && "ring-2 ring-indigo-500 ring-inset bg-indigo-100/50 dark:bg-indigo-900/30",
        isNoteDragging && !isNoteDropTarget && "bg-indigo-50/50 dark:bg-indigo-950/20"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-center w-full">
        <span className="capitalize">{dayLabel}</span>
        {isAdmin && isHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddNote?.();
            }}
            className="absolute top-1 right-1 p-1 rounded hover:bg-primary/20 transition-colors"
            title="Ajouter une note générale"
          >
            <StickyNote className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
      
      {/* Display general notes for this day - uses blue/indigo to distinguish from amber technician notes */}
      {dayNotes.map((note) => {
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
                  "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-100 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 border-indigo-500"
                )}
                title={note.text}
              >
                {canDragNote && <GripVertical className="h-3 w-3 flex-shrink-0 opacity-30" />}

                <span className="truncate flex-1">{note.text}</span>
              </div>
            </div>
          </NoteContextMenu>
        );
      })}
    </div>
  );
};
