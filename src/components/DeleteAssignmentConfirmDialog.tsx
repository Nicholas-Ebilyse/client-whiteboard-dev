import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Assignment } from '@/types/planning';

interface DeleteAssignmentConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment | null;
  onConfirmSingle: () => void;
  onConfirmGroup: () => void;
}

export const DeleteAssignmentConfirmDialog = ({
  open,
  onOpenChange,
  assignment,
  onConfirmSingle,
  onConfirmGroup,
}: DeleteAssignmentConfirmDialogProps) => {
  const isGrouped = assignment?.assignment_group_id;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-card max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            ⚠️ Confirmer la suppression
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            {isGrouped ? (
              <>
                <p className="text-foreground font-medium">
                  Cette affectation fait partie d'un groupe d'affectations liées.
                </p>
                <p>
                  Voulez-vous supprimer uniquement cette affectation ou toutes les affectations du groupe ?
                </p>
                <div className="bg-muted/50 p-3 rounded-md text-sm">
                  <strong>Note :</strong> Si vous supprimez tout le groupe, toutes les affectations liées 
                  (même période, même chantier) seront supprimées définitivement.
                </div>
              </>
            ) : (
              <>
                <p className="text-foreground font-medium">
                  Êtes-vous sûr de vouloir supprimer cette affectation ?
                </p>
                <p className="text-destructive">
                  Cette action est irréversible.
                </p>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col gap-2 sm:gap-2">
          {isGrouped ? (
            <>
              <AlertDialogCancel className="w-full m-0">Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirmGroup}
                className="bg-destructive hover:bg-destructive/90 w-full m-0"
              >
                Tout le groupe
              </AlertDialogAction>
              <AlertDialogAction
                onClick={onConfirmSingle}
                className="bg-warning hover:bg-warning/90 w-full m-0"
              >
                Celle-ci uniquement
              </AlertDialogAction>
            </>
          ) : (
            <>
              <AlertDialogCancel className="w-full">Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirmSingle}
                className="bg-destructive hover:bg-destructive/90 w-full"
              >
                Supprimer
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
