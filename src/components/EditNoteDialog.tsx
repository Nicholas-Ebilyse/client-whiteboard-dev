import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: {
    id?: string;
    text: string;
    technician_id: string;
    start_date: string;
    end_date?: string;
    period?: string;
    start_period?: string;
    end_period?: string;
    weather_condition?: string;
  } | null;
  technicians: { id: string; name: string }[];
  weekDates: { fullDate: string; date: string }[];
  onSave: (note: any) => void;
  onDelete?: (id: string) => void;
}

export const EditNoteDialog = ({ open, onOpenChange, note, technicians, weekDates, onSave, onDelete }: EditNoteDialogProps) => {
  const today = new Date();
  const [text, setText] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [weatherCondition, setWeatherCondition] = useState('none');

  useEffect(() => {
    if (note) {
      setText(note.text);
      setTechnicianId(note.technician_id);

      // Safely parse start date
      const parsedStartDate = note.start_date ? new Date(note.start_date) : undefined;
      setStartDate(parsedStartDate && !isNaN(parsedStartDate.getTime()) ? parsedStartDate : undefined);

      // Safely parse end date
      const dateToUse = note.end_date || note.start_date;
      const parsedEndDate = dateToUse ? new Date(dateToUse) : undefined;
      setEndDate(parsedEndDate && !isNaN(parsedEndDate.getTime()) ? parsedEndDate : undefined);
      setWeatherCondition(note.weather_condition || 'none');
    } else {
      setText('');
      setTechnicianId('');
      setStartDate(today);
      setEndDate(today);
      setWeatherCondition('none');
    }
  }, [note]);

  const handleSave = () => {
    if (!startDate || !endDate || !technicianId || !text.trim()) {
      toast.error('Veuillez remplir le champ note');
      return;
    }

    onSave({
      ...note,
      text: text.trim(),
      technician_id: technicianId,
      start_date: format(startDate, 'yyyy-MM-dd'),
      weather_condition: weatherCondition === 'none' ? null : weatherCondition,
    });
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (note?.id && onDelete) {
      onDelete(note.id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card">
        <DialogHeader>
          <DialogTitle>{note?.id ? 'Modifier la note' : 'Nouvelle note'}</DialogTitle>
          <DialogDescription>
            {note?.id ? 'Modifiez le contenu de la note' : 'Créez une nouvelle note'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="technician">Technicien</Label>
            <Select value={technicianId} onValueChange={setTechnicianId}>
              <SelectTrigger id="technician" className="bg-background">
                <SelectValue placeholder="Sélectionner un technicien" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {[...technicians].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date début</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal bg-background',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'dd/MM/yyyy') : 'Choisir'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    defaultMonth={startDate || today}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Date fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal bg-background',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'dd/MM/yyyy') : 'Choisir'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    defaultMonth={endDate || startDate || today}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="weather">Conditions Météo</Label>
            <Select value={weatherCondition} onValueChange={setWeatherCondition}>
              <SelectTrigger id="weather" className="bg-background">
                <SelectValue placeholder="Sélectionner une condition" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="none">Aucune / Normal</SelectItem>
                <SelectItem value="SOLEIL">☀️ Soleil / Dégagé</SelectItem>
                <SelectItem value="PLUIE">🌧️ Pluie</SelectItem>
                <SelectItem value="NEIGE">❄️ Neige</SelectItem>
                <SelectItem value="VENT">💨 Vent Fort</SelectItem>
                <SelectItem value="GEL">🧊 Gel / Verglas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note-text">Note</Label>
            <Textarea
              id="note-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Entrez votre note..."
              rows={4}
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