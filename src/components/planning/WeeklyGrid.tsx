import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TechnicianHeaderCell } from '@/components/TechnicianHeaderCell';
import { DayHeaderCell } from '@/components/DayHeaderCell';
import { AssignmentCell } from '@/components/AssignmentCell';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

export interface WeeklyGridProps {
  dailyTeamRosters: any[];
  onManageDailyTeam?: (teamName: string, date: string) => void;
  displayTeams: any[];
  activeTechnicians: any[];
  weekDates: any[];
  notes: any[];
  absences: any[];
  commandes: any[];

  isAdmin: boolean;
  maxAssignments: number;
  allAssignmentsFormatted: any[];

  getGeneralNotesForDate: (date: string) => any[];
  getAssignmentsForCell: (teamId: string, date: string) => any[];

  handleAddGeneralNote: (date: string) => void;
  handleGeneralNoteClick: (note: any, date: string) => void;

  saveNote: any;
  handleDeleteNote: (id: string) => void;

  handleCellClick: (teamId: string, date: string) => void;
  handleAddAssignment: (teamId: string, date: string) => void;
  handleAssignmentClick: (assignment: any) => void;
  handleDuplicateAssignment: (id: string) => void;
  handleDeleteAssignment: (id: string) => void;

  isDraggable: (assignment: any) => boolean;
  handleDragStart: (e: React.DragEvent, assignment: any, date: string, teamId: string) => void;
  handleDragOver: (e: React.DragEvent, teamId: string, date: string) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, teamId: string, date: string) => void;
  handleDragEnd: () => void;
  dropTarget: any;
  previewCells: any[];
  draggedItem: any;

  highlightedGroupId: string | null;
  setHighlightedGroupId: (id: string | null) => void;
  handleTechDayNoteClick?: (note: any, technicianId: string, technicianName: string, date: string) => void;
  handleAddTechDayNote?: (teamId: string, teamName: string, date: string) => void;
}

const getPastelColor = (hex: string | undefined) => {
  if (!hex || typeof hex !== 'string') return undefined;

  let fullHex = hex;
  if (hex.length === 4 && hex.startsWith('#')) {
    fullHex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }

  if (!fullHex.startsWith('#') || fullHex.length !== 7) return 'transparent';

  const r = parseInt(fullHex.slice(1, 3), 16);
  const g = parseInt(fullHex.slice(3, 5), 16);
  const b = parseInt(fullHex.slice(5, 7), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) return 'transparent';
  return `rgba(${r}, ${g}, ${b}, 0.15)`;
};

