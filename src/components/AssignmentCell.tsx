import { Assignment } from '@/types/planning';
import { cn } from '@/lib/utils';
import { StickyNote, CalendarPlus, Link2, MapPin, GripVertical, Lock, Check, Receipt, ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Car, Wrench } from 'lucide-react';
import { AssignmentContextMenu } from './AssignmentContextMenu';
import { NoteContextMenu } from './NoteContextMenu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { toast } from 'sonner';

interface Note {
  id: string;
  text: string;
  weather_condition?: string;
  vehicle_ids?: string[];
  equipment_ids?: string[];
}

interface DraggableNote {
  id: string;
  text: string;
  technician_id: string | null;
  start_date: string;
  end_date: string;
  weather_condition?: string;
  vehicle_ids?: string[];
  equipment_ids?: string[];
}

interface Commande {
  id: string;
  client: string;
  chantier: string;
  display_name?: string;
  client_presence?: string;
}

interface Chantier {
  id: string;
  name: string;
  address?: string;
}

interface AssignmentCellProps {
  assignments: Assignment[];
  notes: Note[];
  teamColor: string;
  onClick?: () => void;
  onNoteClick?: (noteId: string) => void;
  onNoteDuplicate?: (note: Note) => void;
  onNoteDelete?: (noteId: string) => void;
  onNoteToggleConfirm?: (noteId: string, isConfirmed: boolean) => void;
  onAddNote?: () => void;
  onAddAssignment?: () => void;
  onAssignmentClick?: (assignment: Assignment) => void;
  onAssignmentDuplicate?: (assignment: Assignment) => void;
  onAssignmentDelete?: (assignment: Assignment) => void;
  onAssignmentMoveUp?: (assignment: Assignment) => void;
  onAssignmentMoveDown?: (assignment: Assignment) => void;
  commandes: Commande[];

  isAdmin?: boolean;
  maxAssignmentsPerPeriod?: number;
  cellDate?: string;
  cellTechnicianId?: string;
  isDraggable?: (assignment: Assignment) => boolean;
  onDragStart?: (e: React.DragEvent, assignment: Assignment, date: string, technicianId: string) => void;
  onDragOver?: (e: React.DragEvent, technicianId: string, date: string) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, technicianId: string, date: string) => void;
  onDragEnd?: () => void;
  isDropTarget?: { technicianId: string; date: string; isValid: boolean } | null;
  isPreviewCell?: boolean;
  draggedAssignmentId?: string | null;
  draggedGroupId?: string | null;
  fullNotes?: DraggableNote[];
  onNoteDragStart?: (e: React.DragEvent, note: DraggableNote) => void;
  onNoteDragOver?: (e: React.DragEvent, technicianId: string | null, date: string) => void;
  onNoteDrop?: (e: React.DragEvent, technicianId: string | null, date: string, preserveDuration?: boolean) => void;
  onNoteDragEnd?: () => void;
  isNoteDragging?: boolean;
  noteDropTarget?: { technicianId: string | null; date: string } | null;
  allAssignments?: Assignment[];
  technicians?: { id: string; name: string }[];
  highlightedGroupId?: string | null;
  onHighlightGroup?: (groupId: string | null) => void;
  absentTechNames?: string[];
}

const formatAddressForDisplay = (address: string): string => {
  return address.replace(/, France$/i, '').replace(/,\s*France$/i, '');
};

const getWeatherEmoji = (condition?: string) => {
  switch (condition) {
    case 'SOLEIL': return '☀️';
    case 'PLUIE': return '🌧️';
    case 'NEIGE': return '❄️';
    case 'VENT': return '💨';
    case 'GEL': return '🧊';
    default: return null;
  }
};

const getAssignmentDisplayName = (assignment: Assignment, commandes: Commande[]): string => {
  const commande = commandes.find(c => c.id === assignment.commandeId);
  if (!commande) return "Nouvelle affectation";
  // Use the normalized display_name from the commande, or generate one if missing
  return commande.display_name || `${commande.client} - ${commande.chantier || ''}`;
};

