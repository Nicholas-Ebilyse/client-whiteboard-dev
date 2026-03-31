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
  Users, CalendarX2, Presentation, Calendar, FileSpreadsheet,
  Search, ChevronLeft, ChevronRight, UserMinus, Car, Building2 // Added Building2!
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
  savRecordsLength: number;
  savVisible: boolean;
  setSavVisible: React.Dispatch<React.SetStateAction<boolean>>;
  handleSignOut: () => void;
  onOpenSearchModal?: () => void;
  setFleetDialogOpen: (open: boolean) => void;
  setManageTechsDialogOpen?: (open: boolean) => void;
  setAbsenceManagementOpen?: (open: boolean) => void;
  setClientManagementOpen?: (open: boolean) => void; // Added our new prop!
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
  setFleetDialogOpen,
  setManageTechsDialogOpen,
  setAbsenceManagementOpen,
  setClientManagementOpen, // Destructure the new prop
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
                    className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 text-blue-700 dark:text-blue-300"
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
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSendScheduleOpen(true)}
                    className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 text-sky-600"
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Envoyer par email</TooltipContent>
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
                    onClick={async () => {
                      try {
                        const { data, error } = await supabase
                          .from('presentation_tokens')
                          .insert([{}])
                          .select('token')
                          .single();

                        if (error) throw error;

                        const weekStart = startOfWeek(new Date(weekConfig.year, 0, 1 + (weekConfig.week_number - 1) * 7), { weekStartsOn: 1 });
                        const dateStr = format(weekStart, 'yyyy-MM-dd');
                        const url = `${window.location.origin}/presentation?timeout=${presentationTimeout}&token=${data.token}&date=${dateStr}`;

                        if (navigator.clipboard && window.isSecureContext) {
                          await navigator.clipboard.writeText(url);
                          toast.success('Lien sécurisé copié dans le presse-papiers !');
                        } else {
                          prompt("Votre navigateur bloque la copie automatique. Copiez le lien ci-dessous :", url);
                          toast.success('Lien généré avec succès !');
                        }
                      } catch (err) {
                        console.error(err);
                        toast.error('Erreur lors de la génération du lien');
                      }
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
                    onClick={() => window.open(`https://calendar.google.com/calendar/u/0/r?cid=c_8ca18ced58f50f7a5d670b6bee03ca40017d805860177daba7efcd7a6a53b8b2@group.calendar.google.com`, '_blank')}
                    className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 text-blue-600"
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ouvrir Google Calendar</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {isAdmin && setFleetDialogOpen && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFleetDialogOpen(true)}
                    className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 text-violet-600"
                  >
                    <Car className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Flotte & Matériel</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {isAdmin && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(`https://docs.google.com/spreadsheets/d/1699-HaYP4W2rSJUscbXCvp7fVW0vR95NRpjl5QpBUeY/edit`, '_blank')}
                    className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ouvrir Google Sheets</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* NEW BUTTON: Client Management */}
          {isAdmin && setClientManagementOpen && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setClientManagementOpen(true)}
                    className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 text-teal-600"
                  >
                    <Building2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Gérer les clients et chantiers</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {isAdmin && setManageTechsDialogOpen && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setManageTechsDialogOpen(true)}
                    className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 text-indigo-600"
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Gérer les équipes</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {isAdmin && setAbsenceManagementOpen && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setAbsenceManagementOpen(true)}
                    className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 text-orange-500"
                  >
                    <CalendarX2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Gérer les absences</TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
                        : "hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-300"
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
                    className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 text-amber-700 dark:text-amber-300"
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

          {isAdmin && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.location.href = '/admin'}
                    className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600"
                  >
                    <Wrench className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Administration</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Separator */}
          <div className="w-px h-6 bg-border mx-1" />

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 text-rose-600"
                >
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