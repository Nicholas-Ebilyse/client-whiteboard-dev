import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
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
  short_id?: number | null;
}

interface TeamManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
  technicians: Technician[];
  onArchive: (technicianId: string, archived: boolean) => void;
  onNameChange: (technicianId: string, newName?: string, is_interim?: boolean, skills?: string) => void;
  onAdd: (name: string, isTemp: boolean, skills?: string) => void;
  onAssignTeam: (technicianId: string, teamId: string | null) => void;
}

const normalizeTechName = (name: string) => name.replace(/^INT\s+/i, '').trim().toLowerCase();

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
  const [editSkills, setEditSkills] = useState('');
  const [editIsTemp, setEditIsTemp] = useState(false);

  // New technician dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newTechName, setNewTechName] = useState('');
  const [newTechSkills, setNewTechSkills] = useState('');
  const [newIsTemp, setNewIsTemp] = useState(false);

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

  const techsByTeam = teams.map((team) => ({
    ...team,
    members: activeTechs.filter((t) => t.team_id === team.id).sort((a, b) => a.position - b.position),
  }));

  const unassignedTechs = activeTechs.filter((t) => !t.team_id).sort((a, b) => a.position - b.position);

  const handleConfirmAction = () => {
    const newArchiveState = confirmDialog.action === 'archive';
    onArchive(confirmDialog.technicianId, newArchiveState);
    toast.success(newArchiveState ? `${confirmDialog.technicianName} archivé` : `${confirmDialog.technicianName} désarchivé`);
    setConfirmDialog({ open: false, technicianId: '', technicianName: '', action: 'archive' });
  };

  const handleStartEdit = (tech: Technician) => {
    setEditingId(tech.id);
    setEditName(tech.name);
    setEditSkills(tech.skills || '');
    setEditIsTemp(tech.is_temp || false);
  };

  const handleSaveEdit = (techId: string) => {
    if (!editName.trim()) return;
    const duplicate = activeTechs.some(
      (t) => t.id !== techId && normalizeTechName(t.name) === normalizeTechName(editName)
    );
    if (duplicate) {
      toast.error(`Un technicien avec le nom "${normalizeTechName(editName)}" existe déjà.`);
      return;
    }
    // Enforce INT prefix based on checkbox, stripping any existing prefix first
    const baseName = editName.replace(/^INT\s+/i, '').trim();
    const finalName = editIsTemp ? `INT ${baseName}` : baseName;
    onNameChange(techId, finalName, editIsTemp, editSkills.trim() || undefined);
    toast.success('Technicien mis à jour');
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditSkills('');
    setEditIsTemp(false);
  };

  const handleAddNew = () => {
    if (!newTechName.trim()) return;

    const baseName = newTechName.trim().replace(/^INT\s+/i, '').trim();
    const finalName = newIsTemp ? `INT ${baseName}` : baseName;

    const duplicate = activeTechs.some((t) => normalizeTechName(t.name) === normalizeTechName(finalName));
    if (duplicate) {
      toast.error(`Un technicien avec le nom "${normalizeTechName(finalName)}" existe déjà.`);
      return;
    }
    onAdd(finalName, newIsTemp, newTechSkills.trim() || undefined);
    setNewTechName('');
    setNewTechSkills('');
    setNewIsTemp(false);
    setAddDialogOpen(false);
    toast.success('Technicien ajouté');
  };

  const renderTechRow = (tech: Technician) => (
    <div
      key={tech.id}
      className={`rounded-md border transition-colors ${
        tech.is_archived ? 'bg-muted/30 opacity-60' : 'bg-background'
      }`}
    >
      {editingId === tech.id ? (
        /* ── Edit mode ── */
        <div className="p-2 space-y-2 w-full">
          <p className="text-[10px] text-muted-foreground font-mono px-1">
            ID: {tech.short_id != null ? `#${tech.short_id}` : tech.id.substring(0, 8)}
          </p>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit(tech.id);
              if (e.key === 'Escape') handleCancelEdit();
            }}
            className="h-8 text-sm"
            autoFocus
            placeholder="Nom du technicien"
          />
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={editIsTemp}
              onChange={(e) => setEditIsTemp(e.target.checked)}
              className="rounded border-gray-300 text-primary h-3.5 w-3.5"
            />
            <span className="text-muted-foreground">Intérimaire (INT)</span>
          </label>
          <Textarea
            value={editSkills}
            onChange={(e) => setEditSkills(e.target.value)}
            placeholder="Compétences / commentaire (optionnel)"
            className="text-xs min-h-[56px] resize-none"
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="flex-1 h-7" onClick={() => handleSaveEdit(tech.id)}>
              <Check className="h-3.5 w-3.5 mr-1" />
              Enregistrer
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleCancelEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        /* ── Display mode ── */
        <div className="p-1.5 space-y-1">
          {/* Row 1: name + INT badge */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`font-medium text-sm truncate flex-1 min-w-0 ${tech.is_archived ? 'text-muted-foreground italic' : ''}`}>
              {tech.name}
            </span>
            {tech.is_temp && (
              <span className="text-[9px] font-bold shrink-0 bg-amber-100 text-amber-700 px-1 py-0.5 rounded uppercase">INT</span>
            )}
            {tech.short_id != null && (
              <span className="text-[9px] font-mono shrink-0 text-muted-foreground">#{tech.short_id}</span>
            )}
          </div>
          {/* Row 2: actions */}
          <div className="flex items-center gap-1 flex-wrap">
            {/* Team selector */}
            {!tech.is_archived && (
              <Select
                value={tech.team_id || 'unassigned'}
                onValueChange={(value) => onAssignTeam(tech.id, value === 'unassigned' ? null : value)}
              >
                <SelectTrigger className="h-6 text-[11px] px-1.5 flex-1 min-w-0">
                  <SelectValue placeholder="Équipe…" />
                </SelectTrigger>
                <SelectContent className="max-h-[250px]">
                  <SelectItem value="unassigned" className="text-xs text-muted-foreground italic">Non assigné</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* INT toggle */}
            {!tech.is_archived && (
              <label className="flex items-center gap-0.5 cursor-pointer shrink-0" title="Intérimaire">
                <input
                  type="checkbox"
                  checked={tech.is_temp || false}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    const baseName = tech.name.replace(/^INT\s+/i, '').trim();
                    const updatedName = isChecked ? `INT ${baseName}` : baseName;
                    onNameChange(tech.id, updatedName, isChecked);
                  }}
                  className="rounded border-gray-300 text-primary h-3 w-3"
                />
                <span className="text-[9px] text-muted-foreground uppercase">INT</span>
              </label>
            )}
            {/* Edit */}
            {!tech.is_archived && (
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => handleStartEdit(tech)}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            {/* Archive */}
            <Button
              size="icon"
              variant="ghost"
              className={`h-6 w-6 shrink-0 ${tech.is_archived ? 'text-muted-foreground hover:text-amber-700' : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'}`}
              onClick={() =>
                setConfirmDialog({
                  open: true,
                  technicianId: tech.id,
                  technicianName: tech.name,
                  action: tech.is_archived ? 'unarchive' : 'archive',
                })
              }
            >
              {tech.is_archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-[#fbfbfb]">
          <DialogHeader className="p-4 sm:p-6 pb-2 shrink-0 bg-white border-b">
            <DialogTitle className="text-xl sm:text-2xl">Gérer les équipes</DialogTitle>
            <DialogDescription>
              Assignez les techniciens aux équipes de base. Les techniciens non assignés ne seront rattachés à aucune ligne de planning.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Teams Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {techsByTeam.map((team) => (
                <div
                  key={team.id}
                  className="border rounded-md p-3 shadow-sm flex flex-col"
                  style={{ backgroundColor: team.color ? `${team.color}22` : '#EFF6FF', borderColor: team.color }}
                >
                  <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                    <span className="truncate">{team.name}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                      {team.members.length}
                    </span>
                  </h3>
                  <div className="space-y-1.5 flex-1">
                    {team.members.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic px-2 py-4 text-center bg-muted/20 rounded border border-dashed">
                        Aucun technicien
                      </div>
                    ) : (
                      team.members.map((tech) => renderTechRow(tech))
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Unassigned technicians */}
            <div className="bg-white rounded-md border p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-destructive">Techniciens non assignés</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                    {unassignedTechs.length}
                  </span>
                </div>
                <Button
                  onClick={() => setAddDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Nouveau technicien
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                {unassignedTechs.map((tech) => renderTechRow(tech))}
              </div>

              {unassignedTechs.length === 0 && (
                <div className="text-sm text-muted-foreground italic p-6 text-center border border-dashed rounded-lg bg-muted/10">
                  Tous les techniciens actifs sont assignés à une équipe.
                </div>
              )}
            </div>

            {/* Archived technicians */}
            {archivedTechs.length > 0 && (
              <div className="bg-white rounded-md border p-4 shadow-sm opacity-75">
                <h3 className="text-base font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                  <Archive className="h-4 w-4" />
                  Archives ({archivedTechs.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                  {archivedTechs.map((tech) => renderTechRow(tech))}
                </div>
              </div>
            )}
          </div>

          <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog((prev) => ({ ...prev, open: false }))}>
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
                <AlertDialogAction
                  onClick={handleConfirmAction}
                  className={confirmDialog.action === 'archive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                >
                  Confirmer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogContent>
      </Dialog>

      {/* ── Add technician dialog ── */}
      <Dialog open={addDialogOpen} onOpenChange={(v) => { setAddDialogOpen(v); if (!v) { setNewTechName(''); setNewTechSkills(''); setNewIsTemp(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouveau technicien</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-tech-name">Nom *</Label>
              <Input
                id="new-tech-name"
                placeholder="Prénom Nom"
                value={newTechName}
                onChange={(e) => setNewTechName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNew()}
                autoFocus
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={newIsTemp}
                onChange={(e) => setNewIsTemp(e.target.checked)}
                className="rounded border-gray-300 text-primary h-4 w-4"
              />
              <span>Intérimaire (préfixe INT)</span>
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="new-tech-skills">Compétences / commentaire</Label>
              <Textarea
                id="new-tech-skills"
                placeholder="Habilitations, spécialités…"
                value={newTechSkills}
                onChange={(e) => setNewTechSkills(e.target.value)}
                className="min-h-[72px] resize-none text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setAddDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleAddNew} disabled={!newTechName.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Créer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
