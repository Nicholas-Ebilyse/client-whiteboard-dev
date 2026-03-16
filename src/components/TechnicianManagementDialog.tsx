import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Archive, ArchiveRestore, Check, X, Pencil, Plus, ChevronUp, ChevronDown } from 'lucide-react';
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

interface Technician {
  id: string;
  name: string;
  is_archived: boolean;
  position: number;
  is_temp?: boolean;
}

interface TechnicianManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technicians: Technician[];
  onArchive: (technicianId: string, archived: boolean) => void;
  onNameChange: (technicianId: string, newName?: string, is_interim?: boolean) => void;
  onAdd: (name: string, isTemp: boolean) => void;
  onReorder: (positions: { id: string; position: number }[]) => void;
}

export const TechnicianManagementDialog = ({
  open,
  onOpenChange,
  technicians,
  onArchive,
  onNameChange,
  onAdd,
  onReorder,
}: TechnicianManagementDialogProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTechName, setNewTechName] = useState('');
  const [isTemp, setIsTemp] = useState(false);
  const [localOrder, setLocalOrder] = useState<Technician[]>([]);
  const [orderChanged, setOrderChanged] = useState(false);
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

  // Sync local order from props only when dialog opens
  const [prevOpen, setPrevOpen] = useState(false);
  useEffect(() => {
    if (open && !prevOpen) {
      const sorted = [...technicians].sort((a, b) => {
        if (a.is_archived !== b.is_archived) return a.is_archived ? 1 : -1;
        return a.position - b.position;
      });
      setLocalOrder(sorted);
      setOrderChanged(false);
    }
    setPrevOpen(open);
  }, [open]);

  const activeTechs = localOrder.filter((t) => !t.is_archived);
  const archivedTechs = localOrder.filter((t) => t.is_archived);

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newActive = [...activeTechs];
    [newActive[index - 1], newActive[index]] = [newActive[index], newActive[index - 1]];
    setLocalOrder([...newActive, ...archivedTechs]);
    setOrderChanged(true);
  };

  const handleMoveDown = (index: number) => {
    if (index >= activeTechs.length - 1) return;
    const newActive = [...activeTechs];
    [newActive[index], newActive[index + 1]] = [newActive[index + 1], newActive[index]];
    setLocalOrder([...newActive, ...archivedTechs]);
    setOrderChanged(true);
  };

  const handleConfirmOrder = () => {
    const positions = activeTechs.map((t, i) => ({ id: t.id, position: i }));
    // Also include archived with positions after active
    const archivedPositions = archivedTechs.map((t, i) => ({ id: t.id, position: activeTechs.length + i }));
    onReorder([...positions, ...archivedPositions]);
    setOrderChanged(false);
    toast.success("Ordre des techniciens mis à jour");
  };

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
      // Enforce INT prefix
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

  const renderTechRow = (tech: Technician, index: number, isActive: boolean) => (
    <div
      key={tech.id}
      className={`flex items-center justify-between gap-2 p-3 rounded-lg border transition-colors ${
        tech.is_archived
          ? 'bg-muted/30 hover:bg-muted/40 opacity-60'
          : 'bg-background hover:bg-muted/50'
      }`}
    >
      {editingId === tech.id ? (
        <>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit(tech.id);
              if (e.key === 'Escape') handleCancelEdit();
            }}
            className="h-8"
            autoFocus
          />
          <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={() => handleSaveEdit(tech.id)}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={handleCancelEdit}>
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          {/* Position number + name */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isActive && (
              <span className="text-xs text-muted-foreground font-mono w-5 text-center flex-shrink-0">
                {index + 1}
              </span>
            )}
            <span className={`font-medium truncate ${tech.is_archived ? 'text-muted-foreground italic' : ''}`}>
              {tech.name}
            </span>
            {!tech.is_archived && (
              <label className="flex items-center gap-1 cursor-pointer" title="Intérimaire">
                <input
                  type="checkbox"
                  checked={tech.is_temp || false}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    // Enforce INT prefix when toggling is_temp status
                    let updatedName = tech.name;
                    if (isChecked && !updatedName.startsWith('INT ')) {
                      updatedName = `INT ${updatedName}`;
                    } else if (!isChecked && updatedName.startsWith('INT ')) {
                      updatedName = updatedName.replace(/^INT /, '');
                    }
                    onNameChange(tech.id, updatedName, isChecked);
                  }}
                  className="rounded border-border h-3 w-3"
                />
                <span className="text-[10px] text-muted-foreground uppercase">INT</span>
              </label>
            )}
            {tech.is_archived && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded flex-shrink-0">
                Archivé
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Reorder buttons for active techs */}
            {isActive && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === activeTechs.length - 1}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </>
            )}
            {!tech.is_archived && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleStartEdit(tech)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant={tech.is_archived ? 'outline' : 'ghost'}
              className="h-8 w-8"
              onClick={() =>
                setConfirmDialog({
                  open: true,
                  technicianId: tech.id,
                  technicianName: tech.name,
                  action: tech.is_archived ? 'unarchive' : 'archive',
                })
              }
            >
              {tech.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] bg-card max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Gérer les techniciens</DialogTitle>
            <DialogDescription>
              Ajoutez, modifiez, archivez ou réordonnez les techniciens. L'ordre définit l'affichage sur le planning.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4 flex-1 min-h-0 overflow-y-auto">
            {/* Add new technician form */}
            {isAddingNew ? (
              <div className="space-y-2 p-3 rounded-lg border bg-muted/50">
                <div className="flex items-center gap-2">
                  <Input
                    value={newTechName}
                    onChange={(e) => setNewTechName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddNew();
                      if (e.key === 'Escape') {
                        setIsAddingNew(false);
                        setNewTechName('');
                        setIsTemp(false);
                      }
                    }}
                    placeholder="Nom du technicien"
                    className="h-8"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleAddNew}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => {
                      setIsAddingNew(false);
                      setNewTechName('');
                      setIsTemp(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isTemp}
                    onChange={(e) => setIsTemp(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span>Intérimaire</span>
                </label>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => setIsAddingNew(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un technicien
              </Button>
            )}

            {/* Active technicians */}
            {activeTechs.map((tech, index) => renderTechRow(tech, index, true))}

            {/* Archived section */}
            {archivedTechs.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground uppercase tracking-wide pt-2 pb-1 px-1">
                  Archivés
                </div>
                {archivedTechs.map((tech, index) => renderTechRow(tech, index, false))}
              </>
            )}
          </div>
          {orderChanged && (
            <DialogFooter>
              <Button onClick={handleConfirmOrder}>
                Confirmer l'ordre
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ ...confirmDialog, open: false })}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === 'archive' ? 'Archiver' : 'Désarchiver'} le technicien
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === 'archive'
                ? `Êtes-vous sûr de vouloir archiver ${confirmDialog.technicianName} ? Ce technicien ne pourra plus être assigné à de nouveaux chantiers.`
                : `Êtes-vous sûr de vouloir désarchiver ${confirmDialog.technicianName} ? Ce technicien pourra à nouveau être assigné à des chantiers.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
