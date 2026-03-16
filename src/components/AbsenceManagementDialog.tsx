import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAbsences, useSaveAbsence, useDeleteAbsence } from '@/hooks/usePlanning';
import { useTechnicians } from '@/hooks/usePlanning';

interface AbsenceManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AbsenceManagementDialog: React.FC<AbsenceManagementDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { data: technicians = [] } = useTechnicians();
  const { data: absences = [] } = useAbsences();
  const saveAbsence = useSaveAbsence();
  const deleteAbsence = useDeleteAbsence();

  const [technicianId, setTechnicianId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const activeTechnicians = technicians.filter(t => !t.is_archived);

  const handleAdd = async () => {
    if (!technicianId || !startDate || !endDate) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (endDate < startDate) {
      toast.error('La date de fin doit être après la date de début.');
      return;
    }
    try {
      await saveAbsence.mutateAsync({ technician_id: technicianId, start_date: startDate, end_date: endDate, reason: reason || undefined });
      toast.success('Absence enregistrée');
      setTechnicianId('');
      setStartDate('');
      setEndDate('');
      setReason('');
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAbsence.mutateAsync(id);
      toast.success('Absence supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const getTechName = (id: string) =>
    technicians.find(t => t.id === id)?.name ?? id;

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
            <div className="col-span-2">
              <Label htmlFor="abs-tech">Technicien *</Label>
              <Select value={technicianId} onValueChange={setTechnicianId}>
                <SelectTrigger id="abs-tech">
                  <SelectValue placeholder="Sélectionner un technicien…" />
                </SelectTrigger>
                <SelectContent>
                  {activeTechnicians.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="abs-start">Date de début *</Label>
              <Input id="abs-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="abs-end">Date de fin *</Label>
              <Input id="abs-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="abs-reason">Motif (optionnel)</Label>
              <Input id="abs-reason" placeholder="Congé, maladie…" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={saveAbsence.isPending} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            Enregistrer l'absence
          </Button>
        </div>

        {/* ── Existing absences list ── */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Absences enregistrées</h3>
          {absences.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune absence enregistrée.</p>
          ) : (
            <div className="divide-y rounded-lg border overflow-hidden">
              {absences.map(abs => (
                <div key={abs.id} className="flex items-center justify-between px-4 py-3 bg-background">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{getTechName(abs.technician_id)}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(abs.start_date)}
                      {abs.end_date !== abs.start_date ? ` → ${formatDate(abs.end_date)}` : ''}
                      {abs.reason ? ` · ${abs.reason}` : ''}
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
