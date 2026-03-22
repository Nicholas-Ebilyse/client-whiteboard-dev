import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Edit, Copy, Trash2 } from 'lucide-react';

interface Note {
  id: string;
  text: string;
}

interface NoteContextMenuProps {
  children: React.ReactNode;
  note: Note;
  onEdit?: (note: Note) => void;
  onDuplicate?: (note: Note) => void;
  onDelete?: (note: Note) => void;
  disabled?: boolean;
}

export const NoteContextMenu = ({
  children,
  note,
  onEdit,
  onDuplicate,
  onDelete,
  disabled = false,
}: NoteContextMenuProps) => {
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {onEdit && (
          <ContextMenuItem onClick={() => onEdit(note)} className="gap-2">
            <Edit className="h-4 w-4" />
            Modifier
          </ContextMenuItem>
        )}
        {onDuplicate && (
          <ContextMenuItem onClick={() => onDuplicate(note)} className="gap-2">
            <Copy className="h-4 w-4" />
            Dupliquer
          </ContextMenuItem>
        )}
        {onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem 
              onClick={() => onDelete(note)} 
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
