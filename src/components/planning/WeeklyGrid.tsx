import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TechnicianHeaderCell } from '@/components/TechnicianHeaderCell';
import { DayHeaderCell } from '@/components/DayHeaderCell';
import { TechnicianDayCell } from '@/components/TechnicianDayCell';
import { PeriodCell } from '@/components/PeriodCell';
import { AssignmentCell } from '@/components/AssignmentCell';
import { toast } from 'sonner';

interface WeeklyGridProps {
  displayTechnicians: any[];
  activeTechnicians: any[];
  weekDates: any[];
  periods: string[];
  notes: any[];
  commandes: any[];
  chantiers: any[];
  isAdmin: boolean;
  maxAssignments: number;
  allAssignmentsFormatted: any[];

  // Notes data getters
  getGeneralNotesForDate: (date: string) => any[];
  getDayNotesForTechnician: (techId: string, date: string) => any[];
  getAssignmentsForCell: (techId: string, date: string, period: string) => any[];
  getNotesForCell: (techId: string, date: string, period: string) => any[];

  // Header Actions
  setManageTechsDialogOpen: (open: boolean) => void;

  // Day / General Notes Actions
  handleAddGeneralNote: (date: string, period: string) => void;
  handleGeneralNoteClick: (note: any, date: string) => void;
  
  // Tech Day Notes Actions
  handleAddTechDayNote: (techId: string, techName: string, date: string) => void;
  handleTechDayNoteClick: (note: any, techId: string, techName: string, date: string) => void;

  // Shared Note Actions
  saveNote: any; // mutation object
  handleDeleteNote: (id: string) => void;
  handleToggleNoteConfirm: (id: string, currentStatus: boolean) => void;
  
  // Note Drag & Drop
  handleNoteDragStart: (e: React.DragEvent, note: any) => void;
  handleNoteDragOver: (e: React.DragEvent, techId: string | null, date: string, period: string) => void;
  handleNoteDrop: (e: React.DragEvent, techId: string | null, date: string, period: string) => void;
  handleNoteDragEnd: () => void;
  noteDropTarget: any;
  isNoteDragging: boolean;

  // Cell Level Actions
  handleCellClick: (techId: string, date: string, period: string) => void;
  handleNoteClick: (noteId: string) => void;
  handleToggleNoteDisplayBelow: (noteId: string, currentStatus: boolean) => void;
  handleBulkToggleNotesDisplayBelow: (noteIds: string[], showBelow: boolean) => void;
  handleAddNote: (techId: string, date: string, period: string) => void;
  handleAddAssignment: (techId: string, date: string, period: string) => void;
  handleAssignmentClick: (assignment: any) => void;
  handleDuplicateAssignment: (id: string) => void;
  handleDeleteAssignment: (id: string) => void;
  handleAssignmentMoveUp: (assignment: any, techId: string, date: string, period: string) => void;
  handleAssignmentMoveDown: (assignment: any, techId: string, date: string, period: string) => void;

  // Assignment Drag & Drop
  isDraggable: (assignment: any) => boolean;
  handleDragStart: (e: React.DragEvent, assignment: any, date: string, period: string, techId: string) => void;
  handleDragOver: (e: React.DragEvent, techId: string, date: string, period: string) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, techId: string, date: string, period: string) => void;
  handleDragEnd: () => void;
  dropTarget: any;
  previewCells: any[];
  draggedItem: any;

  // Highlighting
  highlightedGroupId: string | null;
  setHighlightedGroupId: (id: string | null) => void;
}

