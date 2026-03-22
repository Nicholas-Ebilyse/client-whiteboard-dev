import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Assignment, Chantier } from '@/types/planning';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Copy, MapPin, ExternalLink, Upload, X, FileIcon, ImageIcon, Loader2 } from 'lucide-react';
import { format, isBefore, isAfter, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from './SearchableSelect';
import { DeleteAssignmentConfirmDialog } from './DeleteAssignmentConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { useMaxAssignmentsPerPeriod } from '@/hooks/useAppSettings';

const getShortChantierName = (address: string) => {
  if (!address) return '';
  // Try to match standard French format: zip code followed by city
  const match = address.match(/\b\d{5}\s+([A-Za-zÀ-ÖØ-öø-ÿ\-\s]+?)(?:,|$)/);
  if (match) {
    return match[1].trim();
  }
  
  // Fallback splitting by comma
  const parts = address.split(',').map(p => p.trim());
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (lastPart.toLowerCase() === 'france' && parts.length > 1) {
      return parts[parts.length - 2].replace(/^\d{5}\s+/, '').trim();
    }
    return lastPart.replace(/^\d{5}\s+/, '').trim();
  }
  return address;
};

interface EditAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment | null;

  commandes: any[]; // Issue #3: Add commandes for address lookup
  teams: any[];
  assignments: Assignment[];
  onSave: (assignment: Assignment) => void;
  onDelete?: (id: string) => void;
  onDeleteGroup?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onBulkUpdateName?: (commandeId: string, name: string) => void;
  allDbAssignments?: any[]; // Raw DB assignments for finding linked technicians
}

