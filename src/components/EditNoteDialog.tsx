import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
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
    period: string;
    start_period?: string;
    end_period?: string;
    is_sav?: boolean;
    is_confirmed?: boolean;
    is_invoiced?: boolean;
    display_below?: boolean;
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
  const [startPeriod, setStartPeriod] = useState<'Matin' | 'Après-midi'>('Matin');
  const [endPeriod, setEndPeriod] = useState<'Matin' | 'Après-midi'>('Après-midi');
  const [isSav, setIsSav] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isInvoiced, setIsInvoiced] = useState(false);
  const [displayBelow, setDisplayBelow] = useState(false);

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
      
      setStartPeriod((note.start_period || note.period || 'Matin') as 'Matin' | 'Après-midi');
      setEndPeriod((note.end_period || note.period || 'Après-midi') as 'Matin' | 'Après-midi');
      setIsSav(note.is_sav || false);
      setIsConfirmed(note.is_confirmed || false);
      setIsInvoiced(note.is_invoiced || false);
      setDisplayBelow(note.display_below || false);
    } else {
      // Initialize with today's date for new notes
      const today = new Date();
      setText('');
      setTechnicianId('');
      setStartDate(today);
      setEndDate(today);
      setStartPeriod('Matin');
      setEndPeriod('Après-midi');
      setIsSav(false);
      setIsConfirmed(false);
      setIsInvoiced(false);
      setDisplayBelow(false);
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
      end_date: format(endDate, 'yyyy-MM-dd'),
      period: startPeriod, // Keep for backward compatibility
      start_period: startPeriod,
      end_period: endPeriod,
      is_sav: isSav,
      is_confirmed: isConfirmed,
      is_invoiced: isInvoiced,
      display_below: displayBelow,
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-period">Période début</Label>
              <Select value={startPeriod} onValueChange={(v) => setStartPeriod(v as 'Matin' | 'Après-midi')}>
                <SelectTrigger id="start-period" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="Matin">Matin</SelectItem>
                  <SelectItem value="Après-midi">Après-midi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-period">Période fin</Label>
              <Select value={endPeriod} onValueChange={(v) => setEndPeriod(v as 'Matin' | 'Après-midi')}>
                <SelectTrigger id="end-period" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="Matin">Matin</SelectItem>
                  <SelectItem value="Après-midi">Après-midi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-4 mb-2">
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
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="display-below" 
                  checked={displayBelow}
                  onCheckedChange={(checked) => setDisplayBelow(checked as boolean)}
                />
                <label htmlFor="display-below" className="text-sm cursor-pointer">Note en bas</label>
              </div>
            </div>
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