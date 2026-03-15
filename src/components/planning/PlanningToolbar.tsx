import React from 'react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Palette, Copy, Undo2, Mail, Wrench, LogOut, Lock, Link2 } from 'lucide-react';
import { startOfWeek, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { WeekSelector } from '@/components/WeekSelector';
import { InvoicedSummary } from '@/components/InvoicedSummary';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { AdminBadge } from '@/components/AdminBadge';

interface PlanningToolbarProps {
  weekConfig: { week_number: number; year: number };
  handleWeekChange: (week: number, year: number) => void;
  handleWeekNavDragOver: (e: React.DragEvent, direction: 'prev' | 'next') => void;
  handleWeekNavDrop: (e: React.DragEvent, direction: 'prev' | 'next') => void;
  isDragging: boolean;
  invoicedAssignments: number;
  totalAssignments: number;
  invoicedNotes: number;
  totalNotes: number;
  isAdmin: boolean;
  copyModeEnabled: boolean;
  toggleCopyMode: () => void;
  canUndo: boolean;
  canUndoNote: boolean;
  handleUndo: () => void;
  handleNoteUndo: () => void;
  setSendScheduleOpen: (open: boolean) => void;
  savRecordsLength: number;
  savAbove: boolean;
  setSavAbove: React.Dispatch<React.SetStateAction<boolean>>;
  handleSignOut: () => void;
}

export const PlanningToolbar: React.FC<PlanningToolbarProps> = ({
  weekConfig,
  handleWeekChange,
  handleWeekNavDragOver,
  handleWeekNavDrop,
  isDragging,
  invoicedAssignments,
  totalAssignments,
  invoicedNotes,
  totalNotes,
  isAdmin,
  copyModeEnabled,
  toggleCopyMode,
  canUndo,
  canUndoNote,
  handleUndo,
  handleNoteUndo,
  setSendScheduleOpen,
  savRecordsLength,
  savAbove,
  setSavAbove,
  handleSignOut,
}) => {
  return (
    <CardHeader className="bg-primary/5 border-b p-0">
      <div className="p-2 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-2 border-b">
        <WeekSelector
          weekNumber={weekConfig.week_number}
          year={weekConfig.year}
          onWeekChange={handleWeekChange}
          onDragOver={handleWeekNavDragOver}
          onDrop={handleWeekNavDrop}
          isDragging={isDragging}
        />
        <CardTitle className="text-lg sm:text-xl font-semibold flex items-center gap-2">
          Planning Hebdomadaire - {(() => {
            const weekStart = startOfWeek(new Date(weekConfig.year, 0, 1 + (weekConfig.week_number - 1) * 7), { weekStartsOn: 1 });
            const day = weekStart.getDate().toString();
            const month = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'][weekStart.getMonth()];
            const year = format(weekStart, 'yy');
            return `${day} ${month} ${year}`;
          })()}
        </CardTitle>
        <div className="flex items-center gap-1.5">
          {/* Info group */}
          <InvoicedSummary
            invoicedAssignments={invoicedAssignments}
            totalAssignments={totalAssignments}
            invoicedNotes={invoicedNotes}
            totalNotes={totalNotes}
          />
          {isAdmin && <KeyboardShortcutsHelp />}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 bg-violet-100 hover:bg-violet-200 dark:bg-violet-900/30 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300"
                >
                  <Palette className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="w-72 p-4">
                <p className="font-semibold mb-3 text-sm">Légende des couleurs</p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded bg-muted border" />
                    <div>
                      <p className="font-medium text-sm">Non confirmé</p>
                      <p className="text-xs text-muted-foreground">En attente de validation</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded bg-confirmed-blue" />
                    <div>
                      <p className="font-medium text-sm">Confirmé</p>
                      <p className="text-xs text-muted-foreground">Mission validée et planifiée</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded bg-absent-pink" />
                    <div>
                      <p className="font-medium text-sm">Absence</p>
                      <p className="text-xs text-muted-foreground">Technicien indisponible</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: '#fca5a5' }} />
                    <div>
                      <p className="font-medium text-sm">Facturé</p>
                      <p className="text-xs text-muted-foreground">Chantier terminé et facturé</p>
                    </div>
                  </div>
                </div>
                <div className="border-t mt-3 pt-3">
                  <p className="font-semibold mb-2 text-sm">Icônes de verrouillage</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Lock className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="font-medium text-sm">Confirmé</p>
                        <p className="text-xs text-muted-foreground">Non déplaçable car validé</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Lock className="h-4 w-4 text-red-600" />
                      <div>
                        <p className="font-medium text-sm">Facturé</p>
                        <p className="text-xs text-muted-foreground">Non déplaçable car facturé</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link2 className="h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium text-sm">Lié</p>
                        <p className="text-xs text-muted-foreground">Affectation partagée avec un autre technicien</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-t mt-3 pt-3">
                  <p className="font-semibold mb-2 text-sm">Couleurs des notes</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-3 rounded bg-amber-100 dark:bg-amber-900/30 border-l-2 border-amber-500" />
                      <div>
                        <p className="font-medium text-sm">Note technicien</p>
                        <p className="text-xs text-muted-foreground">Note non confirmée</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-3 rounded bg-indigo-100 dark:bg-indigo-900/30 border-l-2 border-indigo-500" />
                      <div>
                        <p className="font-medium text-sm">Note générale</p>
                        <p className="text-xs text-muted-foreground">Visible par tous les techniciens</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-3 rounded bg-note-confirmed border-l-2 border-cyan-500" />
                      <div>
                        <p className="font-medium text-sm">Note confirmée</p>
                        <p className="text-xs text-muted-foreground">Information validée</p>
                      </div>
                    </div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Separator */}
          <div className="w-px h-6 bg-border mx-1" />

          {/* Actions group */}
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

          {/* Status & Navigation group */}
          {isAdmin && <AdminBadge />}
          {isAdmin && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={() => setSendScheduleOpen(true)} 
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 bg-sky-100 hover:bg-sky-200 dark:bg-sky-900/30 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300"
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Envoyer le planning par email</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {savRecordsLength > 0 && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={() => setSavAbove(prev => !prev)} 
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8",
                      savAbove 
                        ? "bg-orange-500 hover:bg-orange-600 text-white" 
                        : "bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300"
                    )}
                  >
                    <Wrench className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Afficher SAV</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Account */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSignOut}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300"
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
