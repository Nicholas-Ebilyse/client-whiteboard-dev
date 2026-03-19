import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TechnicianHeaderCell } from '@/components/TechnicianHeaderCell';
import { DayHeaderCell } from '@/components/DayHeaderCell';
import { AssignmentCell } from '@/components/AssignmentCell';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface WeeklyGridProps {
  // Rows: Teams (not individual technicians)
  displayTeams: any[];
  // Still needed for absence checks and TechnicianManagement
  activeTechnicians: any[];
  weekDates: any[];
  notes: any[];
  absences: any[];
  commandes: any[];
  chantiers: any[];
  isAdmin: boolean;
  maxAssignments: number;
  allAssignmentsFormatted: any[];

  // Data getters — NO period arg
  getGeneralNotesForDate: (date: string) => any[];
  getAssignmentsForCell: (teamId: string, date: string) => any[];

  // Day / General Notes Actions
  handleAddGeneralNote: (date: string) => void;
  handleGeneralNoteClick: (note: any, date: string) => void;

  // Shared Note Actions
  saveNote: any;
  handleDeleteNote: (id: string) => void;
  handleToggleNoteConfirm: (id: string, currentStatus: boolean) => void;

  // Cell Level Actions — NO period arg
  handleCellClick: (teamId: string, date: string) => void;
  handleAddAssignment: (teamId: string, date: string) => void;
  handleAssignmentClick: (assignment: any) => void;
  handleDuplicateAssignment: (id: string) => void;
  handleDeleteAssignment: (id: string) => void;

  // Assignment Drag & Drop — NO period arg
  isDraggable: (assignment: any) => boolean;
  handleDragStart: (e: React.DragEvent, assignment: any, date: string, teamId: string) => void;
  handleDragOver: (e: React.DragEvent, teamId: string, date: string) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, teamId: string, date: string) => void;
  handleDragEnd: () => void;
  dropTarget: any;
  previewCells: any[];
  draggedItem: any;

  // Highlighting
  highlightedGroupId: string | null;
  setHighlightedGroupId: (id: string | null) => void;
}

