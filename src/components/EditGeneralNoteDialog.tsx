import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';

interface EditGeneralNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: { 
    id?: string; 
    text: string; 
    date: string;
    period: 'Matin' | 'Après-midi' | 'Journée';
    is_sav?: boolean;
    is_confirmed?: boolean;
    is_invoiced?: boolean;
  } | null;
  onSave: (note: any) => void;
  onDelete?: (id: string) => void;
}

export const EditGeneralNoteDialog = ({ open, onOpenChange, note, onSave, onDelete }: EditGeneralNoteDialogProps) => {
  const [text, setText] = useState('');
  const [isSav, setIsSav] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isInvoiced, setIsInvoiced] = useState(false);

  useEffect(() => {
    if (note) {
      setText(note.text);
      setIsSav(note.is_sav || false);
      setIsConfirmed(note.is_confirmed || false);
      setIsInvoiced(note.is_invoiced || false);
    } else {
      setText('');
      setIsSav(false);
      setIsConfirmed(false);
      setIsInvoiced(false);
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
      technician_id: null, // General note - no specific technician
      start_date: note?.date,
      end_date: note?.date,
      period: note?.period === 'Journée' ? 'Matin' : note?.period,
      start_period: note?.period === 'Journée' ? 'Matin' : note?.period,
      end_period: note?.period === 'Journée' ? 'Après-midi' : note?.period,
      is_sav: isSav,
      is_confirmed: isConfirmed,
      is_invoiced: isInvoiced,
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
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="sav" 
                checked={isSav}
                onCheckedChange={(checked) => setIsSav(checked as boolean)}
              />
              <label htmlFor="sav" className="text-sm cursor-pointer">SAV</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="confirmed" 
                checked={isConfirmed}
                onCheckedChange={(checked) => setIsConfirmed(checked as boolean)}
              />
              <label htmlFor="confirmed" className="text-sm cursor-pointer">Confirmé</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="invoiced" 
                checked={isInvoiced}
                onCheckedChange={(checked) => setIsInvoiced(checked as boolean)}
                className="border-red-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
              />
              <label htmlFor="invoiced" className="text-sm cursor-pointer text-red-600 dark:text-red-400">Facturé</label>
            </div>
          </div>
          
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