export const WeeklyGrid: React.FC<WeeklyGridProps> = ({
  displayTechnicians,
  activeTechnicians,
  weekDates,
  periods,
  notes,
  commandes,
  chantiers,
  isAdmin,
  maxAssignments,
  allAssignmentsFormatted,
  getGeneralNotesForDate,
  getDayNotesForTechnician,
  getAssignmentsForCell,
  getNotesForCell,
  setManageTechsDialogOpen,
  handleAddGeneralNote,
  handleGeneralNoteClick,
  handleAddTechDayNote,
  handleTechDayNoteClick,
  saveNote,
  handleDeleteNote,
  handleToggleNoteConfirm,
  handleNoteDragStart,
  handleNoteDragOver,
  handleNoteDrop,
  handleNoteDragEnd,
  noteDropTarget,
  isNoteDragging,
  handleCellClick,
  handleNoteClick,
  handleToggleNoteDisplayBelow,
  handleBulkToggleNotesDisplayBelow,
  handleAddNote,
  handleAddAssignment,
  handleAssignmentClick,
  handleDuplicateAssignment,
  handleDeleteAssignment,
  handleAssignmentMoveUp,
  handleAssignmentMoveDown,
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
    <div className="overflow-x-auto">
      <div className="min-w-[900px] lg:min-w-0">
        {/* Header Row */}
        <div 
          className="grid border-b-2 border-border bg-muted/50"
          style={{ gridTemplateColumns: `150px repeat(${displayTechnicians.length}, minmax(150px, 1fr))` }}
        >
          <div className="p-2 sm:p-3 border-r border-border flex items-center justify-center">
            {isAdmin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setManageTechsDialogOpen(true)}
                      className="px-3 py-2 text-xs sm:text-sm font-medium text-foreground bg-primary hover:bg-primary/90 rounded border border-border transition-colors"
                    >
                      Gérer techs
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Gérer les techniciens</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {displayTechnicians.map((tech, index) => {
            const bgColor = index >= 4 && index % 2 === 1 ? 'hsl(var(--muted) / 0.5)' : (index >= 4 ? 'hsl(var(--muted) / 0.3)' : tech.color);
            return (
              <div 
                key={tech.id}
                className="p-3 sm:p-4 text-center border-r border-border last:border-r-0"
                style={{ 
                  backgroundColor: bgColor,
                  minHeight: '60px'
                }}
              >
                <TechnicianHeaderCell
                  name={tech.name}
                  isArchived={tech.is_archived}
                  backgroundColor={bgColor}
                />
              </div>
            );
          })}
        </div>

        {/* Days and Periods */}
        {weekDates.map((day) => {
          const generalNotesForDay = getGeneralNotesForDate(day.fullDate);
          return (
            <div key={day.fullDate}>
              {/* Day Header Row */}
              <div 
                className="grid bg-primary/10 border-b border-border"
                style={{ gridTemplateColumns: `150px repeat(${displayTechnicians.length}, minmax(150px, 1fr))` }}
              >
                <DayHeaderCell
                  dayDate={day.fullDate}
                  dayLabel={day.date.charAt(0).toUpperCase() + day.date.slice(1)}
                  generalNotes={generalNotesForDay}
                  isAdmin={isAdmin}
                  onAddNote={() => handleAddGeneralNote(day.fullDate, 'Journée')}
                  onNoteClick={(note) => handleGeneralNoteClick(note, day.fullDate)}
                  onNoteDuplicate={(note) => {
                    saveNote.mutate({
                      text: note.text,
                      technician_id: null,
                      start_date: day.fullDate,
                      end_date: day.fullDate,
                      period: 'Matin',
                      start_period: 'Matin',
                      end_period: 'Après-midi',
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
                    start_period: n.start_period || n.period || 'Matin',
                    end_period: n.end_period || n.period || 'Après-midi',
                  }))}
                  onNoteDragStart={isAdmin ? handleNoteDragStart : undefined}
                  onNoteDragOver={isAdmin ? handleNoteDragOver : undefined}
                  onNoteDrop={isAdmin ? handleNoteDrop : undefined}
                  onNoteDragEnd={isAdmin ? handleNoteDragEnd : undefined}
                  noteDropTarget={noteDropTarget}
                  isNoteDragging={isNoteDragging}
                />
                {displayTechnicians.map((tech) => (
                  <div key={tech.id} className="border-r border-border last:border-r-0">
                    <TechnicianDayCell
                      technicianId={tech.id}
                      technicianName={tech.name}
                      date={day.fullDate}
                      dayNotes={getDayNotesForTechnician(tech.id, day.fullDate)}
                      isAdmin={isAdmin}
                      onAddNote={() => handleAddTechDayNote(tech.id, tech.name, day.fullDate)}
                      onNoteClick={(note) => handleTechDayNoteClick(note, tech.id, tech.name, day.fullDate)}
                      onNoteDuplicate={(note) => {
                        saveNote.mutate({
                          text: note.text,
                          technician_id: tech.id,
                          start_date: day.fullDate,
                          end_date: day.fullDate,
                          period: 'Matin',
                          start_period: 'Matin',
                          end_period: 'Après-midi',
                          is_sav: note.is_sav,
                        }, {
                          onSuccess: () => toast.success('Note dupliquée'),
                          onError: () => toast.error('Erreur lors de la duplication'),
                        });
                      }}
                      onNoteDelete={handleDeleteNote}
                      onNoteToggleConfirm={isAdmin ? handleToggleNoteConfirm : undefined}
                      fullNotes={notes.filter(n => n.technician_id === tech.id).map(n => ({
                        id: n.id,
                        text: n.text,
                        is_sav: n.is_sav,
                        technician_id: n.technician_id,
                        start_date: n.start_date,
                        end_date: n.end_date || n.start_date,
                        start_period: n.start_period || n.period || 'Matin',
                        end_period: n.end_period || n.period || 'Après-midi',
                      }))}
                      onNoteDragStart={isAdmin ? handleNoteDragStart : undefined}
                      onNoteDragOver={isAdmin ? handleNoteDragOver : undefined}
                      onNoteDrop={isAdmin ? handleNoteDrop : undefined}
                      onNoteDragEnd={isAdmin ? handleNoteDragEnd : undefined}
                      noteDropTarget={noteDropTarget}
                      isNoteDragging={isNoteDragging}
                    />
                  </div>
                ))}
              </div>

              {/* Periods Rows (Matin/Après-midi) */}
              {periods.map((period) => (
                <div
                  key={`${day.fullDate}-${period}`}
                  className="grid border-b border-border last:border-b-0"
                  style={{ gridTemplateColumns: `150px repeat(${displayTechnicians.length}, minmax(150px, 1fr))` }}
                >
                  <PeriodCell
                    period={period}
                    dayDate={day.fullDate}
                    generalNotes={generalNotesForDay}
                    isAdmin={isAdmin}
                    onAddNote={() => handleAddGeneralNote(day.fullDate, period as 'Matin' | 'Après-midi')}
                    onNoteClick={(note) => handleGeneralNoteClick(note, day.fullDate)}
                    onNoteDuplicate={(note) => {
                      saveNote.mutate({
                        text: note.text,
                        technician_id: null,
                        start_date: day.fullDate,
                        end_date: day.fullDate,
                        period: period,
                        start_period: period,
                        end_period: period,
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
                      start_period: n.start_period || n.period || 'Matin',
                      end_period: n.end_period || n.period || 'Après-midi',
                    }))}
                    onNoteDragStart={isAdmin ? handleNoteDragStart : undefined}
                    onNoteDragOver={isAdmin ? handleNoteDragOver : undefined}
                    onNoteDrop={isAdmin ? handleNoteDrop : undefined}
                    onNoteDragEnd={isAdmin ? handleNoteDragEnd : undefined}
                    noteDropTarget={noteDropTarget}
                    isNoteDragging={isNoteDragging}
                  />
                  {displayTechnicians.map((tech, index) => {
                    const bgColor = index >= 4 && index % 2 === 1 ? 'hsl(var(--muted) / 0.5)' : (index >= 4 ? 'hsl(var(--muted) / 0.3)' : tech.color);
                    return (
                      <div 
                        key={tech.id} 
                        className="border-r border-border last:border-r-0"
                        style={{ backgroundColor: bgColor }}
                      >
                        <AssignmentCell
                          assignments={getAssignmentsForCell(tech.id, day.fullDate, period)}
                          notes={getNotesForCell(tech.id, day.fullDate, period)}
                          teamColor={bgColor}
                          onClick={isAdmin ? () => handleCellClick(tech.id, day.fullDate, period) : undefined}
                          onNoteClick={isAdmin ? handleNoteClick : undefined}
                          onNoteDuplicate={isAdmin ? (note) => {
                            saveNote.mutate({
                              text: note.text,
                              technician_id: tech.id,
                              start_date: day.fullDate,
                              end_date: day.fullDate,
                              period: period,
                              start_period: period,
                              end_period: period,
                              is_sav: note.is_sav,
                            }, {
                              onSuccess: () => toast.success('Note dupliquée'),
                              onError: () => toast.error('Erreur lors de la duplication'),
                            });
                          } : undefined}
                          onNoteDelete={isAdmin ? handleDeleteNote : undefined}
                          onNoteToggleConfirm={isAdmin ? handleToggleNoteConfirm : undefined}
                          onNoteToggleDisplayBelow={isAdmin ? handleToggleNoteDisplayBelow : undefined}
                          onBulkToggleNotesDisplayBelow={isAdmin ? handleBulkToggleNotesDisplayBelow : undefined}
                          onAddNote={isAdmin ? () => handleAddNote(tech.id, day.fullDate, period) : undefined}
                          onAddAssignment={isAdmin ? () => handleAddAssignment(tech.id, day.fullDate, period) : undefined}
                          onAssignmentClick={isAdmin ? handleAssignmentClick : undefined}
                          onAssignmentDuplicate={isAdmin ? (a) => handleDuplicateAssignment(a.id) : undefined}
                          onAssignmentDelete={isAdmin ? (a) => handleDeleteAssignment(a.id) : undefined}
                          onAssignmentMoveUp={isAdmin ? (a) => handleAssignmentMoveUp(a, tech.id, day.fullDate, period) : undefined}
                          onAssignmentMoveDown={isAdmin ? (a) => handleAssignmentMoveDown(a, tech.id, day.fullDate, period) : undefined}
                          commandes={commandes}
                          chantiers={chantiers}
                          isAdmin={isAdmin}
                          maxAssignmentsPerPeriod={maxAssignments}
                          // Drag and drop props
                          cellDate={day.fullDate}
                          cellPeriod={period}
                          cellTechnicianId={tech.id}
                          isDraggable={isAdmin ? isDraggable : undefined}
                          onDragStart={isAdmin ? handleDragStart : undefined}
                          onDragOver={isAdmin ? handleDragOver : undefined}
                          onDragLeave={isAdmin ? handleDragLeave : undefined}
                          onDrop={isAdmin ? handleDrop : undefined}
                          onDragEnd={isAdmin ? handleDragEnd : undefined}
                          isDropTarget={dropTarget?.technicianId === tech.id && dropTarget?.date === day.fullDate && dropTarget?.period === period ? dropTarget : null}
                          isPreviewCell={previewCells.some(c => c.technicianId === tech.id && c.date === day.fullDate && c.period === period)}
                          draggedAssignmentId={draggedItem?.assignment?.id}
                          draggedGroupId={draggedItem?.assignment?.assignment_group_id}
                          // Note drag props
                          fullNotes={notes.filter(n => n.technician_id === tech.id).map(n => ({
                            id: n.id,
                            text: n.text,
                            is_sav: n.is_sav,
                            technician_id: n.technician_id,
                            start_date: n.start_date,
                            end_date: n.end_date || n.start_date,
                            start_period: n.start_period || n.period || 'Matin',
                            end_period: n.end_period || n.period || 'Après-midi',
                          }))}
                          onNoteDragStart={isAdmin ? handleNoteDragStart : undefined}
                          onNoteDragOver={isAdmin ? handleNoteDragOver : undefined}
                          onNoteDrop={isAdmin ? handleNoteDrop : undefined}
                          onNoteDragEnd={isAdmin ? handleNoteDragEnd : undefined}
                          isNoteDragging={isNoteDragging}
                          noteDropTarget={noteDropTarget}
                          allAssignments={allAssignmentsFormatted}
                          technicians={activeTechnicians.map(t => ({ id: t.id, name: t.name }))}
                          highlightedGroupId={highlightedGroupId}
                          onHighlightGroup={setHighlightedGroupId}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
