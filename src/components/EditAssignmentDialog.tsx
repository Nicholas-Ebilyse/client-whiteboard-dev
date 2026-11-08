import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Assignment } from '@/types/planning';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Copy, MapPin, ExternalLink, Upload, X, FileIcon, Loader2, Camera, Image as ImageIcon, Link as LinkIcon, Check, Clock, Receipt } from 'lucide-react';
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
  const [isPostponed, setIsPostponed] = useState(false);
  const [isInvoiced, setIsInvoiced] = useState(false);
  const [showDriveInput, setShowDriveInput] = useState(false);
  const [googleDriveUrl, setGoogleDriveUrl] = useState('');
  
  // ── FIX: Attachments state now belongs to the ASSIGNMENT, not the Commande! ──
  const [localAttachments, setLocalAttachments] = useState<string[]>([]);

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

      setClientPresence(initialCommande?.client_presence || 'none');
      setSavType(initialCommande?.sav_type || 'none');
      setIsPostponed(!!(assignment.isPostponed || (assignment as any).is_postponed));
      setIsInvoiced(!!(assignment.isInvoiced || (assignment as any).is_invoiced));
      
      // Load attachments directly from the specific assignment record
      setLocalAttachments((assignment as any).attachments || []);
    } else {
      setIsPostponed(false);
      setIsInvoiced(false);
      setLocalAttachments([]);
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

  const handleFileUpload = async (file: File) => {
    if (!assignment?.id) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Fichier trop volumineux',
        description: 'La taille maximale par fichier est de 10 Mo.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const cleanExt = fileExt.toLowerCase();
      const fileName = `${assignment.id}/${Math.random().toString(36).substring(2)}_${Date.now()}.${cleanExt}`;

      // Try uploading to 'attachments' bucket first, fallback to 'commandes_files' if bucket is missing
      let targetBucket = 'attachments';
      let uploadRes = await supabase.storage.from(targetBucket).upload(fileName, file);

      if (
        uploadRes.error &&
        (uploadRes.error.message?.includes('not found') ||
          (uploadRes.error as any).statusCode === '404' ||
          (uploadRes.error as any).statusCode === 400 ||
          (uploadRes.error as any).status === 400)
      ) {
        console.warn('attachments bucket not found or failed, falling back to commandes_files');
        targetBucket = 'commandes_files';
        uploadRes = await supabase.storage.from(targetBucket).upload(fileName, file);
      }

      if (uploadRes.error) {
        throw uploadRes.error;
      }

      const { data: publicData } = supabase.storage.from(targetBucket).getPublicUrl(fileName);
      const newUrls = [...localAttachments, publicData.publicUrl];
      setLocalAttachments(newUrls);

      // Persist to assignment record in Supabase
      if (!assignment.id.startsWith('new-')) {
        const { error: dbError } = await supabase
          .from('assignments')
          .update({ attachments: newUrls })
          .eq('id', assignment.id);

        if (dbError) throw dbError;
        queryClient.invalidateQueries({ queryKey: ['assignments'] });
      }

      toast({ title: 'Image ajoutée avec succès' });
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({
        title: "Erreur d'envoi",
        description: err?.message || 'Impossible de téléverser le fichier. Veuillez réessayer.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddDriveLink = async () => {
    const trimmed = googleDriveUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      toast({
        title: 'Lien invalide',
        description: 'Veuillez saisir une URL valide (ex: https://drive.google.com/...)',
        variant: 'destructive',
      });
      return;
    }

    const newUrls = [...localAttachments, trimmed];
    setLocalAttachments(newUrls);
    setGoogleDriveUrl('');
    setShowDriveInput(false);

    if (assignment?.id && !assignment.id.startsWith('new-')) {
      await supabase.from('assignments').update({ attachments: newUrls }).eq('id', assignment.id);
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    }

    toast({ title: 'Lien Google Drive ajouté' });
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
        isConfirmed: clientPresence === 'P' || clientPresence === 'P+RDV',
        isPostponed,
        isInvoiced,
        comment,
      };

      // Ensure the attachments, postponed, and invoiced flags are passed down to be saved
      (updatedAssignment as any).attachments = localAttachments;
      (updatedAssignment as any).is_postponed = isPostponed;
      (updatedAssignment as any).is_invoiced = isInvoiced;

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
            <DialogDescription className="sr-only">
              Modifier ou supprimer les détails de l'affectation sélectionnée.
            </DialogDescription>
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

              {/* ── STATUT DE L'INTERVENTION (Reporté & Facturé) ── */}
              <div className="space-y-2 bg-muted/20 p-3 rounded-md border border-border">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Statut de l'intervention
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={isPostponed ? 'default' : 'outline'}
                    onClick={() => setIsPostponed(!isPostponed)}
                    className={cn(
                      'h-9 text-xs font-medium transition-all flex items-center justify-center gap-1.5',
                      isPostponed
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm border-transparent'
                        : 'border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>{isPostponed ? 'Chantier Reporté' : 'Marquer Reporté'}</span>
                  </Button>

                  <Button
                    type="button"
                    variant={isInvoiced ? 'default' : 'outline'}
                    onClick={() => setIsInvoiced(!isInvoiced)}
                    className={cn(
                      'h-9 text-xs font-medium transition-all flex items-center justify-center gap-1.5',
                      isInvoiced
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm border-transparent'
                        : 'border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                    )}
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span>{isInvoiced ? 'Facturé (F)' : 'Marquer Facturé (F)'}</span>
                  </Button>
                </div>
              </div>

              {/* ── ATTACHMENTS & IMAGES (Local, Caméra Mobile, Google Drive) ── */}
              {assignment?.id && (
                <div className="space-y-3 bg-muted/20 p-4 rounded-md border border-border">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      Images & Documents ({localAttachments.length}/6)
                    </Label>
                    <span className="text-xs text-muted-foreground">Local, Caméra, Drive</span>
                  </div>

                  {localAttachments.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {localAttachments.map((url: string, index: number) => {
                        const isDrive = url.includes('drive.google.com') || url.includes('docs.google.com');
                        const isImage = !isDrive && (/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(url) || url.includes('image'));
                        const fileName = isDrive
                          ? 'Document Google Drive'
                          : (url.split('/').pop()?.split('?')[0] || `Fichier ${index + 1}`);

                        return (
                          <div
                            key={url}
                            className="flex items-center justify-between p-2 bg-background border rounded-md group hover:border-primary/50 transition-colors"
                          >
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-primary hover:underline truncate flex-1 min-w-0 mr-2"
                              title={url}
                            >
                              {isImage ? (
                                <img
                                  src={url}
                                  alt="Aperçu"
                                  className="h-8 w-8 object-cover rounded border flex-shrink-0 bg-muted"
                                  onError={(e) => {
                                    // Fallback to icon if preview fails
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : isDrive ? (
                                <LinkIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              ) : (
                                <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <span className="truncate">{fileName}</span>
                            </a>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-muted-foreground hover:text-foreground"
                                title="Ouvrir le fichier"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={async () => {
                                  if (!window.confirm('Supprimer ce fichier ?')) return;

                                  const matchAttachments = url.match(/attachments\/(.+)$/);
                                  const matchCommandes = url.match(/commandes_files\/(.+)$/);
                                  try {
                                    if (matchAttachments) {
                                      await supabase.storage.from('attachments').remove([matchAttachments[1]]);
                                    } else if (matchCommandes) {
                                      await supabase.storage.from('commandes_files').remove([matchCommandes[1]]);
                                    }
                                  } catch (err) {
                                    console.warn('Storage delete warning:', err);
                                  }

                                  const newUrls = localAttachments.filter((u: string) => u !== url);
                                  setLocalAttachments(newUrls);

                                  if (assignment.id && !assignment.id.startsWith('new-')) {
                                    await supabase.from('assignments').update({ attachments: newUrls }).eq('id', assignment.id);
                                    queryClient.invalidateQueries({ queryKey: ['assignments'] });
                                  }
                                  toast({ title: 'Fichier supprimé' });
                                }}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {localAttachments.length < 6 && (
                    <div className="space-y-2 pt-1">
                      {/* Upload action buttons */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* 1. Local file / gallery */}
                        <div>
                          <Input
                            type="file"
                            id="assignment-file-local"
                            className="hidden"
                            accept="image/*,.pdf"
                            disabled={isUploading}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              await handleFileUpload(file);
                              if (e.target) e.target.value = '';
                            }}
                          />
                          <Label
                            htmlFor="assignment-file-local"
                            className={cn(
                              'flex flex-col sm:flex-row items-center justify-center gap-1.5 w-full h-11 px-2 border rounded-md cursor-pointer text-xs font-medium transition-colors text-center',
                              isUploading ? 'opacity-50 pointer-events-none bg-muted' : 'bg-background hover:bg-muted border-border hover:border-primary text-foreground'
                            )}
                          >
                            <Upload className="h-4 w-4 text-primary" />
                            <span>Fichier / Galerie</span>
                          </Label>
                        </div>

                        {/* 2. Mobile camera direct */}
                        <div>
                          <Input
                            type="file"
                            id="assignment-file-camera"
                            className="hidden"
                            accept="image/*"
                            capture="environment"
                            disabled={isUploading}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              await handleFileUpload(file);
                              if (e.target) e.target.value = '';
                            }}
                          />
                          <Label
                            htmlFor="assignment-file-camera"
                            className={cn(
                              'flex flex-col sm:flex-row items-center justify-center gap-1.5 w-full h-11 px-2 border rounded-md cursor-pointer text-xs font-medium transition-colors text-center',
                              isUploading ? 'opacity-50 pointer-events-none bg-muted' : 'bg-background hover:bg-muted border-border hover:border-primary text-foreground'
                            )}
                          >
                            <Camera className="h-4 w-4 text-blue-500" />
                            <span>Photo Caméra</span>
                          </Label>
                        </div>

                        {/* 3. Google Drive */}
                        <div>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isUploading}
                            onClick={() => setShowDriveInput(!showDriveInput)}
                            className="w-full h-11 text-xs font-medium flex flex-col sm:flex-row items-center justify-center gap-1.5 px-2"
                          >
                            <LinkIcon className="h-4 w-4 text-amber-500" />
                            <span>Google Drive</span>
                          </Button>
                        </div>
                      </div>

                      {/* Google Drive URL input form */}
                      {showDriveInput && (
                        <div className="flex gap-2 p-2 bg-background border rounded-md mt-2">
                          <Input
                            type="url"
                            placeholder="Coller le lien Google Drive (ex: https://drive.google.com/...)"
                            value={googleDriveUrl}
                            onChange={(e) => setGoogleDriveUrl(e.target.value)}
                            className="h-8 text-xs flex-1"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddDriveLink();
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 text-xs px-3 bg-primary text-primary-foreground"
                            onClick={handleAddDriveLink}
                          >
                            Ajouter
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs px-2"
                            onClick={() => {
                              setShowDriveInput(false);
                              setGoogleDriveUrl('');
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      {isUploading && (
                        <div className="flex items-center justify-center gap-2 p-2 text-xs text-muted-foreground bg-muted/40 rounded-md">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span>Envoi de l'image en cours...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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