export const AssignmentCell = ({
  assignments,
  notes,
  teamColor,
  onClick,
  onNoteClick,
  onNoteDuplicate,
  onNoteDelete,
  onNoteToggleConfirm,
  onAddNote,
  onAddAssignment,
  onAssignmentClick,
  onAssignmentDuplicate,
  onAssignmentDelete,
  onAssignmentMoveUp,
  onAssignmentMoveDown,
  commandes,

  isAdmin = false,
  maxAssignmentsPerPeriod = 3,
  cellDate,
  cellTechnicianId,
  isDraggable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isDropTarget,
  isPreviewCell = false,
  draggedAssignmentId,
  draggedGroupId,
  fullNotes = [],
  onNoteDragStart,
  onNoteDragOver,
  onNoteDrop,
  onNoteDragEnd,
  isNoteDragging = false,
  noteDropTarget,
  allAssignments = [],
  technicians = [],
  highlightedGroupId,
  onHighlightGroup,
  absentTechNames = [],
}: AssignmentCellProps) => {
  const hasContent = assignments.length > 0 || notes.length > 0;
  const limitedNotes = notes.slice(0, 3);
  const limitedAssignments = assignments;

  const getLinkedTechnicianName = (assignment: Assignment): string | null => {
    if (!assignment.assignment_group_id || allAssignments.length === 0) return null;
    const linkedAssignment = allAssignments.find(
      a => a.assignment_group_id === assignment.assignment_group_id &&
        a.teamId !== assignment.teamId
    );
    if (linkedAssignment) {
      const tech = technicians.find(t => t.id === linkedAssignment.teamId);
      return tech?.name || null;
    }
    return null;
  };

  const isBeingDragged = (assignment: Assignment) => {
    if (!draggedAssignmentId) return false;
    if (assignment.id === draggedAssignmentId) return true;
    if (draggedGroupId && assignment.assignment_group_id === draggedGroupId) return true;
    return false;
  };

  const getAssignmentClasses = (assignment: Assignment): string => {
    return "text-white border border-black/10 shadow-sm drop-shadow-sm";
  };

  const canDrag = (assignment: Assignment) => {
    return isDraggable ? isDraggable(assignment) : false;
  };

  const handleCellDragOver = (e: React.DragEvent) => {
    if (onDragOver && cellTechnicianId && cellDate) {
      onDragOver(e, cellTechnicianId, cellDate);
    }
    if (onNoteDragOver && cellDate) {
      onNoteDragOver(e, cellTechnicianId || null, cellDate);
    }
  };

  const handleCellDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/note-json') && onNoteDrop && cellDate) {
      onNoteDrop(e, cellTechnicianId || null, cellDate, true);
      return;
    }
    if (onDrop && cellTechnicianId && cellDate) {
      onDrop(e, cellTechnicianId, cellDate);
    }
  };

  const isCurrentDropTarget = isDropTarget?.technicianId === cellTechnicianId && isDropTarget?.date === cellDate;
  const isValidDrop = isCurrentDropTarget && isDropTarget?.isValid;
  const isInvalidDrop = isCurrentDropTarget && !isDropTarget?.isValid;
  const isNoteDropTarget = noteDropTarget?.technicianId === (cellTechnicianId || null) && noteDropTarget?.date === cellDate;

  const getFullNote = (noteId: string): DraggableNote | undefined => {
    return fullNotes.find(n => n.id === noteId);
  };

  if (!hasContent) {
    return (
      <div
        className={cn(
          "transition-all hover:bg-muted/50 relative group p-0.5 h-full flex flex-col min-h-[60px]",
          isValidDrop && "ring-2 ring-primary ring-inset bg-primary/20",
          isInvalidDrop && "ring-2 ring-destructive ring-inset bg-destructive/20",
          isPreviewCell && !isCurrentDropTarget && "ring-2 ring-dashed ring-primary/60 bg-primary/10",
          isNoteDropTarget && "ring-2 ring-amber-500 ring-inset bg-amber-100/50 dark:bg-amber-900/30",
          isNoteDragging && !isNoteDropTarget && "bg-amber-50/20 dark:bg-amber-950/10"
        )}
        style={{ backgroundColor: (isValidDrop || isInvalidDrop || isPreviewCell || isNoteDropTarget || isNoteDragging) ? undefined : 'transparent', cursor: onClick ? 'pointer' : 'default' }}
        onClick={onClick}
        onDragOver={handleCellDragOver}
        onDragLeave={onDragLeave}
        onDrop={handleCellDrop}
      >
        {onAddAssignment && (
          <button onClick={(e) => { e.stopPropagation(); onAddAssignment(); }} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded" title="Ajouter une affectation">
            <CalendarPlus className="h-3 w-3" />
          </button>
        )}
        {onAddNote && (
          <button onClick={(e) => { e.stopPropagation(); onAddNote(); }} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded" title="Ajouter une note">
            <StickyNote className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative group p-0.5 h-full flex flex-col transition-all min-h-[60px]",
        isValidDrop && "ring-2 ring-primary ring-inset bg-primary/20",
        isInvalidDrop && "ring-2 ring-destructive ring-inset bg-destructive/20",
        isPreviewCell && !isCurrentDropTarget && "ring-2 ring-dashed ring-primary/60 bg-primary/10",
        isNoteDropTarget && "ring-2 ring-amber-500 ring-inset bg-amber-100/50 dark:bg-amber-900/30",
        isNoteDragging && !isNoteDropTarget && "bg-amber-50/20 dark:bg-amber-950/10"
      )}
      style={{ backgroundColor: (isValidDrop || isInvalidDrop || isPreviewCell || isNoteDropTarget || isNoteDragging) ? undefined : 'transparent' }}
      onDragOver={handleCellDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleCellDrop}
    >
      {onAddAssignment && (
        <button onClick={(e) => { e.stopPropagation(); onAddAssignment(); }} className="absolute top-1 left-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded bg-background" title="Ajouter une affectation">
          <CalendarPlus className="h-3 w-3" />
        </button>
      )}
      {onAddNote && (
        <button onClick={(e) => { e.stopPropagation(); onAddNote(); }} className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded bg-background" title="Ajouter une note">
          <StickyNote className="h-3 w-3" />
        </button>
      )}

      <div className="h-full flex flex-col">
        {/* Notes section */}
        {limitedNotes.length > 0 && (
          <div className="flex-shrink-0">
            {limitedNotes.map((note) => {
              const fullNote = getFullNote(note.id);
              const canDragNote = isAdmin && fullNote && onNoteDragStart;

              return (
                <NoteContextMenu
                  key={note.id}
                  note={note}
                  onEdit={(n) => onNoteClick?.(n.id)}
                  onDuplicate={onNoteDuplicate}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onNoteClick) onNoteClick(note.id);
                      }}
                      className={cn(
                        "w-full px-1 py-0.5 text-sm font-bold transition-colors text-left flex items-start gap-1 cursor-pointer group/note",
                        "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                      )}
                    >
                      <GripVertical className={cn("h-3 w-3 flex-shrink-0 mt-0.5 opacity-30", canDragNote && "group-hover:opacity-60")} />

                      {/* Flex container to wrap the badges smoothly */}
                      <div className="flex flex-wrap items-center flex-1 gap-1.5 leading-tight">
                        {/* Display StickyNote only if there is text, or if no other icon exists */}
                        {(note.text || (!note.weather_condition && !note.vehicle_ids?.length && !note.equipment_ids?.length)) && (
                          <StickyNote className="h-3 w-3 flex-shrink-0 inline-block align-middle" />
                        )}

                        {getWeatherEmoji(note.weather_condition) && (
                          <span title={`Météo: ${note.weather_condition}`} className="inline-block">
                            {getWeatherEmoji(note.weather_condition)}
                          </span>
                        )}

                        {note.vehicle_ids && note.vehicle_ids.length > 0 && (
                          <span title={`${note.vehicle_ids.length} véhicule(s)`} className="flex items-center text-blue-700 dark:text-blue-400">
                            <Car className="h-3.5 w-3.5 inline-block" />
                            {note.vehicle_ids.length > 1 && <span className="text-[10px] ml-0.5">{note.vehicle_ids.length}</span>}
                          </span>
                        )}

                        {note.equipment_ids && note.equipment_ids.length > 0 && (
                          <span title={`${note.equipment_ids.length} matériel(s)`} className="flex items-center text-orange-700 dark:text-orange-400">
                            <Wrench className="h-3.5 w-3.5 inline-block" />
                            {note.equipment_ids.length > 1 && <span className="text-[10px] ml-0.5">{note.equipment_ids.length}</span>}
                          </span>
                        )}

                        <span className="break-words">
                          {note.text}
                        </span>
                      </div>
                    </div>
                  </div>
                </NoteContextMenu>
              );
            })}
          </div>
        )}

        {/* Assignments section */}
        {limitedAssignments.length > 0 && (
          <div className="flex-1 flex flex-col justify-stretch gap-0.5">
            {isAdmin && maxAssignmentsPerPeriod > 0 && limitedAssignments.length > 1 && (
              <div className="flex justify-end mb-0.5">
                <span
                  className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded",
                    limitedAssignments.length >= maxAssignmentsPerPeriod
                      ? "bg-destructive/20 text-destructive"
                      : limitedAssignments.length >= maxAssignmentsPerPeriod - 1
                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                        : "bg-muted text-muted-foreground"
                  )}
                  title={`${limitedAssignments.length} affectation(s) sur ${maxAssignmentsPerPeriod} maximum`}
                >
                  {limitedAssignments.length}/{maxAssignmentsPerPeriod}
                </span>
              </div>
            )}
            {limitedAssignments.map((assignment, index) => {
              const commande = commandes.find(c => c.id === assignment.commandeId);
              const hasAddress = commande?.chantier;
              const draggable = canDrag(assignment);
              const isDragged = isBeingDragged(assignment);
              const canMoveUp = index > 0;
              const canMoveDown = index < limitedAssignments.length - 1;
              const linkedTechName = getLinkedTechnicianName(assignment);
              const isHighlighted = highlightedGroupId && assignment.assignment_group_id === highlightedGroupId;

              const handleCopyToClipboard = (a: Assignment) => {
                const displayName = getAssignmentDisplayName(a, commandes);
                navigator.clipboard.writeText(displayName);
                toast.success('Copié dans le presse-papiers');
              };

              const handleMouseEnter = () => {
                if (linkedTechName && assignment.assignment_group_id && onHighlightGroup) {
                  onHighlightGroup(assignment.assignment_group_id);
                }
              };

              const handleMouseLeave = () => {
                if (linkedTechName && onHighlightGroup) {
                  onHighlightGroup(null);
                }
              };

              return (
                <AssignmentContextMenu
                  key={assignment.id || index}
                  assignment={assignment}
                  commandes={commandes}
                  onEdit={onAssignmentClick}
                  onDuplicate={onAssignmentDuplicate}
                  onCopyToClipboard={handleCopyToClipboard}
                  onDelete={onAssignmentDelete}
                  disabled={!isAdmin}
                >
                  <div
                    className={cn(
                      "relative group/assignment transition-all",
                      isDragged && "opacity-40 ring-2 ring-dashed ring-primary",
                      isHighlighted && "ring-2 ring-primary ring-offset-1 shadow-lg scale-[1.02]"
                    )}
                    draggable={draggable}
                    onDragStart={(e) => {
                      if (draggable && onDragStart && cellDate && cellTechnicianId) {
                        onDragStart(e, assignment, cellDate, cellTechnicianId);
                      }
                    }}
                    onDragEnd={onDragEnd}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onAssignmentClick) onAssignmentClick(assignment);
                      }}
                      className={cn(
                        "w-full h-full px-2 py-1.5 transition-all hover:shadow-md rounded text-lg font-medium leading-tight",
                        "flex items-center justify-center text-center relative",
                        draggable && "cursor-grab active:cursor-grabbing",
                        getAssignmentClasses(assignment),
                        absentTechNames.length > 0 && "bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,0,0,0.1)_10px,rgba(255,0,0,0.1)_20px)]"
                      )}
                      style={{
                        minHeight: '36px',
                        backgroundColor: (teamColor) ? teamColor : undefined
                      }}
                    >
                      {isAdmin && (
                        <span title={!draggable ? "Non déplaçable (confirmé ou facturé)" : "Glisser pour déplacer"}>
                          <GripVertical
                            className={cn(
                              "absolute top-1/2 -translate-y-1/2 left-0.5 h-4 w-4",
                              draggable
                                ? "opacity-30 group-hover/assignment:opacity-60"
                                : "opacity-10 cursor-not-allowed"
                            )}
                          />
                        </span>
                      )}
                      {linkedTechName && (
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="absolute bottom-0.5 left-5 flex items-center gap-0.5 px-1 py-0.5 rounded bg-primary/90 text-primary-foreground shadow-sm z-10 opacity-0 group-hover/assignment:opacity-100 transition-opacity">
                                <Link2 className="h-3 w-3" />
                                <span className="text-[9px] font-semibold max-w-[50px] truncate">{linkedTechName}</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Lié avec : {linkedTechName}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {!draggable && isAdmin && (
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="absolute bottom-1 right-1 flex items-center justify-center">
                                {assignment.isConfirmed ? (
                                  <span className={cn(
                                    "flex items-center justify-center w-3 h-3 text-white font-bold text-[10px] rounded-sm shadow-sm",
                                    commande?.client_presence === 'P+RDV' ? "bg-green-600" : "bg-blue-500"
                                  )}>
                                    {commande?.client_presence === 'P+RDV' ? 'R' : 'P'}
                                  </span>
                                ) : (
                                  <Lock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {assignment.isConfirmed
                                ? (commande?.client_presence === 'P+RDV' ? "Présent + RDV" : "Prévenu")
                                : "Verrouillé"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <div className="flex flex-col text-left justify-center flex-1 py-1">
                        {absentTechNames.length > 0 && (
                          <span className="text-red-600 font-bold text-[10px] leading-tight mb-0.5 bg-white/70 px-1 rounded w-fit">
                            Absence {absentTechNames.join(', ')}
                          </span>
                        )}
                        <span className="whitespace-pre-wrap break-words leading-tight">
                          {getAssignmentDisplayName(assignment, commandes)}
                        </span>
                        {assignment.comment && (
                          <span className="text-[10px] italic opacity-80 mt-0.5 leading-tight whitespace-pre-wrap break-words">
                            {assignment.comment}
                          </span>
                        )}
                      </div>
                    </button>
                    {hasAddress && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hasAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-0.5 right-0.5 opacity-0 group-hover/assignment:opacity-100 transition-opacity p-0.5 bg-background rounded shadow-sm hover:bg-accent"
                        title="Ouvrir dans Google Maps"
                      >
                        <MapPin className="h-3 w-3" />
                      </a>
                    )}
                    {isAdmin && limitedAssignments.length > 1 && (onAssignmentMoveUp || onAssignmentMoveDown) && (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover/assignment:opacity-100 transition-opacity z-10">
                        {canMoveUp && onAssignmentMoveUp && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAssignmentMoveUp(assignment);
                            }}
                            className="p-0.5 bg-background/80 rounded shadow-sm hover:bg-accent border border-border/50"
                            title="Monter"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                        )}
                        {canMoveDown && onAssignmentMoveDown && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAssignmentMoveDown(assignment);
                            }}
                            className="p-0.5 bg-background/80 rounded shadow-sm hover:bg-accent border border-border/50"
                            title="Descendre"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </AssignmentContextMenu>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};