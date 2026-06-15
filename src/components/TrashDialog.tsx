import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useDeletedAssignments, useRestoreAssignment, useHardDeleteAssignment } from '@/hooks/usePlanning';

interface TrashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TrashDialog: React.FC<TrashDialogProps> = ({ open, onOpenChange }) => {
  const { data: deletedItems = [], isLoading, refetch } = useDeletedAssignments();
  const restoreMutation = useRestoreAssignment();
  const hardDeleteMutation = useHardDeleteAssignment();

  React.useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  const handleRestore = async (id: string) => {
    try {
      await restoreMutation.mutateAsync(id);
      toast.success('Affectation restaurée');
    } catch {
      toast.error('Erreur lors de la restauration');
    }
  };

  const handleHardDelete = async (id: string) => {
    if (!confirm('Attention: Cette action est irréversible. Supprimer définitivement ?')) return;
    try {
      await hardDeleteMutation.mutateAsync(id);
      toast.success('Suppression définitive effectuée');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Corbeille des affectations
          </DialogTitle>
          {/* This fixes the console warning quietly! */}
          <DialogDescription className="sr-only">
            Liste des éléments supprimés et options de restauration.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {isLoading ? (
            <p className="text-center text-muted-foreground">Chargement...</p>
          ) : deletedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Trash2 className="w-12 h-12 mb-3 opacity-20" />
              <p>La corbeille est vide.</p>
            </div>
          ) : (
            <div className="divide-y border rounded-md">
              {deletedItems.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">
                      {item.commandes?.client} - {item.commandes?.chantier}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(item.start_date), 'EEEE d MMMM yyyy', { locale: fr })} • Équipe: {item.teams?.name || 'Inconnue'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleRestore(item.id)} disabled={restoreMutation.isPending} className="h-8 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                      <RotateCcw className="w-3.5 h-3.5" /> Restaurer
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleHardDelete(item.id)} disabled={hardDeleteMutation.isPending} className="h-8 gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Supprimer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};