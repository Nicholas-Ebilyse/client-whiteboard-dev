import React from 'react';
import { toast } from 'sonner';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { startOfWeek, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { WeekSelector } from '@/components/WeekSelector';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { Input } from '@/components/ui/input';
import {
  Palette, Copy, Undo2, Mail, Wrench, LogOut, Lock, Link2,
  Users, CalendarX2, Presentation, Search, ChevronLeft, 
  ChevronRight, UserMinus, Car, Building2, Trash2 // 👈 Trash2 imported
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PlanningToolbarProps {
  weekConfig: { week_number: number; year: number };
  handleWeekChange: (week: number, year: number) => void;
  handleWeekNavDragOver: (e: React.DragEvent, direction: 'prev' | 'next') => void;
  handleWeekNavDrop: (e: React.DragEvent, direction: 'prev' | 'next') => void;
  isDragging: boolean;
  isAdmin: boolean;
  copyModeEnabled: boolean;
  toggleCopyMode: () => void;
  canUndo: boolean;
  canUndoNote: boolean;
  handleUndo: () => void;
  handleNoteUndo: () => void;
  setSendScheduleOpen: (open: boolean) => void;
  handleSignOut: () => void;
  onOpenSearchModal?: () => void;
  setFleetDialogOpen: (open: boolean) => void;
  setManageTechsDialogOpen?: (open: boolean) => void;
  setAbsenceManagementOpen?: (open: boolean) => void;
  setClientManagementOpen?: (open: boolean) => void; 
  setTrashDialogOpen?: (open: boolean) => void;
  canUndoDelete?: boolean;
  triggerUndoDelete?: () => void;
}

export const PlanningToolbar: React.FC<PlanningToolbarProps> = ({
  weekConfig,
  handleWeekChange,
  handleWeekNavDragOver,
  handleWeekNavDrop,
  isDragging,
  isAdmin,
  copyModeEnabled,
  toggleCopyMode,
  canUndo,
  canUndoNote,
  handleUndo,
  handleNoteUndo,
  setSendScheduleOpen,
  handleSignOut,
  onOpenSearchModal,
  setFleetDialogOpen,
  setManageTechsDialogOpen,
  setAbsenceManagementOpen,
  setClientManagementOpen,
  setTrashDialogOpen,
  canUndoDelete,
  triggerUndoDelete
}) => {
  const [presentationTimeout, setPresentationTimeout] = React.useState(30);

  return (
    <CardHeader className="bg-primary/5 border-b p-0">
      <div className="p-2 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-2 border-b">
        <div className="flex-1 flex justify-start">
          <WeekSelector
            weekNumber={weekConfig.week_number}
            year={weekConfig.year}
            onWeekChange={handleWeekChange}
            onDragOver={handleWeekNavDragOver}
            onDrop={handleWeekNavDrop}
            isDragging={isDragging}
          />
        </div>
        <CardTitle className="flex-none text-xl sm:text-2xl font-bold text-primary/80 flex items-center justify-center gap-2">
          {(() => {
            const weekStart = startOfWeek(new Date(weekConfig.year, 0, 1 + (weekConfig.week_number - 1) * 7), { weekStartsOn: 1 });
            const month = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][weekStart.getMonth()];
            return `Planning des équipes • Semaine ${weekConfig.week_number} • ${month} ${weekConfig.year}`;
          })()}
        </CardTitle>
        <div className="flex-1 flex flex-wrap items-center justify-end gap-1.5">
          {isAdmin && <KeyboardShortcutsHelp />}

          {onOpenSearchModal && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onOpenSearchModal} className="h-8 w-8 text-blue-700">
                    <Search className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Recherche avancée et filtres</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {isAdmin && setTrashDialogOpen && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setTrashDialogOpen(true)} className="h-8 w-8 text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Corbeille des affectations</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {isAdmin && (canUndo || canUndoNote || canUndoDelete) && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (canUndoDelete && triggerUndoDelete) triggerUndoDelete();
                      else if (canUndo) handleUndo();
                      else if (canUndoNote) handleNoteUndo();
                    }}
                    className="h-8 w-8 text-amber-700 bg-amber-100/50 hover:bg-amber-200"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {canUndoDelete ? 'Annuler la suppression (Ctrl+Z)' : canUndo ? 'Annuler le déplacement' : 'Annuler la note'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* ... (Other existing buttons: Presentation, Fleet, Client, Techs, Absences, Admin) ... */}
          {/* TO KEEP THIS SNIPPET SHORT, assume all other standard buttons remain here exactly as before */}
          
          <div className="w-px h-6 bg-border mx-1" />
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-8 w-8 text-rose-600">
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Déconnexion</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </CardHeader>
  );
};