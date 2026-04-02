import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Trash2, Plus, ChevronDown, ChevronUp, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAbsences,
  useSaveAbsence,
  useDeleteAbsence,
  useAbsenceMotives,
  useCreateAbsenceMotive,
  useUpdateAbsenceMotive,
  useDeleteAbsenceMotive,
  useTechnicians,
} from '@/hooks/usePlanning';

interface AbsenceManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AbsenceManagementDialog: React.FC<AbsenceManagementDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const queryClient = useQueryClient();

  const { data: technicians = [] } = useTechnicians();
  const { data: absences = [] } = useAbsences();
  const { data: motives = [] } = useAbsenceMotives();

  const saveAbsence = useSaveAbsence();
  const deleteAbsence = useDeleteAbsence();
  const createMotive = useCreateAbsenceMotive();
  const updateMotive = useUpdateAbsenceMotive();
  const deleteMotive = useDeleteAbsenceMotive();

  const [technicianId, setTechnicianId] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [motiveId, setMotiveId] = useState('');

  // Motif management state
  const [showMotiveManager, setShowMotiveManager] = useState(false);
  const [newMotiveName, setNewMotiveName] = useState('');
  const [editingMotiveId, setEditingMotiveId] = useState<string | null>(null);
  const [editingMotiveName, setEditingMotiveName] = useState('');

  const activeTechnicians = technicians.filter(t => !t.is_archived);

  // Initialize defaults every time the dialog opens
  useEffect(() => {
    if (open) {
      setTechnicianId('');
      setShowMotiveManager(false);
      const today = format(new Date(), 'yyyy-MM-dd');
      setStartDate(today);
      setEndDate(today);
      
      // Auto-select "Congés Payés" if it exists
      if (motives.length > 0) {
        const cpMotive = motives.find(m => 
          m.name.toLowerCase().includes('congés payés') || 
          m.name.toLowerCase().includes('conges payes')
        );
        if (cpMotive) {
          setMotiveId(cpMotive.id);
        } else {
          setMotiveId(motives[0]?.id || '');
        }
      }
    }
  }, [open, motives]);

  // Sync end date when start date changes
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setStartDate(newDate);
    setEndDate(newDate);
  };

  const getTechName = (id: string) => {
    const tech = technicians.find(t => t.id === id);
    return tech ? tech.name : id;
  };

  // Filter absences: If a technician is selected, only show theirs. Sort newest first.
  const displayedAbsences = absences
    .filter(abs => technicianId ? abs.technician_id === technicianId : true)
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

  const selectedTechName = technicianId ? getTechName(technicianId) : null;

  const handleAdd = async () => {
    if (!technicianId || !startDate || !endDate || !motiveId) {
      toast.error('Veuillez remplir tous les champs obligatoires (Technicien, Dates, Motif).');
      return;
    }
    if (endDate < startDate) {
      toast.error('La date de fin doit être après la date de début.');
      return;
    }
    try {
      await saveAbsence.mutateAsync({ 
        technician_id: technicianId, 
        start_date: startDate, 
        end_date: endDate, 
        motive_id: motiveId 
      });
      
      queryClient.invalidateQueries({ queryKey: ['absences'] }); 
      
      toast.success('Absence enregistrée');
      // We don't clear the technicianId anymore so they can see it in the filtered list below!
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAbsence.mutateAsync(id);
      queryClient.invalidateQueries({ queryKey: ['absences'] }); 
      toast.success('Absence supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleAddMotive = async () => {
    const name = newMotiveName.trim();
    if (!name) return;
    try {
      await createMotive.mutateAsync({ name });
      queryClient.invalidateQueries({ queryKey: ['absenceMotives'] });
      toast.success(`Motif « ${name} » ajouté`);
      setNewMotiveName('');
    } catch {
      toast.error('Erreur : ce motif existe peut-être déjà');
    }
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingMotiveId(id);
    setEditingMotiveName(name);
  };

  const handleSaveEdit = async () => {
    if (!editingMotiveId) return;
    const name = editingMotiveName.trim();
    if (!name) return;
    try {
      await updateMotive.mutateAsync({ id: editingMotiveId, name });
      queryClient.invalidateQueries({ queryKey: ['absenceMotives'] });
      toast.success('Motif mis à jour');
      setEditingMotiveId(null);
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleDeleteMotive = async (id: string, name: string) => {
    if (!confirm(`Supprimer le motif « ${name} » ?`)) return;
    try {
      await deleteMotive.mutateAsync(id);
      queryClient.invalidateQueries({ queryKey: ['absenceMotives'] });
      toast.success('Motif supprimé');
      if (motiveId === id) setMotiveId('');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const formatDate = (d: string) => {
    try { return format(parseISO(d), 'dd/MM/yyyy', { locale: fr }); }
    catch { return d; }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Gestion des Absences
          </DialogTitle>
        </DialogHeader>

        {/* ── Add form ── */}
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <h3 className="font-semibold text-sm">Ajouter une absence</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="abs-tech">Technicien *</Label>
              <div className="flex gap-2 items-center">
                <Select value={technicianId} onValueChange={setTechnicianId}>
                  <SelectTrigger id="abs-tech" className="flex-1">
                    <SelectValue placeholder="Sélectionner un technicien…" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTechnicians.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {technicianId && (
                  <Button variant="outline" type="button" onClick={() => setTechnicianId('')} className="shrink-0 h-10 px-3">
                    <X className="w-4 h-4 mr-1" />
                    Effacer
                  </Button>
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="abs-start">Date de début *</Label>
              <Input id="abs-start" type="date" value={startDate} onChange={handleStartDateChange} />
            </div>
            
            <div>
              <Label htmlFor="abs-end">Date de fin *</Label>
              <Input id="abs-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            
            <div className="col-span-2">
              <Label>Motif *</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {motives.map(motive => (
                  <Button
                    key={motive.id}
                    type="button"
                    variant={motiveId === motive.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMotiveId(motiveId === motive.id ? '' : motive.id)}
                    className="text-xs h-8"
                  >
                    {motive.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Action Buttons (1/3 and 2/3 ratio) ── */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowMotiveManager(v => !v)}
              className="w-1/3 flex justify-between px-3 bg-background"
            >
              <span className="truncate">Gérer les motifs</span>
              {showMotiveManager ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
            </Button>
            
            <Button onClick={handleAdd} disabled={saveAbsence.isPending} className="w-2/3 gap-2">
              <Plus className="w-4 h-4" />
              Enregistrer l'absence
            </Button>
          </div>
        </div>

        {/* ── Motif manager Panel ── */}
        {showMotiveManager && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/10 shadow-inner">
            <h3 className="font-semibold text-sm">Éditeur de motifs</h3>
            <div className="divide-y rounded-md border overflow-hidden bg-background">
              {motives.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun motif défini.</p>
              )}
              {motives.map(m => (
                <div key={m.id} className="flex items-center gap-2 px-3 py-2">
                  {editingMotiveId === m.id ? (
                    <>
                      <Input
                        value={editingMotiveName}
                        onChange={e => setEditingMotiveName(e.target.value)}
                        className="h-7 text-sm flex-1"
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingMotiveId(null); }}
                        autoFocus
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={handleSaveEdit}><Check className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingMotiveId(null)}><X className="w-3.5 h-3.5" /></Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm flex-1">{m.name}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleStartEdit(m.id, m.name)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteMotive(m.id, m.name)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Nouveau motif…"
                value={newMotiveName}
                onChange={e => setNewMotiveName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddMotive(); }}
                className="h-9 text-sm bg-background"
              />
              <Button size="sm" onClick={handleAddMotive} disabled={!newMotiveName.trim() || createMotive.isPending} className="gap-1.5 shrink-0">
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </Button>
            </div>
          </div>
        )}

        {/* ── Existing absences list ── */}
        <div className="space-y-3 mt-2">
          <h3 className="font-semibold text-sm">
            Absences enregistrées {selectedTechName ? `(${selectedTechName})` : ''}
          </h3>
          {displayedAbsences.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune absence enregistrée pour cette sélection.</p>
          ) : (
            <div className="divide-y rounded-lg border overflow-hidden">
              {displayedAbsences.map(abs => (
                <div key={abs.id} className="flex items-center justify-between px-4 py-3 bg-background">
                  <div className="flex flex-col">
                    {/* Only show the name in the list if we aren't already filtering by a specific technician */}
                    {!technicianId && <span className="font-medium text-sm">{getTechName(abs.technician_id)}</span>}
                    <span className={`text-xs text-muted-foreground ${!technicianId ? 'mt-0.5' : 'font-medium text-sm text-foreground'}`}>
                      {formatDate(abs.start_date)}
                      {abs.end_date !== abs.start_date ? ` → ${formatDate(abs.end_date)}` : ''}
                      {(abs as any).absence_motives?.name ? ` · ${(abs as any).absence_motives.name}` : ''}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(abs.id)}
                    disabled={deleteAbsence.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};