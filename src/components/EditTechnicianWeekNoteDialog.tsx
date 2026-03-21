import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';
import { format, parseISO, addDays, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Copy } from 'lucide-react';

interface Technician {
  id: string;
  name: string;
}

interface EditTechnicianWeekNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: { 
    id?: string; 
    text: string; 
    technician_id: string;
    technician_name: string;
    date: string;
    is_sav?: boolean;
    is_confirmed?: boolean;

  } | null;
  onSave: (note: any) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (notes: any[]) => void;
  technicians?: Technician[];
  weekDates?: string[];
}

export const EditTechnicianWeekNoteDialog = ({ 
  open, 
  onOpenChange, 
  note, 
  onSave, 
  onDelete,
  onDuplicate,
  technicians = [],
  weekDates = [],
}: EditTechnicianWeekNoteDialogProps) => {
  const [text, setText] = useState('');
  const [isSav, setIsSav] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const [showDuplicateOptions, setShowDuplicateOptions] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);

  useEffect(() => {
    if (note) {
      setText(note.text);
      setIsSav(note.is_sav || false);
      setIsConfirmed(note.is_confirmed || false);

      setShowDuplicateOptions(false);
      setSelectedDays([]);
      setSelectedTechnicians([]);
    } else {
      setText('');
      setIsSav(false);
      setIsConfirmed(false);

      setShowDuplicateOptions(false);
      setSelectedDays([]);
      setSelectedTechnicians([]);
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
      technician_id: note?.technician_id,
      start_date: note?.date,
      end_date: note?.date,
      period: 'Matin',
      start_period: 'Matin',
      end_period: 'Après-midi',
      is_sav: isSav,
      is_confirmed: isConfirmed,

    });
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (note?.id && onDelete) {
      onDelete(note.id);
      onOpenChange(false);
    }
  };

  const handleDuplicate = () => {
    if (!text.trim()) {
      toast.error('Veuillez saisir une note');
      return;
    }

    if (selectedDays.length === 0 && selectedTechnicians.length === 0) {
      toast.error('Sélectionnez au moins un jour ou un technicien');
      return;
    }

    const notesToCreate: any[] = [];
    
    // Get days to duplicate to
    const targetDays = selectedDays.length > 0 ? selectedDays : [note?.date || ''];
    // Get technicians to duplicate to  
    const targetTechs = selectedTechnicians.length > 0 ? selectedTechnicians : [note?.technician_id || ''];

    for (const day of targetDays) {
      for (const techId of targetTechs) {
        // Skip the original note
        if (day === note?.date && techId === note?.technician_id) continue;
        
        notesToCreate.push({
          text: text.trim(),
          technician_id: techId,
          start_date: day,
          end_date: day,
          period: 'Matin',
          start_period: 'Matin',
          end_period: 'Après-midi',
          is_sav: isSav,
          is_confirmed: isConfirmed,

        });
      }
    }

    if (notesToCreate.length === 0) {
      toast.error('Aucune nouvelle note à créer');
      return;
    }

    if (onDuplicate) {
      onDuplicate(notesToCreate);
    }
    onOpenChange(false);
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleTechnician = (techId: string) => {
    setSelectedTechnicians(prev => 
      prev.includes(techId) ? prev.filter(t => t !== techId) : [...prev, techId]
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'EEEE d MMMM', { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const formatShortDay = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'EEE d', { locale: fr });
    } catch {
      return dateStr;
    }
  };

  // Filter out current day/technician from options
  const otherDays = weekDates.filter(d => d !== note?.date);
  const otherTechnicians = technicians.filter(t => t.id !== note?.technician_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{note?.id ? 'Modifier la note' : 'Nouvelle note'}</DialogTitle>
          <DialogDescription>
            Note pour {note?.technician_name} - {note?.date ? formatDate(note.date) : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-4 flex-wrap gap-y-2">
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

          {/* Duplicate options */}
          {(otherDays.length > 0 || otherTechnicians.length > 0) && (
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDuplicateOptions(!showDuplicateOptions)}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Dupliquer vers...
              </Button>

              {showDuplicateOptions && (
                <div className="mt-4 space-y-4">
                  {/* Days selection */}
                  {otherDays.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Autres jours de la semaine</Label>
                      <div className="flex flex-wrap gap-2">
                        {otherDays.map(day => (
                          <Button
                            key={day}
                            type="button"
                            variant={selectedDays.includes(day) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleDay(day)}
                            className="text-xs"
                          >
                            {formatShortDay(day)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Technicians selection */}
                  {otherTechnicians.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Autres techniciens</Label>
                      <div className="flex flex-wrap gap-2">
                        {otherTechnicians.map(tech => (
                          <Button
                            key={tech.id}
                            type="button"
                            variant={selectedTechnicians.includes(tech.id) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleTechnician(tech.id)}
                            className="text-xs"
                          >
                            {tech.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(selectedDays.length > 0 || selectedTechnicians.length > 0) && (
                    <Button
                      type="button"
                      onClick={handleDuplicate}
                      className="w-full gap-2"
                      variant="secondary"
                    >
                      <Copy className="h-4 w-4" />
                      Créer {Math.max(1, selectedDays.length || 1) * Math.max(1, selectedTechnicians.length || 1) - (selectedDays.length === 0 && selectedTechnicians.length === 0 ? 1 : 0)} copie(s)
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
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
