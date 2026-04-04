import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Copy, Car, Wrench } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
    technician_id?: string;
    technician_name?: string;
    team_id?: string;
    date: string;
    weather_condition?: string | null;
    vehicle_ids?: string[];
    equipment_ids?: string[];
  } | null;
  onSave: (note: Record<string, unknown>) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (notes: Record<string, unknown>[]) => void;
  technicians?: Team[];
  weekDates?: string[];
}

const WEATHER_OPTIONS = [
  { value: 'none', icon: '➖', label: 'Aucune / Normal' },
  { value: 'SOLEIL', icon: '☀️', label: 'Soleil / Dégagé' },
  { value: 'PLUIE', icon: '🌧️', label: 'Pluie' },
  { value: 'NEIGE', icon: '❄️', label: 'Neige' },
  { value: 'VENT', icon: '💨', label: 'Vent Fort' },
  { value: 'GEL', icon: '🧊', label: 'Gel / Verglas' },
];

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
  const [weatherCondition, setWeatherCondition] = useState('none');
  const [vehicleIds, setVehicleIds] = useState<string[]>([]);
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);

  const [showDuplicateOptions, setShowDuplicateOptions] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  // Fetch Vehicles
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('*').order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Fetch Equipment
  const { data: equipment = [] } = useQuery({
    queryKey: ['equipment'],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipment').select('*').order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (note) {
      setText(note.text || '');
      setWeatherCondition((note as any).weather_condition || 'none');
      setVehicleIds((note as any).vehicle_ids || []);
      setEquipmentIds((note as any).equipment_ids || []);
      setShowDuplicateOptions(false);
      setSelectedDays([]);
      setSelectedTeams([]);
    } else {
      setText('');
      setWeatherCondition('none');
      setVehicleIds([]);
      setEquipmentIds([]);
      setShowDuplicateOptions(false);
      setSelectedDays([]);
      setSelectedTeams([]);
    }
  }, [note]);

  const handleSave = () => {
    if (!text.trim() && weatherCondition === 'none' && vehicleIds.length === 0 && equipmentIds.length === 0) {
      toast.error('Veuillez saisir une note ou sélectionner un élément');
      return;
    }

    onSave({
      id: note?.id,
      text: text.trim(),
      team_id: note?.team_id || null,
      start_date: note?.date,
      end_date: note?.date,
      weather_condition: weatherCondition === 'none' ? null : weatherCondition,
      vehicle_ids: vehicleIds,
      equipment_ids: equipmentIds,
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
    if (!text.trim() && weatherCondition === 'none' && vehicleIds.length === 0 && equipmentIds.length === 0) {
      toast.error('Veuillez saisir une note ou sélectionner un élément');
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
          weather_condition: weatherCondition === 'none' ? null : weatherCondition,
          vehicle_ids: vehicleIds,
          equipment_ids: equipmentIds,
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

  const toggleDay = (day: string) => setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  const toggleTeam = (teamId: string) => setSelectedTeams(prev => prev.includes(teamId) ? prev.filter(t => t !== teamId) : [...prev, teamId]);
  const toggleVehicle = (id: string) => setVehicleIds(prev => prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id]);
  const toggleEquipment = (id: string) => setEquipmentIds(prev => prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]);

  const formatDate = (dateStr: string) => {
    try { return format(parseISO(dateStr), 'EEEE d MMMM', { locale: fr }); } catch { return dateStr; }
  };

  const formatShortDay = (dateStr: string) => {
    try { return format(parseISO(dateStr), 'EEE d', { locale: fr }); } catch { return dateStr; }
  };

  const currentTeamName = teams.find(t => t.id === note?.team_id)?.name || note?.technician_name || '';
  const otherDays = weekDates.filter(d => d !== note?.date);
  const otherTeams = teams.filter(t => t.id !== note?.team_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-card max-h-[90vh] overflow-y-auto">
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

          {/* Multi-Select Vehicles */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-semibold">
              <Car className="w-4 h-4 text-primary" /> Véhicules
            </Label>
            <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-1 border rounded-md bg-muted/20">
              {vehicles.length === 0 && <span className="text-xs text-muted-foreground p-2">Aucun véhicule disponible</span>}
              {vehicles.map((v: any) => {
                const isSelected = vehicleIds.includes(v.id);
                const isUnavailable = v.status === 'En réparation' || v.status === 'Indisponible';
                return (
                  <Button
                    key={v.id}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    disabled={isUnavailable && !isSelected}
                    onClick={() => toggleVehicle(v.id)}
                    className="text-xs h-7"
                  >
                    {v.name} {v.license_plate ? `(${v.license_plate})` : ''}
                    {isUnavailable ? ` [${v.status}]` : ''}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Multi-Select Equipment */}
          <div className="space-y-2 border-b pb-4">
            <Label className="flex items-center gap-2 text-xs font-semibold">
              <Wrench className="w-4 h-4 text-primary" /> Matériel
            </Label>
            <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-1 border rounded-md bg-muted/20">
              {equipment.length === 0 && <span className="text-xs text-muted-foreground p-2">Aucun matériel disponible</span>}
              {equipment.map((e: any) => {
                const isSelected = equipmentIds.includes(e.id);
                const isUnavailable = e.status === 'En réparation' || e.status === 'Indisponible';
                return (
                  <Button
                    key={e.id}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    disabled={isUnavailable && !isSelected}
                    onClick={() => toggleEquipment(e.id)}
                    className="text-xs h-7"
                  >
                    {e.name} {e.reference ? `(${e.reference})` : ''}
                    {isUnavailable ? ` [${e.status}]` : ''}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* NEW: Weather Buttons Row */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Conditions Météo</Label>
            <TooltipProvider delayDuration={300}>
              <div className="flex flex-wrap gap-2">
                {WEATHER_OPTIONS.map(weather => (
                  <Tooltip key={weather.value}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant={weatherCondition === weather.value ? "default" : "outline"}
                        size="icon"
                        className="h-10 w-10 text-lg shadow-sm"
                        onClick={() => setWeatherCondition(weather.value)}
                      >
                        {weather.icon}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{weather.label}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note-text" className="text-xs font-semibold">Commentaire Libre</Label>
            <Textarea
              id="note-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Entrez votre note (optionnel si un élément est sélectionné)..."
              rows={3}
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
                          <Button key={day} type="button" variant={selectedDays.includes(day) ? "default" : "outline"} size="sm" onClick={() => toggleDay(day)} className="text-xs">
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
                          <Button key={team.id} type="button" variant={selectedTeams.includes(team.id) ? "default" : "outline"} size="sm" onClick={() => toggleTeam(team.id)} className="text-xs">
                            {team.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(selectedDays.length > 0 || selectedTeams.length > 0) && (
                    <Button type="button" onClick={handleDuplicate} className="w-full gap-2" variant="secondary">
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