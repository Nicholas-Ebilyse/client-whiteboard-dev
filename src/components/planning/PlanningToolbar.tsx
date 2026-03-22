import React from 'react';
import { toast } from 'sonner';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Palette, Copy, Undo2, Mail, Wrench, LogOut, Lock, Link2, Menu, Users, CalendarX2, Presentation, Calendar, FileSpreadsheet } from 'lucide-react';
import { startOfWeek, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { WeekSelector } from '@/components/WeekSelector';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
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
  savRecordsLength: number;
  savVisible: boolean;
  setSavVisible: React.Dispatch<React.SetStateAction<boolean>>;
  handleSignOut: () => void;
  onOpenSearchModal?: () => void;
  setManageTechsDialogOpen?: (open: boolean) => void;
  setAbsenceManagementOpen?: (open: boolean) => void;
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
  savRecordsLength,
  savVisible,
  setSavVisible,
  handleSignOut,
  onOpenSearchModal,
  setManageTechsDialogOpen,
  setAbsenceManagementOpen,
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
        <div className="flex-1 flex items-center justify-end gap-1.5">
          {/* Info group */}
          {isAdmin && <KeyboardShortcutsHelp />}
          
          {/* Quick Actions */}
          {onOpenSearchModal && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenSearchModal}
                    className="h-8 w-8 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Recherche avancée et filtres
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {isAdmin && (
            <Popover>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        <Presentation className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    Mode présentation
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <PopoverContent className="w-64 p-4">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Mode présentation</h4>
                  <div className="space-y-2">
                    <Label htmlFor="timeout">Délai avant retour (en minutes)</Label>
                    <Input 
                      id="timeout"
                      type="number" 
                      min="1"
                      value={presentationTimeout} 
                      onChange={e => setPresentationTimeout(parseInt(e.target.value) || 30)} 
                    />
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => {
                      const weekStart = startOfWeek(new Date(weekConfig.year, 0, 1 + (weekConfig.week_number - 1) * 7), { weekStartsOn: 1 });
                      const dateStr = format(weekStart, 'yyyy-MM-dd');
                      const url = `${window.location.origin}/presentation?timeout=${presentationTimeout}&token=${import.meta.env.VITE_PRESENTATION_TOKEN}&date=${dateStr}`;
                      navigator.clipboard.writeText(url);
                      toast.success('Lien copié dans le presse-papiers');
                    }}
                  >
                    Copier lien Présentation
                  </Button>
                  <Button 
                    variant="destructive"
                    className="w-full" 
                    onClick={() => {
                      supabase.channel('presentation_controls').send({
                        type: 'broadcast',
                        event: 'stop_timer',
                        payload: { action: 'stop' }
                      });
                      toast.success('Signal d\'arrêt envoyé à la présentation');
                    }}
                  >
                    Arrêter le minuteur distant
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {isAdmin && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleCopyMode}
                    className={cn(
                      "h-8 w-8",
                      copyModeEnabled 
                        ? "bg-green-500 hover:bg-green-600 text-white" 
                        : "bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                    )}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {copyModeEnabled 
                    ? "Mode copie actif — Cliquez pour désactiver" 
                    : "Activer le mode copie"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {isAdmin && (canUndo || canUndoNote) && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (canUndo) handleUndo();
                      else if (canUndoNote) handleNoteUndo();
                    }}
                    className="h-8 w-8 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {canUndo ? 'Annuler le déplacement (Ctrl+Z)' : 'Annuler le déplacement de note'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Separator */}
          <div className="w-px h-6 bg-border mx-1" />

          {/* Hamburger Menu for less frequent actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {isAdmin && (
                <DropdownMenuItem onClick={() => window.location.href = '/admin'}>
                  <Wrench className="mr-2 h-4 w-4 text-emerald-600" />
                  <span>Admin</span>
                </DropdownMenuItem>
              )}
              {isAdmin && setManageTechsDialogOpen && (
                <DropdownMenuItem onClick={() => setManageTechsDialogOpen(true)}>
                  <Users className="mr-2 h-4 w-4 text-indigo-600" />
                  <span>Gérer les équipes</span>
                </DropdownMenuItem>
              )}
              {isAdmin && setAbsenceManagementOpen && (
                <DropdownMenuItem onClick={() => setAbsenceManagementOpen(true)}>
                  <CalendarX2 className="mr-2 h-4 w-4 text-orange-500" />
                  <span>Gérer les absences</span>
                </DropdownMenuItem>
              )}
              {isAdmin && (
                <>
                  <DropdownMenuItem onClick={() => window.open(`https://calendar.google.com/calendar/u/0/r?cid=c_8ca18ced58f50f7a5d670b6bee03ca40017d805860177daba7efcd7a6a53b8b2@group.calendar.google.com`, '_blank')}>
                    <Calendar className="mr-2 h-4 w-4 text-blue-600" />
                    <span>Ouvrir Google Calendar</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(`https://docs.google.com/spreadsheets/d/1699-HaYP4W2rSJUscbXCvp7fVW0vR95NRpjl5QpBUeY/edit`, '_blank')}>
                    <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
                    <span>Ouvrir Google Sheets</span>
                  </DropdownMenuItem>
                </>
              )}
              {isAdmin && (
                <DropdownMenuItem onClick={() => setSendScheduleOpen(true)}>
                  <Mail className="mr-2 h-4 w-4 text-sky-600" />
                  <span>Envoyer par email</span>
                </DropdownMenuItem>
              )}
              {/* SAV option temporarily hidden by user request
              {savRecordsLength > 0 && (
                <DropdownMenuItem onClick={() => setSavVisible(prev => !prev)}>
                  <Wrench className={cn("mr-2 h-4 w-4", savVisible ? "text-orange-500" : "text-muted-foreground")} />
                  <span>{savVisible ? 'Masquer SAV' : 'Afficher SAV'}</span>
                </DropdownMenuItem>
              )}
              */}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-rose-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Déconnexion</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </CardHeader>
  );
};
