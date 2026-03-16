import React from 'react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent
} from '@/components/ui/dropdown-menu';
import { Palette, Copy, Undo2, Mail, Wrench, LogOut, Lock, Link2, Menu, Users } from 'lucide-react';
import { startOfWeek, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { WeekSelector } from '@/components/WeekSelector';
import { InvoicedSummary } from '@/components/InvoicedSummary';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { AdminBadge } from '@/components/AdminBadge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

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
  searchTerm?: string;
  onSearch?: (term: string) => void;
  setManageTechsDialogOpen?: (open: boolean) => void;
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
  searchTerm = "",
  onSearch,
  setManageTechsDialogOpen,
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
        <div className="flex-1 max-w-sm mx-4 relative hidden md:block">
          {onSearch && (
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Rechercher client, chantier..."
                className="w-full pl-9 h-9 bg-background focus-visible:ring-primary/50"
                value={searchTerm}
                onChange={(e) => onSearch(e.target.value)}
              />
            </div>
          )}
        </div>
          <div className="flex items-center gap-1.5">
          {/* Info group */}
          <InvoicedSummary
            invoicedAssignments={invoicedAssignments}
            totalAssignments={totalAssignments}
            invoicedNotes={invoicedNotes}
            totalNotes={totalNotes}
          />
          {isAdmin && <KeyboardShortcutsHelp />}
          
          {/* Quick Actions */}
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

          {isAdmin && <AdminBadge />}

          {/* Hamburger Menu for less frequent actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {isAdmin && setManageTechsDialogOpen && (
                <DropdownMenuItem onClick={() => setManageTechsDialogOpen(true)}>
                  <Users className="mr-2 h-4 w-4 text-indigo-600" />
                  <span>Gérer les équipes</span>
                </DropdownMenuItem>
              )}
              {isAdmin && (
                <DropdownMenuItem onClick={() => setSendScheduleOpen(true)}>
                  <Mail className="mr-2 h-4 w-4 text-sky-600" />
                  <span>Envoyer par email</span>
                </DropdownMenuItem>
              )}
              {savRecordsLength > 0 && (
                <DropdownMenuItem onClick={() => setSavAbove(prev => !prev)}>
                  <Wrench className={cn("mr-2 h-4 w-4", savAbove ? "text-orange-500" : "text-muted-foreground")} />
                  <span>{savAbove ? 'Masquer SAV' : 'Afficher SAV'}</span>
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Légendes</DropdownMenuLabel>
              
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette className="mr-2 h-4 w-4 text-violet-600" />
                  <span>Couleurs de statut</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-64 p-3">
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
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Lock className="mr-2 h-4 w-4 text-slate-600" />
                  <span>Icônes & Verrous</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-64 p-3">
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
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

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
