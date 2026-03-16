import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { toast } from 'sonner';

interface EditGeneralNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: { 
    id?: string; 
    text: string; 
    date: string;
    period: 'Matin' | 'Après-midi' | 'Journée';
    is_confirmed?: boolean;
  } | null;
  onSave: (note: Record<string, unknown>) => void;
  onDelete?: (id: string) => void;
}

export const EditGeneralNoteDialog = ({ open, onOpenChange, note, onSave, onDelete }: EditGeneralNoteDialogProps) => {
  const [text, setText] = useState('');

  useEffect(() => {
    if (note) {
      setText(note.text);
    } else {
      setText('');
    }
  }, [note]);

  const handleSave = () => {
    if (!text.trim()) {
      toast.error('Veuillez saisir une note');
      return;
    }
    
    onSave({
      id: note?.id,
      text: text.trim(),
      technician_id: null,
      start_date: note?.date,
      end_date: note?.date,
      period: note?.period === 'Journée' ? 'Matin' : note?.period,
      start_period: note?.period === 'Journée' ? 'Matin' : note?.period,
      end_period: note?.period === 'Journée' ? 'Après-midi' : note?.period,
      is_sav: false,
      is_confirmed: false,
      is_invoiced: false,
    });
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (note?.id && onDelete) {
      onDelete(note.id);
      onOpenChange(false);
    }
  };

  const getPeriodLabel = () => {
    if (!note) return '';
    if (note.period === 'Journée') return 'toute la journée';
    return note.period.toLowerCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-card">
        <DialogHeader>
          <DialogTitle>{note?.id ? 'Modifier la note générale' : 'Nouvelle note générale'}</DialogTitle>
          <DialogDescription>
            Note pour tous les techniciens - {getPeriodLabel()}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="note-text">Note</Label>
            <Textarea
              id="note-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Entrez votre note..."
              rows={4}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {note?.id && onDelete && (
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" onClick={handleSave}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
