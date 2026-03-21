import { Assignment } from '@/types/planning';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Edit, Copy, Trash2, CopyPlus, MapPin } from 'lucide-react';

interface Commande {
  id: string;
  client: string;
  chantier: string;
}

interface AssignmentContextMenuProps {
  children: React.ReactNode;
  assignment: Assignment;
  commandes: Commande[];
  onEdit?: (assignment: Assignment) => void;
  onDuplicate?: (assignment: Assignment) => void;
  onCopyToClipboard?: (assignment: Assignment) => void;
  onDelete?: (assignment: Assignment) => void;
  disabled?: boolean;
}

export const AssignmentContextMenu = ({
  children,
  assignment,
  commandes,
  onEdit,
  onDuplicate,
  onCopyToClipboard,
  onDelete,
  disabled = false,
}: AssignmentContextMenuProps) => {
  if (disabled) {
    return <>{children}</>;
  }

  const commande = commandes.find(c => c.id === assignment.commandeId);
  const hasAddress = commande?.chantier;

  const handleOpenMaps = () => {
    if (hasAddress) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hasAddress)}`, '_blank');
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {onEdit && (
          <ContextMenuItem onClick={() => onEdit(assignment)} className="gap-2">
            <Edit className="h-4 w-4" />
            Modifier
          </ContextMenuItem>
        )}
        {onDuplicate && (
          <ContextMenuItem onClick={() => onDuplicate(assignment)} className="gap-2">
            <CopyPlus className="h-4 w-4" />
            Dupliquer
          </ContextMenuItem>
        )}
        {onCopyToClipboard && (
          <ContextMenuItem onClick={() => onCopyToClipboard(assignment)} className="gap-2">
            <Copy className="h-4 w-4" />
            Copier le texte
          </ContextMenuItem>
        )}
        {hasAddress && (
          <ContextMenuItem onClick={handleOpenMaps} className="gap-2">
            <MapPin className="h-4 w-4" />
            Ouvrir dans Maps
          </ContextMenuItem>
        )}
        {onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem 
              onClick={() => onDelete(assignment)} 
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