// THIS IS THE CRUCIAL LINE: export const WeeklyGrid
export const WeeklyGrid: React.FC<WeeklyGridProps> = ({
  dailyTeamRosters,
  onManageDailyTeam,
  displayTeams,
  activeTechnicians,
  weekDates,
  notes,
  absences,
  commandes,
  isAdmin,
  maxAssignments,
  allAssignmentsFormatted,
  getGeneralNotesForDate,
  getAssignmentsForCell,
  handleAddGeneralNote,
  handleGeneralNoteClick,
  saveNote,
  handleDeleteNote,
  handleCellClick,
  handleAddAssignment,
  handleAssignmentClick,
  handleDuplicateAssignment,
  handleDeleteAssignment,
  isDraggable,
  handleDragStart,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleDragEnd,
  dropTarget,
  previewCells,
  draggedItem,
  highlightedGroupId,
  setHighlightedGroupId,
  handleTechDayNoteClick,
  handleAddTechDayNote,
}) => {
  return (
    <div className="overflow-x-auto pb-0 flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="min-w-[1200px] lg:min-w-0 flex-1 flex flex-col">
        {/* ── Header Row (Days) ── */}
        <div
          className="grid border-b-2 border-border bg-muted/50 shrink-0"
          style={{ gridTemplateColumns: `220px repeat(${weekDates.length}, minmax(200px, 1fr))` }}
        >
          <div className="p-2 sm:p-4 border-r border-border bg-primary/5" />

          {weekDates.map((day) => {
            const generalNotesForDay = getGeneralNotesForDate(day.fullDate);
            const dayLabel = day.date.charAt(0).toUpperCase() + day.date.slice(1);
            return (
              <div key={day.fullDate} className="border-r border-border bg-primary/5">
                <DayHeaderCell
                  dayDate={day.fullDate}
                  dayLabel={dayLabel}
                  generalNotes={generalNotesForDay}
                  isAdmin={isAdmin}
                  onAddNote={() => handleAddGeneralNote(day.fullDate)}
                  onNoteClick={(note) => handleGeneralNoteClick(note, day.fullDate)}
                  onNoteDuplicate={(note) => {
                    saveNote.mutate({
                      text: note.text,
                      team_id: null,
                      start_date: day.fullDate,
                      end_date: day.fullDate,
                    }, {
                      onSuccess: () => toast.success('Note dupliquée'),
                      onError: () => toast.error('Erreur lors de la duplication'),
                    });
                  }}
                  onNoteDelete={handleDeleteNote}
                  fullNotes={notes.filter(n => n.team_id === null).map(n => ({
                    id: n.id,
                    text: n.text,
                    team_id: n.team_id,
                    start_date: n.start_date,
                    end_date: n.end_date || n.start_date,
                  }))}
                />
              </div>
            );
          })}
        </div>

        {/* ── Team Rows ── */}
        <div className="flex-1 flex flex-col min-h-[600px]">
          {displayTeams.map((team) => {
            return (
              <div
                key={team.id}
                className="grid border-b border-border transition-colors flex-1"
                style={{
                  gridTemplateColumns: `220px repeat(${weekDates.length}, minmax(200px, 1fr))`,
                  backgroundColor: getPastelColor(team.color)
                }}
              >
                <div
                  className="p-3 sm:p-4 text-center border-r border-border flex flex-col justify-center gap-2 transition-colors"
                  style={{ backgroundColor: getPastelColor(team.color) }}
                >
                  <TechnicianHeaderCell
                    name={team.name}
                    isArchived={false}
                    backgroundColor={team.color}
                  />
                </div>

                {weekDates.map((day) => {
                  const dayRosters = dailyTeamRosters?.filter(r => r.team_name === team.name && r.date === day.fullDate) || [];

                  const isDropTarget = dropTarget?.teamId === team.id && dropTarget?.date === day.fullDate;
                  const isPreview = previewCells.some(c => c.teamId === team.id && c.date === day.fullDate);

                  const cellAssignments = getAssignmentsForCell(team.id, day.fullDate);
                  const cellNotes = notes.filter(n =>
                    n.team_id === team.id &&
                    n.start_date <= day.fullDate &&
                    (n.end_date || n.start_date) >= day.fullDate
                  );

                  return (
                    <div
                      key={day.fullDate}
                      className={[
                        'border-r border-border relative group/daycell flex flex-col',
                        'hover:brightness-95 transition-all',
                        isDropTarget ? 'ring-2 ring-inset ring-primary' : '',
                        isPreview ? 'bg-primary/5' : '',
                      ].join(' ')}
                      style={{
                        minHeight: 'auto',
                        backgroundColor: team.color && !isPreview ? getPastelColor(team.color) : undefined
                      }}
                      onDragOver={isAdmin ? (e) => handleDragOver(e, team.id, day.fullDate) : undefined}
                      onDragLeave={isAdmin ? handleDragLeave : undefined}
                      onDrop={isAdmin ? (e) => handleDrop(e, team.id, day.fullDate) : undefined}
                      onClick={isAdmin ? () => handleCellClick(team.id, day.fullDate) : undefined}
                    >

                      {/* Display today's assigned technicians */}
                      <div
                        className="flex flex-wrap gap-1 p-1 min-h-[28px] bg-black/5 border-b border-black/5 cursor-pointer hover:bg-black/10 transition-colors relative z-20"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAdmin && onManageDailyTeam) {
                            onManageDailyTeam(team.name, day.fullDate);
                          }
                        }}
                        title="Cliquez pour modifier l'équipe"
                      >
                        {dayRosters.length > 0 ? (
                          <TooltipProvider delayDuration={300}>
                            {dayRosters.map(roster => {
                              // Check if this SPECIFIC technician is absent today
                              const isAbsent = absences?.some(a =>
                                a.technician_id === roster.technician?.id &&
                                a.start_date <= day.fullDate &&
                                a.end_date >= day.fullDate
                              );

                              return (
                                <Tooltip key={roster.id}>
                                  <TooltipTrigger asChild>
                                    <span className={`
                                      text-[10px] rounded px-1.5 py-0.5 font-medium truncate max-w-[90px] cursor-help shadow-sm 
                                      ${isAbsent
                                        ? 'bg-red-600 text-white line-through decoration-black/50 decoration-2'
                                        : roster.is_team_leader
                                          ? 'bg-primary text-primary-foreground'
                                          : 'bg-black/30 text-black'}
                                    `}>
                                      {roster.is_team_leader && !isAbsent ? '⭐ ' : ''}
                                      {roster.technician?.name}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">
                                    <p className="font-semibold">{roster.technician?.name}</p>
                                    {isAbsent && <p className="text-red-500 font-bold mt-1">ABSENT</p>}
                                    {roster.is_team_leader && !isAbsent && <p className="text-primary mt-1">Chef d'équipe</p>}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </TooltipProvider>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/70 italic px-1 pt-0.5">Aucun technicien</span>
                        )}
                      </div>

                      <div className="flex-1 relative">
                        <AssignmentCell
                          absentTechNames={[]}
                          assignments={cellAssignments}
                          notes={cellNotes}
                          teamColor={team.color}
                          onClick={undefined}
                          onNoteClick={handleTechDayNoteClick ? (noteId) => {
                            const note = cellNotes.find(n => n.id === noteId);
                            if (note) {
                              handleTechDayNoteClick(note, note.team_id || '', team.name, day.fullDate);
                            }
                          } : undefined}
                          onAddNote={isAdmin && handleAddTechDayNote ? () => handleAddTechDayNote(team.id, team.name, day.fullDate) : undefined}
                          onAddAssignment={isAdmin ? () => handleAddAssignment(team.id, day.fullDate) : undefined}
                          onAssignmentClick={isAdmin ? handleAssignmentClick : undefined}
                          onAssignmentDuplicate={isAdmin ? (a) => handleDuplicateAssignment(a.id) : undefined}
                          onAssignmentDelete={isAdmin ? (a) => handleDeleteAssignment(a.id) : undefined}
                          commandes={commandes}
                          isAdmin={isAdmin}
                          maxAssignmentsPerPeriod={maxAssignments}
                          cellDate={day.fullDate}
                          cellTechnicianId={team.id}
                          isDraggable={isAdmin ? isDraggable : undefined}
                          onDragStart={isAdmin ? (e, a) => handleDragStart(e, a, day.fullDate, team.id) : undefined}
                          draggedAssignmentId={draggedItem?.assignment?.id}
                          draggedGroupId={draggedItem?.assignment?.assignment_group_id}
                          allAssignments={allAssignmentsFormatted}
                          technicians={activeTechnicians.map(t => ({ id: t.id, name: t.name }))}
                          highlightedGroupId={highlightedGroupId}
                          onHighlightGroup={setHighlightedGroupId}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};