export const EditAssignmentDialog = ({
  open,
  onOpenChange,
  assignment,

  commandes, // Issue #3: Receive commandes prop
  teams,
  assignments,
  onSave,
  onDelete,
  onDeleteGroup,
  onDuplicate,
  onBulkUpdateName,
  allDbAssignments = [],
}: EditAssignmentDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date();
  const [selectedTeam, setSelectedTeam] = useState(assignment?.teamId || '');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedCommande, setSelectedCommande] = useState(assignment?.commandeId || '');
  const [startDate, setStartDate] = useState<Date | undefined>(
    assignment ? new Date(assignment.startDate) : today
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    assignment ? new Date(assignment.endDate) : today
  );
  const [isConfirmed, setIsConfirmed] = useState(assignment?.isConfirmed || false);
  const [comment, setComment] = useState(assignment?.comment || '');
  const [chantierDisplayName, setChantierDisplayName] = useState(assignment?.name || '');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);


  useEffect(() => {
    if (assignment) {
      setSelectedTeam(assignment.teamId || '');
      const initialCommande = assignment.commandeId ? commandes.find((c: any) => c.id === assignment.commandeId) : null;
      setSelectedClient(initialCommande?.client || '');
      setSelectedCommande(assignment.commandeId || '');
      setStartDate(new Date(assignment.startDate));
      setEndDate(new Date(assignment.endDate));
      setIsConfirmed(assignment.isConfirmed || false);
      setComment(assignment.comment || '');
      setChantierDisplayName(assignment.name || '');
    }
  }, [assignment, commandes]);

  const { maxAssignments: MAX_ASSIGNMENTS_PER_PERIOD } = useMaxAssignmentsPerPeriod();

  const countAssignmentsInRange = (teamId: string, start: Date, end: Date): number => {
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    return assignments.filter(a => {
      if (a.teamId !== teamId) return false;
      if (assignment?.id === a.id) return false;
      const aStartStr = format(new Date(a.startDate), 'yyyy-MM-dd');
      const aEndStr = format(new Date(a.endDate), 'yyyy-MM-dd');
      return !(endStr < aStartStr || startStr > aEndStr);
    }).length;
  };

  const handleSave = async () => {
    if (assignment && selectedTeam && selectedCommande && startDate && endDate) {
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      
      if (endDateStr < startDateStr) {
        toast({
          title: 'Erreur',
          description: 'La date de fin ne peut pas précéder la date de début.',
          variant: 'destructive',
        });
        return;
      }

      const count = countAssignmentsInRange(selectedTeam, startDate, endDate);
      if (count >= MAX_ASSIGNMENTS_PER_PERIOD) {
        const teamName = teams.find((t: any) => t.id === selectedTeam)?.name || 'L\'équipe';
        toast({
          title: 'Limite d\'affectations atteinte',
          description: `${teamName} a déjà le maximum d'affectations sur cette période.`,
          variant: 'destructive',
        });
        return;
      }


      
      const trimmedName = chantierDisplayName.trim() || assignment.name;
      const updatedAssignment: Assignment = {
        ...assignment,
        teamId: selectedTeam,
        name: trimmedName,
        commandeId: selectedCommande,
        startDate: startDateStr,
        endDate: endDateStr,
        isConfirmed,
        comment,
      };

      // Propagate the name change to all other assignments with the same commande
      if (onBulkUpdateName && selectedCommande && trimmedName !== assignment.name) {
        onBulkUpdateName(selectedCommande, trimmedName);
      }
      
      onSave(updatedAssignment);
      onOpenChange(false);
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteSingle = () => {
    if (assignment?.id && onDelete) {
      onDelete(assignment.id);
      setDeleteDialogOpen(false);
      onOpenChange(false);
    }
  };

  const handleDeleteGroup = () => {
    if (assignment?.assignment_group_id && onDeleteGroup) {
      onDeleteGroup(assignment.assignment_group_id);
      setDeleteDialogOpen(false);
      onOpenChange(false);
    }
  };

  const handleDuplicate = () => {
    if (assignment?.id && onDuplicate) {
      onDuplicate(assignment.id);
      onOpenChange(false);
    }
  };

  const clientOptions = useMemo(() => {
    const clients = Array.from(new Set(commandes.map((c: any) => c.client).filter(Boolean))) as string[];
    return clients.sort().map(client => ({ value: client, label: client }));
  }, [commandes]);

  const chantierOptions = useMemo(() => {
    if (!selectedClient) return [];
    return commandes
      .filter((c: any) => c.client === selectedClient)
      .map((c: any) => ({
        value: c.id,
        label: c.chantier ? getShortChantierName(c.chantier) : c.name,
      }));
  }, [commandes, selectedClient, assignment?.commandeId]);

  // Auto-select chantier if there is only one option available
  useEffect(() => {
    if (selectedClient && chantierOptions.length === 1 && !selectedCommande) {
      setSelectedCommande(chantierOptions[0].value);
    }
  }, [selectedClient, chantierOptions, selectedCommande]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] bg-card max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Éditer l'affectation</DialogTitle>
          </DialogHeader>

        <div className="space-y-6 py-4 max-h-[calc(90vh-200px)] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="team">Équipe</Label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger id="team" className="bg-background">
                <SelectValue placeholder="Sélectionner une équipe" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team: any) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <SearchableSelect
                value={selectedClient}
                onValueChange={(val) => {
                  setSelectedClient(val);
                  setSelectedCommande('');
                }}
                options={clientOptions}
                placeholder="Sélectionner un client..."
              />
            </div>

            {selectedClient && (
              <div className="space-y-2">
                <Label>Chantier</Label>
                <SearchableSelect
                  value={selectedCommande}
                  onValueChange={(val) => {
                    setSelectedCommande(val);
                    // Pre-fill display name from the new commande's existing name
                    const newComm = commandes.find((c: any) => c.id === val);
                    if (newComm) {
                      const autoName = newComm.name || getShortChantierName(newComm.chantier || '');
                      setChantierDisplayName(autoName);
                    }
                  }}
                  options={chantierOptions}
                  placeholder="Sélectionner un chantier..."
                />
              </div>
            )}

            {selectedCommande && (
              <div className="space-y-2">
                <Label htmlFor="chantier-name">Nom affiché sur le planning</Label>
                <Input
                  id="chantier-name"
                  value={chantierDisplayName}
                  onChange={(e) => setChantierDisplayName(e.target.value)}
                  placeholder="Nom abrégé du chantier"
                />
              </div>
            )}
          </div>

          {/* Address display with Google Maps link using commande.chantier field */}
          {selectedCommande && (() => {
            const selectedComm = commandes.find((c: any) => c.id === selectedCommande);
            if (selectedComm?.chantier) {
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedComm.chantier)}`;
              return (
                <div className="space-y-2 bg-muted/30 p-3 rounded-md">
                  <Label className="text-xs text-muted-foreground">Adresse</Label>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input 
                      readOnly
                      value={selectedComm.chantier}
                      className="flex-1 bg-muted text-sm text-muted-foreground cursor-default"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(mapsUrl, '_blank')}
                      className="flex-shrink-0"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Maps
                    </Button>
                  </div>
                </div>
              );
            }
            return null;
          })()}



          <div className="space-y-2">
            <Label htmlFor="assignment-comment">Notes/Commentaires supplémentaires</Label>
            <Textarea
              id="assignment-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex: Intervenir après 10h, Appeler le gardien..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date début</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isConfirmed}
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
                    disabled={isConfirmed}
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
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row sm:justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="confirmed" 
              checked={isConfirmed}
              onCheckedChange={(checked) => setIsConfirmed(checked as boolean)}
            />
            <label htmlFor="confirmed" className="text-sm cursor-pointer">Confirmé</label>
          </div>
          <div className="flex gap-2 flex-wrap">
            {assignment?.id && !assignment.id.startsWith('new-') && onDuplicate && (
              <Button type="button" variant="outline" onClick={handleDuplicate} size="sm">
                <Copy className="h-4 w-4 mr-2" />
                Dupliquer
              </Button>
            )}
            {assignment?.id && !assignment.id.startsWith('new-') && onDelete && (
              <Button type="button" variant="destructive" onClick={handleDeleteClick} size="sm">
                Supprimer
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
              Annuler
            </Button>
            <Button onClick={handleSave} className="bg-success hover:bg-success/90" size="sm">
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <DeleteAssignmentConfirmDialog
      open={deleteDialogOpen}
      onOpenChange={setDeleteDialogOpen}
      assignment={assignment}
      onConfirmSingle={handleDeleteSingle}
      onConfirmGroup={handleDeleteGroup}
    />
  </>
  );
};