const getPastelColor = (hex: string | undefined) => {
  if (!hex || typeof hex !== 'string') return undefined;
  
  // Handle 3-char hex (#RGB) -> (#RRGGBB)
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

export const WeeklyGrid: React.FC<WeeklyGridProps> = ({
  displayTeams,
  activeTechnicians,
  weekDates,
  notes,
  absences,
  commandes,
  chantiers,
  isAdmin,
  maxAssignments,
  allAssignmentsFormatted,
  getGeneralNotesForDate,
  getAssignmentsForCell,
  handleAddGeneralNote,
  handleGeneralNoteClick,
  saveNote,
  handleDeleteNote,
  handleToggleNoteConfirm,
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
}) => {
  return (
    <div className="overflow-x-auto pb-8">
      <div className="min-w-[1200px] lg:min-w-0">
        {/* ── Header Row (Days) ── */}
        <div
          className="grid border-b-2 border-border bg-muted/50"
          style={{ gridTemplateColumns: `220px repeat(${weekDates.length}, minmax(200px, 1fr))` }}
        >
          {/* Top-left admin cell (Blank) */}
          <div className="p-2 sm:p-4 border-r border-border bg-primary/5" />

          {/* Day column headers — no Matin/Après-midi */}
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
                      technician_id: null,
                      start_date: day.fullDate,
                      end_date: day.fullDate,
                      is_sav: note.is_sav,
                    }, {
                      onSuccess: () => toast.success('Note dupliquée'),
                      onError: () => toast.error('Erreur lors de la duplication'),
                    });
                  }}
                  onNoteDelete={handleDeleteNote}
                  onNoteToggleConfirm={isAdmin ? handleToggleNoteConfirm : undefined}
                  fullNotes={notes.filter(n => n.technician_id === null).map(n => ({
                    id: n.id,
                    text: n.text,
                    is_sav: n.is_sav,
                    technician_id: n.technician_id,
                    start_date: n.start_date,
                    end_date: n.end_date || n.start_date,
                  }))}
                />
              </div>
            );
          })}
        </div>

        {/* ── Team Rows ── */}
        {displayTeams.map((team) => {
          // Technicians belonging to this team
          const teamTechs = activeTechnicians.filter(t => t.team_id === team.id);

          return (
            <div
              key={team.id}
              className="grid border-b border-border transition-colors"
              style={{ 
                gridTemplateColumns: `220px repeat(${weekDates.length}, minmax(200px, 1fr))`,
                backgroundColor: getPastelColor(team.color)
              }}
            >
              {/* Row Header: Team name */}
              <div
                className="p-3 sm:p-4 text-center border-r border-border flex flex-col justify-center gap-2 transition-colors"
                style={{ backgroundColor: getPastelColor(team.color) }}
              >
                <TechnicianHeaderCell
                  name={team.name}
                  isArchived={false}
                  backgroundColor={team.color}
                />
                {/* List member technicians */}
                {teamTechs.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 justify-center">
                    <TooltipProvider delayDuration={300}>
                      {teamTechs.map(t => (
                        <Tooltip key={t.id}>
                          <TooltipTrigger asChild>
                            <span className="text-[11px] bg-black/25 text-white rounded px-1.5 py-0.5 font-medium truncate max-w-[100px] cursor-help shadow-sm">
                              {t.name}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[200px] text-xs">
                            <p className="font-semibold">{t.name}</p>
                            {t.skills && <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{t.skills}</p>}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </TooltipProvider>
                  </div>
                )}
              </div>

              {/* Day cells — one unified cell per day, no period split */}
              {weekDates.map((day) => {
                // Absence: block if ANY technician in this team is absent this day
                const absentTechs = teamTechs.filter(tech =>
                  absences?.some(a =>
                    a.technician_id === tech.id &&
                    a.start_date <= day.fullDate &&
                    a.end_date >= day.fullDate
                  )
                );
                const teamIsUnavailable = absentTechs.length > 0;
                const absentTechNames = absentTechs.map(t => t.name);
                const cellAssignments = getAssignmentsForCell(team.id, day.fullDate);

                const isDropTarget = dropTarget?.teamId === team.id && dropTarget?.date === day.fullDate;
                const isPreview = previewCells.some(c => c.teamId === team.id && c.date === day.fullDate);

                return (
                  <div
                    key={day.fullDate}
                    className={[
                      'border-r border-border relative group/daycell',
                      'hover:brightness-95 transition-all',
                      teamIsUnavailable
                        ? 'bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.05)_10px,rgba(0,0,0,0.05)_20px)]'
                        : '',
                      isDropTarget ? 'ring-2 ring-inset ring-primary' : '',
                      isPreview ? 'bg-primary/5' : '',
                    ].join(' ')}
                    style={{ 
                      minHeight: '120px', 
                      backgroundColor: team.color && !teamIsUnavailable && !isPreview ? getPastelColor(team.color) : undefined 
                    }}
                    onDragOver={isAdmin && !teamIsUnavailable ? (e) => handleDragOver(e, team.id, day.fullDate) : undefined}
                    onDragLeave={isAdmin ? handleDragLeave : undefined}
                    onDrop={isAdmin && !teamIsUnavailable ? (e) => handleDrop(e, team.id, day.fullDate) : undefined}
                    onClick={isAdmin && !teamIsUnavailable ? () => handleCellClick(team.id, day.fullDate) : undefined}
                  >
                    {teamIsUnavailable && cellAssignments.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                        <span className="text-xs text-muted-foreground/60 font-medium bg-background/70 px-2 py-0.5 rounded text-red-600/80">
                          Absence {absentTechNames.join(', ')}
                        </span>
                      </div>
                    )}

                    <AssignmentCell
                      absentTechNames={absentTechNames}
                      assignments={cellAssignments}
                      notes={[]}
                      teamColor={team.color}
                      onClick={undefined} // cell-level click handled by outer div
                      onNoteClick={undefined}
                      onAddAssignment={isAdmin && !teamIsUnavailable ? () => handleAddAssignment(team.id, day.fullDate) : undefined}
                      onAssignmentClick={isAdmin ? handleAssignmentClick : undefined}
                      onAssignmentDuplicate={isAdmin ? (a) => handleDuplicateAssignment(a.id) : undefined}
                      onAssignmentDelete={isAdmin ? (a) => handleDeleteAssignment(a.id) : undefined}
                      commandes={commandes}
                      chantiers={chantiers}
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
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
