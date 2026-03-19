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
  chantiers: Chantier[];
  commandes: any[]; // Issue #3: Add commandes for address lookup
  teams: any[];
  assignments: Assignment[];
  onSave: (assignment: Assignment) => void;
  onDelete?: (id: string) => void;
  onDeleteGroup?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  allDbAssignments?: any[]; // Raw DB assignments for finding linked technicians
}

export const EditAssignmentDialog = ({
  open,
  onOpenChange,
  assignment,
  chantiers,
  commandes, // Issue #3: Receive commandes prop
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editedChantierAddress, setEditedChantierAddress] = useState<string | null>(null);
  // Derive invoice status from commandes — read-only, used only for locking
  const isInvoiced = useMemo(() => {
    if (!assignment?.commandeId) return false;
    const commande = commandes.find((c: any) => c.id === assignment.commandeId);
    return commande?.is_invoiced || false;
  }, [assignment?.commandeId, commandes]);

  const selectedChantier = useMemo(() => 
    chantiers.find(c => c.id === selectedCommande),
  [chantiers, selectedCommande]);

  useEffect(() => {
    setEditedChantierAddress(null);
  }, [selectedCommande]);

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

      // Check for address edit
      if (editedChantierAddress !== null) {
        const selectedComm = commandes.find((c: any) => c.id === selectedCommande);
        if (selectedComm && editedChantierAddress !== selectedComm.chantier) {
          try {
            const { supabase } = await import('@/integrations/supabase/client');
            const { error } = await supabase
              .from('invoices')
              .update({ chantier: editedChantierAddress })
              .eq('id', selectedCommande);
              
            if (error) throw error;
            
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            toast({ title: "Adresse mise à jour", description: "L'adresse du chantier a été enregistrée avec succès." });
          } catch (error) {
            console.error("Erreur lors de la mise à jour de l'adresse:", error);
            toast({ title: "Erreur", description: "Impossible de sauvegarder l'adresse.", variant: "destructive" });
            return; // Don't save assignment if address failed
          }
        }
      }
      
      const updatedAssignment: Assignment = {
        ...assignment,
        teamId: selectedTeam,
        chantierId: null,
        commandeId: selectedCommande,
        startDate: startDateStr,
        endDate: endDateStr,
        isAbsent: false,
        isConfirmed,
        comment,
      };
      
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
      .filter((c: any) => c.client === selectedClient && (!c.is_invoiced || c.id === assignment?.commandeId))
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
              {isInvoiced && (
                <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                  🔒 Ce chantier est marqué comme facturé — affectation verrouillée.
                </p>
              )}
              <SearchableSelect
                value={selectedClient}
                onValueChange={(val) => {
                  setSelectedClient(val);
                  setSelectedCommande('');
                }}
                options={clientOptions}
                placeholder="Sélectionner un client..."
                disabled={isInvoiced}
              />
            </div>

            {selectedClient && (
              <div className="space-y-2">
                <Label>Chantier</Label>
                <SearchableSelect
                  value={selectedCommande}
                  onValueChange={setSelectedCommande}
                  options={chantierOptions}
                  placeholder="Sélectionner un chantier..."
                  disabled={isInvoiced}
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
                      value={editedChantierAddress !== null ? editedChantierAddress : selectedComm.chantier}
                      onChange={(e) => setEditedChantierAddress(e.target.value)}
                      className="flex-1 bg-background text-sm"
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

          {/* Attachments Section */}
          {selectedCommande && selectedChantier && (
            <div className="space-y-3 bg-muted/10 p-3 rounded-md border border-border/50">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <FileIcon className="h-4 w-4 text-primary" />
                  Pièces jointes du chantier
                </Label>
                <div className="text-xs text-muted-foreground">
                  {(selectedChantier.attachments?.length || 0)} / 3 fichiers
                </div>
              </div>
              
              {/* File list */}
              {(selectedChantier.attachments?.length || 0) > 0 && (
                <div className="flex flex-col gap-2">
                  {selectedChantier.attachments?.map((url, i) => {
                    const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i);
                    const fileName = url.split('/').pop()?.split('?')[0] || `Fichier ${i + 1}`;
                    
                    return (
                      <div key={i} className="flex items-center justify-between p-2 pr-1 bg-background rounded border group">
                        <a 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 overflow-hidden text-sm hover:text-primary transition-colors flex-1"
                        >
                          {isImage ? <ImageIcon className="h-4 w-4 flex-shrink-0" /> : <FileIcon className="h-4 w-4 flex-shrink-0" />}
                          <span className="truncate">{fileName}</span>
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={async (e) => {
                            e.preventDefault();
                            if (!window.confirm("Supprimer ce fichier ?")) return;
                            
                            try {
                              const newAttachments = selectedChantier.attachments!.filter(a => a !== url);
                              
                              // First update the DB so UI reacts fast
                              const { supabase } = await import('@/integrations/supabase/client');
                              const { error } = await supabase
                                .from('invoices')
                                .update({ attachments: newAttachments })
                                .eq('id', selectedCommande);
                                
                              if (error) throw error;
                              
                              queryClient.invalidateQueries({ queryKey: ['invoices'] });
                              toast({ title: "Fichier supprimé" });
                              
                              // Optionally delete from storage here as background task
                              const filePathMatch = url.match(/chantier_files\/(.+)$/);
                              if (filePathMatch && filePathMatch[1]) {
                                const filePath = filePathMatch[1];
                                supabase.storage.from('chantier_files').remove([filePath]).catch(console.error);
                              }
                            } catch (error) {
                              console.error('L\'erreur de suppression:', error);
                              toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
                            }
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Upload button */}
              {(selectedChantier.attachments?.length || 0) < 3 && (
                <div>
                  <input 
                    type="file" 
                    id="chantier-file-upload" 
                    className="hidden" 
                    accept="image/*,.pdf"
                    multiple
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      
                      const currentCount = selectedChantier.attachments?.length || 0;
                      if (currentCount + files.length > 3) {
                        toast({ title: "Limite atteinte", description: "Maximum 3 fichiers au total.", variant: "destructive" });
                        return;
                      }
                      
                      setIsUploading(true);
                      try {
                        const { supabase } = await import('@/integrations/supabase/client');
                        const newUrls = [...(selectedChantier.attachments || [])];
                        
                        for (const file of files) {
                          // Validate file size (max 5MB)
                          if (file.size > 5 * 1024 * 1024) {
                            toast({ title: "Fichier trop lourd", description: `${file.name} dépasse 5Mo.`, variant: "destructive" });
                            continue;
                          }
                          
                          const fileExt = file.name.split('.').pop();
                          const fileName = `${selectedCommande}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                          
                          const { data: uploadData, error: uploadError } = await supabase.storage
                            .from('chantier_files')
                            .upload(fileName, file);
                            
                          if (uploadError) throw uploadError;
                          
                          const { data: { publicUrl } } = supabase.storage
                            .from('chantier_files')
                            .getPublicUrl(fileName);
                            
                          newUrls.push(publicUrl);
                        }
                        
                        // Update DB
                        const { error: dbError } = await supabase
                          .from('invoices')
                          .update({ attachments: newUrls })
                          .eq('id', selectedCommande);
                          
                        if (dbError) throw dbError;
                        
                        queryClient.invalidateQueries({ queryKey: ['invoices'] });
                        toast({ title: "Fichiers ajoutés avec succès" });
                      } catch (error) {
                        console.error('Upload error:', error);
                        toast({ title: "Erreur d'envoi", description: "Veuillez réessayer.", variant: "destructive" });
                      } finally {
                        setIsUploading(false);
                        // Reset input
                        e.target.value = '';
                      }
                    }}
                  />
                  <Label 
                    htmlFor="chantier-file-upload" 
                    className={cn(
                      "flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed rounded-md cursor-pointer transition-colors text-sm font-medium",
                      isUploading ? "opacity-50 pointer-events-none bg-muted" : "hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary"
                    )}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Ajouter un fichier (PDF, Image - max 5Mo)
                      </>
                    )}
                  </Label>
                </div>
              )}
            </div>
          )}

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
                    disabled={isConfirmed || isInvoiced}
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
                    disabled={isConfirmed || isInvoiced}
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