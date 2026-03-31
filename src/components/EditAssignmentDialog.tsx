import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Assignment } from '@/types/planning';
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
import { CalendarIcon, Copy, MapPin, ExternalLink, Upload, X, FileIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn, getShortChantierName } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from './SearchableSelect';
import { DeleteAssignmentConfirmDialog } from './DeleteAssignmentConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { useMaxAssignmentsPerPeriod } from '@/hooks/useAppSettings';
import { useUpdateCommande } from '@/hooks/usePlanning';

interface EditAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment | null;
  commandes: any[];
  teams: any[];
  assignments: Assignment[];
  onSave: (assignment: Assignment) => void;
  onDelete?: (id: string) => void;
  onDeleteGroup?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  allDbAssignments?: any[];
}

export const EditAssignmentDialog = ({
  open,
  onOpenChange,
  assignment,
  commandes,
  teams,
  assignments,
  onSave,
  onDelete,
  onDeleteGroup,
  onDuplicate,
  allDbAssignments = [],
}: EditAssignmentDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateCommande = useUpdateCommande();
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
  const [comment, setComment] = useState(assignment?.comment || '');

  // New State variables for Phase 4 UI
  const [clientPresence, setClientPresence] = useState('none');
  const [savType, setSavType] = useState('none');

  const initialName = useMemo(() => {
    if (!assignment) return '';
    const comm = commandes.find((c: any) => c.id === assignment.commandeId);
    return comm?.display_name || (comm ? `${comm.client} - ${getShortChantierName(comm.chantier || '')}` : '');
  }, [assignment, commandes]);

  const [chantierDisplayName, setChantierDisplayName] = useState(initialName);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (assignment) {
      setSelectedTeam(assignment.teamId || '');
      const initialCommande = assignment.commandeId ? commandes.find((c: any) => c.id === assignment.commandeId) : null;
      setSelectedClient(initialCommande?.client || '');
      setSelectedCommande(assignment.commandeId || '');
      setStartDate(new Date(assignment.startDate));
      setEndDate(new Date(assignment.endDate));
      setComment(assignment.comment || '');

      const officialName = initialCommande?.display_name || (initialCommande ? `${initialCommande.client} - ${getShortChantierName(initialCommande.chantier || '')}` : '');
      setChantierDisplayName(officialName);

      // Load Phase 4 values
      setClientPresence(initialCommande?.client_presence || 'none');
      setSavType(initialCommande?.sav_type || 'none');
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

      const trimmedName = chantierDisplayName.trim() || '';

      const updatedAssignment: Assignment = {
        ...assignment,
        teamId: selectedTeam,
        commandeId: selectedCommande,
        startDate: startDateStr,
        endDate: endDateStr,
        isConfirmed: clientPresence === 'P' || clientPresence === 'P+RDV', // Driven by dropdown!
        comment,
      };

      // Always update the Commande to save the Presence and SAV status
      if (selectedCommande) {
        updateCommande.mutate({
          id: selectedCommande,
          displayName: trimmedName,
          clientPresence: clientPresence === 'none' ? null : clientPresence,
          savType: savType === 'none' ? null : savType
        });
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
        label: c.chantier ? (typeof getShortChantierName === 'function' ? getShortChantierName(c.chantier) : c.chantier) : (c.display_name || c.name),
      }));
  }, [commandes, selectedClient]);

  useEffect(() => {
    if (selectedClient && chantierOptions.length === 1 && !selectedCommande) {
      const val = chantierOptions[0].value;
      setSelectedCommande(val);
      const newComm = commandes.find((c: any) => c.id === val);
      if (newComm) {
        const autoName = newComm.display_name || `${newComm.client} - ${getShortChantierName(newComm.chantier || '')}`;
        setChantierDisplayName(autoName);
        setClientPresence(newComm.client_presence || 'none');
        setSavType(newComm.sav_type || 'none');
      }
    }
  }, [selectedClient, chantierOptions, selectedCommande, commandes]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] bg-card max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Éditer l'affectation</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4 max-h-[calc(90vh-140px)] overflow-y-auto">
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
                    setChantierDisplayName('');
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
                      const newComm = commandes.find((c: any) => c.id === val);
                      if (newComm) {
                        const autoName = newComm.display_name || `${newComm.client} - ${getShortChantierName(newComm.chantier || '')}`;
                        setChantierDisplayName(autoName);
                        setClientPresence(newComm.client_presence || 'none');
                        setSavType(newComm.sav_type || 'none');
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

              {/* The Re-added UI Buttons for Phase 4 */}
              {selectedCommande && (
                <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-md border border-border mt-4">
                  <div className="space-y-2">
                    <Label>Présence Client</Label>
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        variant={clientPresence === 'none' ? 'secondary' : 'outline'}
                        onClick={() => setClientPresence('none')}
                        className="flex-1 h-8 text-[10px] transition-colors px-1"
                      >
                        Non défini
                      </Button>
                      <Button
                        type="button"
                        variant={clientPresence === 'P' ? 'default' : 'outline'}
                        onClick={() => setClientPresence('P')}
                        className={`flex-1 h-8 text-[10px] transition-colors px-1 ${clientPresence === 'P' ? 'bg-blue-500 hover:bg-blue-600 text-white border-transparent' : ''
                          }`}
                      >
                        Prévenu
                      </Button>
                      <Button
                        type="button"
                        variant={clientPresence === 'P+RDV' ? 'default' : 'outline'}
                        onClick={() => setClientPresence('P+RDV')}
                        className={`flex-1 h-8 text-[10px] transition-colors px-1 ${clientPresence === 'P+RDV' ? 'bg-green-600 hover:bg-green-700 text-white border-transparent' : ''
                          }`}
                      >
                        P+RDV
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Type SAV</Label>
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        variant={savType === 'none' ? 'secondary' : 'outline'}
                        onClick={() => setSavType('none')}
                        className="flex-1 h-8 text-[10px] transition-colors px-1"
                      >
                        Aucun
                      </Button>
                      <Button
                        type="button"
                        variant={savType === 'REPRISE' ? 'default' : 'outline'}
                        onClick={() => setSavType('REPRISE')}
                        className={`flex-1 h-8 text-[10px] transition-colors px-1 ${savType === 'REPRISE' ? 'bg-orange-500 hover:bg-orange-600 text-white border-transparent' : ''
                          }`}
                      >
                        Reprise
                      </Button>
                      <Button
                        type="button"
                        variant={savType === 'MANQUANT' ? 'default' : 'outline'}
                        onClick={() => setSavType('MANQUANT')}
                        className={`flex-1 h-8 text-[10px] transition-colors px-1 ${savType === 'MANQUANT' ? 'bg-red-500 hover:bg-red-600 text-white border-transparent' : ''
                          }`}
                      >
                        Manquant
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Attachments Section */}
              {selectedCommande && (() => {
                const selectedComm = commandes.find((c: any) => c.id === selectedCommande);
                if (!selectedComm) return null;
                const attachments = selectedComm.attachments || [];

                return (
                  <div className="space-y-3 bg-muted/20 p-4 rounded-md border border-border">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Fichiers ({attachments.length}/3)</Label>
                    </div>

                    {attachments.length > 0 && (
                      <div className="grid grid-cols-1 gap-2">
                        {attachments.map((url: string, index: number) => {
                          const fileName = url.split('/').pop()?.split('?')[0] || `Fichier ${index + 1}`;
                          return (
                            <div key={url} className="flex items-center justify-between p-2 bg-background border rounded-md group">
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:underline truncate"
                              >
                                <FileIcon className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate">{fileName}</span>
                              </a>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={async () => {
                                  if (!window.confirm('Supprimer ce fichier ?')) return;

                                  const filePathMatch = url.match(/commandes_files\/(.+)$/);
                                  if (filePathMatch) {
                                    const filePath = filePathMatch[1];
                                    await supabase.storage.from('commandes_files').remove([filePath]);
                                  }

                                  const newUrls = attachments.filter((u: string) => u !== url);
                                  await supabase.from('commandes').update({ attachments: newUrls }).eq('id', selectedCommande);

                                  queryClient.invalidateQueries({ queryKey: ['commandes'] });
                                  toast({ title: 'Fichier supprimé' });
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {attachments.length < 3 && (
                      <div>
                        <Input
                          type="file"
                          id="commande-file-upload"
                          className="hidden"
                          accept=".pdf,image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            if (file.size > 5 * 1024 * 1024) {
                              toast({ title: 'Fichier trop volumineux', description: 'Le fichier dépasse la limite de 5Mo.', variant: 'destructive' });
                              return;
                            }

                            setIsUploading(true);
                            try {
                              const fileExt = file.name.split('.').pop();
                              const fileName = `${selectedCommande}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;

                              const { error: uploadError } = await supabase.storage
                                .from('commandes_files')
                                .upload(fileName, file);

                              if (uploadError) throw uploadError;

                              const { data } = supabase.storage
                                .from('commandes_files')
                                .getPublicUrl(fileName);

                              const newUrls = [...attachments, data.publicUrl];

                              const { error: dbError } = await supabase
                                .from('commandes')
                                .update({ attachments: newUrls })
                                .eq('id', selectedCommande);

                              if (dbError) throw dbError;

                              queryClient.invalidateQueries({ queryKey: ['commandes'] });
                              toast({ title: 'Fichier ajouté avec succès' });
                            } catch (error) {
                              console.error('Upload error:', error);
                              toast({ title: "Erreur d'envoi", description: 'Veuillez réessayer.', variant: 'destructive' });
                            } finally {
                              setIsUploading(false);
                              if (e.target) e.target.value = '';
                            }
                          }}
                        />
                        <Label
                          htmlFor="commande-file-upload"
                          className={`flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed rounded-md cursor-pointer transition-colors text-sm font-medium
                            ${isUploading ? 'opacity-50 pointer-events-none bg-muted' : 'text-muted-foreground hover:border-primary hover:text-primary'}`}
                        >
                          {isUploading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Envoi en cours...</>
                          ) : (
                            <><Upload className="h-4 w-4" /> Ajouter un fichier (PDF, Image)</>
                          )}
                        </Label>
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>

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
              <Label htmlFor="assignment-comment">Commentaires</Label>
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
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row sm:justify-end">
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
              <Button onClick={handleSave} className="bg-success hover:bg-success/90 text-white" size="sm">
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