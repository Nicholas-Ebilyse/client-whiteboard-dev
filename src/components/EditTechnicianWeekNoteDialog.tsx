import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Copy } from 'lucide-react';

interface Team {
  id: string;
  name: string;
}

interface EditTeamNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: { 
    id?: string; 
    text: string; 
    technician_id?: string; // kept for backward compat during state passing, ignored on save
    technician_name?: string;
    team_id?: string;
    date: string;
    is_sav?: boolean;
  } | null;
  onSave: (note: Record<string, unknown>) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (notes: Record<string, unknown>[]) => void;
  technicians?: Team[]; // kept for backward compat with interface; used as teams list
  weekDates?: string[];
}

export const EditTechnicianWeekNoteDialog = ({ 
  open, 
  onOpenChange, 
  note, 
  onSave, 
  onDelete,
  onDuplicate,
  technicians: teams = [],
  weekDates = [],
}: EditTeamNoteDialogProps) => {
  const [text, setText] = useState('');
  const [isSav, setIsSav] = useState(false);
  const [showDuplicateOptions, setShowDuplicateOptions] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  useEffect(() => {
    if (note) {
      setText(note.text);
      setIsSav(note.is_sav || false);
      setShowDuplicateOptions(false);
      setSelectedDays([]);
      setSelectedTeams([]);
    } else {
      setText('');
      setIsSav(false);
      setShowDuplicateOptions(false);
      setSelectedDays([]);
      setSelectedTeams([]);
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
      team_id: note?.team_id || null,
      start_date: note?.date,
      end_date: note?.date,
      period: 'Matin',
      start_period: 'Matin',
      end_period: 'Après-midi',
      is_sav: isSav,
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

    if (selectedDays.length === 0 && selectedTeams.length === 0) {
      toast.error('Sélectionnez au moins un jour ou une équipe');
      return;
    }

    const notesToCreate: Record<string, unknown>[] = [];
    const targetDays = selectedDays.length > 0 ? selectedDays : [note?.date || ''];
    const targetTeams = selectedTeams.length > 0 ? selectedTeams : [note?.team_id || ''];

    for (const day of targetDays) {
      for (const teamId of targetTeams) {
        if (day === note?.date && teamId === note?.team_id) continue;
        notesToCreate.push({
          text: text.trim(),
          team_id: teamId,
          start_date: day,
          end_date: day,
          period: 'Matin',
          start_period: 'Matin',
          end_period: 'Après-midi',
          is_sav: isSav,
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
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeams(prev => prev.includes(teamId) ? prev.filter(t => t !== teamId) : [...prev, teamId]);
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

  const currentTeamName = teams.find(t => t.id === note?.team_id)?.name || note?.technician_name || '';
  const otherDays = weekDates.filter(d => d !== note?.date);
  const otherTeams = teams.filter(t => t.id !== note?.team_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{note?.id ? 'Modifier la note' : 'Nouvelle note'}</DialogTitle>
          <DialogDescription>
            {currentTeamName 
              ? `Note pour ${currentTeamName} - ${note?.date ? formatDate(note.date) : ''}`
              : `Nouvelle note pour le ${note?.date ? formatDate(note.date) : ''}`
            }
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

          {/* Duplicate options */}
          {(otherDays.length > 0 || otherTeams.length > 0) && (
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

                  {otherTeams.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Autres équipes</Label>
                      <div className="flex flex-wrap gap-2">
                        {otherTeams.map(team => (
                          <Button
                            key={team.id}
                            type="button"
                            variant={selectedTeams.includes(team.id) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleTeam(team.id)}
                            className="text-xs"
                          >
                            {team.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(selectedDays.length > 0 || selectedTeams.length > 0) && (
                    <Button
                      type="button"
                      onClick={handleDuplicate}
                      className="w-full gap-2"
                      variant="secondary"
                    >
                      <Copy className="h-4 w-4" />
                      Créer {Math.max(1, selectedDays.length || 1) * Math.max(1, selectedTeams.length || 1)} copie(s)
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
