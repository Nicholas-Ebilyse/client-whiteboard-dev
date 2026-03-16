import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Archive, ArchiveRestore, Check, X, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface Team {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface Technician {
  id: string;
  name: string;
  is_archived: boolean;
  position: number;
  is_temp?: boolean;
  team_id?: string | null;
  skills?: string | null;
}

interface TeamManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
  technicians: Technician[];
  onArchive: (technicianId: string, archived: boolean) => void;
  onNameChange: (technicianId: string, newName?: string, is_interim?: boolean) => void;
  onAdd: (name: string, isTemp: boolean) => void;
  onAssignTeam: (technicianId: string, teamId: string | null) => void;
}

export const TeamManagementDialog = ({
  open,
  onOpenChange,
  teams,
  technicians,
  onArchive,
  onNameChange,
  onAdd,
  onAssignTeam,
}: TeamManagementDialogProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTechName, setNewTechName] = useState('');
  const [isTemp, setIsTemp] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    technicianId: string;
    technicianName: string;
    action: 'archive' | 'unarchive';
  }>({
    open: false,
    technicianId: '',
    technicianName: '',
    action: 'archive',
  });

  const activeTechs = technicians.filter((t) => !t.is_archived);
  const archivedTechs = technicians.filter((t) => t.is_archived);

  // Group active techs by team
  const techsByTeam = teams.map((team) => ({
    ...team,
    members: activeTechs.filter((t) => t.team_id === team.id).sort((a,b) => a.position - b.position),
  }));

  const unassignedTechs = activeTechs.filter((t) => !t.team_id).sort((a,b) => a.position - b.position);

  const handleConfirmAction = () => {
    const newArchiveState = confirmDialog.action === 'archive';
    onArchive(confirmDialog.technicianId, newArchiveState);
    toast.success(
      newArchiveState
        ? `${confirmDialog.technicianName} archivé`
        : `${confirmDialog.technicianName} désarchivé`
    );
    setConfirmDialog({ open: false, technicianId: '', technicianName: '', action: 'archive' });
  };

  const handleStartEdit = (tech: Technician) => {
    setEditingId(tech.id);
    setEditName(tech.name);
  };

  const handleSaveEdit = (techId: string) => {
    if (editName.trim()) {
      onNameChange(techId, editName.trim());
      toast.success('Nom modifié');
      setEditingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleAddNew = () => {
    if (newTechName.trim()) {
      let finalName = newTechName.trim();
      if (isTemp && !finalName.startsWith('INT ')) {
        finalName = `INT ${finalName}`;
      } else if (!isTemp && finalName.startsWith('INT ')) {
        finalName = finalName.replace(/^INT /, '');
      }
      onAdd(finalName, isTemp);
      setNewTechName('');
      setIsTemp(false);
      setIsAddingNew(false);
      toast.success('Technicien ajouté');
    }
  };

  const renderTechRow = (tech: Technician) => (
    <div
      key={tech.id}
      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 rounded-lg border transition-colors ${
        tech.is_archived
          ? 'bg-muted/30 hover:bg-muted/40 opacity-60'
          : 'bg-background hover:bg-muted/50'
      }`}
    >
      {editingId === tech.id ? (
        <div className="flex w-full items-center gap-1">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit(tech.id);
              if (e.key === 'Escape') handleCancelEdit();
            }}
            className="h-8 text-sm flex-1"
            autoFocus
          />
          <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={() => handleSaveEdit(tech.id)}>
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={handleCancelEdit}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`font-medium text-sm truncate ${tech.is_archived ? 'text-muted-foreground italic' : ''}`}>
              {tech.name}
            </span>
            {!tech.is_archived && (
              <label className="flex items-center gap-1 cursor-pointer" title="Intérimaire">
                <input
                  type="checkbox"
                  checked={tech.is_temp || false}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    let updatedName = tech.name;
                    if (isChecked && !updatedName.startsWith('INT ')) {
                      updatedName = `INT ${updatedName}`;
                    } else if (!isChecked && updatedName.startsWith('INT ')) {
                      updatedName = updatedName.replace(/^INT /, '');
                    }
                    onNameChange(tech.id, updatedName, isChecked);
                  }}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-3 w-3"
                />
                <span className="text-[10px] text-muted-foreground uppercase">INT</span>
              </label>
            )}
          </div>

          <div className="flex items-center gap-1">
            {!tech.is_archived && (
              <Select
                value={tech.team_id || "unassigned"}
                onValueChange={(value) => {
                  onAssignTeam(tech.id, value === "unassigned" ? null : value);
                }}
              >
                <SelectTrigger className="w-[110px] h-7 text-xs px-2">
                  <SelectValue placeholder="Non assigné" />
                </SelectTrigger>
                <SelectContent className="max-h-[250px]">
                  <SelectItem value="unassigned" className="text-xs text-muted-foreground italic">Non assigné</SelectItem>
                  {teams.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {!tech.is_archived && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => handleStartEdit(tech)}
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="sr-only">Modifier</span>
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              className={`shrink-0 ${tech.is_archived ? "h-7 w-7 text-muted-foreground hover:text-amber-700 hover:bg-amber-100" : "h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"}`}
              onClick={() => {
                setConfirmDialog({
                  open: true,
                  technicianId: tech.id,
                  technicianName: tech.name,
                  action: tech.is_archived ? 'unarchive' : 'archive',
                });
              }}
            >
              {tech.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-[#fbfbfb]">
        <DialogHeader className="p-4 sm:p-6 pb-2 shrink-0 bg-white border-b">
          <DialogTitle className="text-xl sm:text-2xl">Gérer les équipes</DialogTitle>
          <DialogDescription>
            Assignez les techniciens aux équipes de base. Seules les équipes ayant des techniciens apparaîtront correctement peuplées dans le planning principal. Les techniciens non assignés ne seront rattachés à aucune ligne.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {techsByTeam.map(team => (
              <div key={team.id} className="border rounded-md p-3 bg-white shadow-sm flex flex-col">
                <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.color }} />
                  {team.name}
                  <span className="ml-auto text-xs font-normal text-muted-foreground">{team.members.length}</span>
                </h3>
                <div className="space-y-1.5 flex-1 content-start">
                  {team.members.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic px-2 py-4 text-center bg-muted/20 rounded border border-dashed">
                      Aucun technicien
                    </div>
                  ) : (
                    team.members.map(tech => renderTechRow(tech))
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-md border p-4 shadow-sm">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-destructive">Techniciens non assignés</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                    {unassignedTechs.length}
                  </span>
                </div>
                <Button
                  onClick={() => setIsAddingNew(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2 shrink-0"
                  disabled={isAddingNew}
                >
                  <Plus className="h-4 w-4" />
                  Nouveau technicien
                </Button>
            </div>

            <div className="space-y-2">
              {isAddingNew && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg border bg-muted/20">
                  <Input
                    placeholder="Nom du technicien"
                    value={newTechName}
                    onChange={(e) => setNewTechName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNew()}
                    className="flex-1 h-9"
                    autoFocus
                  />
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-md border text-sm shrink-0">
                    <input
                      type="checkbox"
                      checked={isTemp}
                      onChange={(e) => setIsTemp(e.target.value === 'on' || e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    Intérimaire
                  </label>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button size="sm" onClick={handleAddNew} disabled={!newTechName.trim()} className="flex-1 sm:flex-none">
                      Créer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setIsAddingNew(false); setNewTechName(''); setIsTemp(false); }} className="flex-1 sm:flex-none">
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                {unassignedTechs.map(tech => renderTechRow(tech))}
              </div>
              
              {unassignedTechs.length === 0 && !isAddingNew && (
                <div className="text-sm text-muted-foreground italic p-6 text-center border border-dashed rounded-lg bg-muted/10">
                  Tous les techniciens actifs sont assignés à une équipe.
                </div>
              )}
            </div>
          </div>

          {archivedTechs.length > 0 && (
            <div className="bg-white rounded-md border p-4 shadow-sm opacity-75">
              <h3 className="text-base font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Archives ({archivedTechs.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                {archivedTechs.map(tech => renderTechRow(tech))}
              </div>
            </div>
          )}
        </div>

        <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, open: false }))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmDialog.action === 'archive' ? 'Archiver le technicien ?' : 'Désarchiver le technicien ?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmDialog.action === 'archive' 
                  ? `${confirmDialog.technicianName} ne sera plus visible sur le planning, mais ses historiques seront conservés.`
                  : `${confirmDialog.technicianName} sera de nouveau visible et assignable dans le planning.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmAction} className={confirmDialog.action === 'archive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}>
                Confirmer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};
