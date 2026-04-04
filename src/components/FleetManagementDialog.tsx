import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Trash2, Plus, Car, Wrench, Activity, Pencil, Check, X } from 'lucide-react';
import { useFleet, useCreateFleetItem, useDeleteFleetItem } from '@/hooks/useFleet';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export const FleetManagementDialog = ({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'vehicles' | 'equipment'>('vehicles');
  const [newName, setNewName] = useState('');
  const [newRef, setNewRef] = useState('');
  const [newStatus, setNewStatus] = useState('Actif');

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRef, setEditRef] = useState('');
  const [editStatus, setEditStatus] = useState('Actif');

  const { data: items = [], isLoading } = useFleet(activeTab);
  const createItem = useCreateFleetItem(activeTab);
  const deleteItem = useDeleteFleetItem(activeTab);

  const handleAdd = () => {
    if (!newName.trim()) return;

    createItem.mutate(
      {
        name: newName,
        [activeTab === 'vehicles' ? 'license_plate' : 'reference']: newRef,
        status: newStatus
      },
      {
        onSuccess: () => {
          toast.success('Élément ajouté avec succès');
          setNewName('');
          setNewRef('');
          setNewStatus('Actif');
        },
        onError: (err) => toast.error(`Erreur: ${err.message}`)
      }
    );
  };

  const startEditing = (item: any) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditRef(activeTab === 'vehicles' ? item.license_plate : item.reference);
    setEditStatus(item.status || 'Actif');
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    const table = activeTab === 'vehicles' ? 'vehicles' : 'equipment';
    const payload = {
      name: editName,
      [activeTab === 'vehicles' ? 'license_plate' : 'reference']: editRef,
      status: editStatus
    };

    const { error } = await supabase.from(table).update(payload).eq('id', id);

    if (error) {
      toast.error('Erreur lors de la modification');
    } else {
      toast.success('Modification enregistrée');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['fleet'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Actif': return 'bg-green-100 text-green-800 border-green-200';
      case 'En réparation': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Indisponible': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {activeTab === 'vehicles' ? <Car className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
            Gestion de la Flotte & Matériel
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="vehicles"><Car className="h-4 w-4 mr-2" /> Véhicules</TabsTrigger>
            <TabsTrigger value="equipment"><Wrench className="h-4 w-4 mr-2" /> Matériel</TabsTrigger>
          </TabsList>

          {/* Add New Item Form */}
          <div className="flex flex-col md:flex-row gap-2 mb-4 p-4 bg-muted/30 rounded-lg border">
            <Input
              placeholder={activeTab === 'vehicles' ? "Nom du véhicule" : "Nom du matériel"}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder={activeTab === 'vehicles' ? "Immatriculation" : "Référence"}
              value={newRef}
              onChange={(e) => setNewRef(e.target.value)}
              className="flex-1"
            />
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="w-[160px]">
                <Activity className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Actif">Actif</SelectItem>
                <SelectItem value="En réparation">En réparation</SelectItem>
                <SelectItem value="Indisponible">Indisponible</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </div>

          {/* List of Items */}
          <div className="border rounded-md flex-1 overflow-y-auto p-2 bg-muted/10 space-y-2">
            {isLoading ? (
              <p className="text-center text-muted-foreground p-8">Chargement...</p>
            ) : items.length === 0 ? (
              <p className="text-center text-muted-foreground p-8 italic">Aucun élément trouvé.</p>
            ) : (
              items.map((item: any) => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-background border rounded-md shadow-sm hover:border-primary/30 transition-colors gap-2">

                  {editingId === item.id ? (
                    // EDIT MODE
                    <div className="flex-1 flex flex-col sm:flex-row gap-2 w-full">
                      <Input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 h-8 text-sm" placeholder="Nom" />
                      <Input value={editRef} onChange={e => setEditRef(e.target.value)} className="flex-1 h-8 text-sm" placeholder="Réf/Plaque" />
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger className="w-full sm:w-[150px] h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Actif">Actif</SelectItem>
                          <SelectItem value="En réparation">En réparation</SelectItem>
                          <SelectItem value="Indisponible">Indisponible</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8 text-green-600" onClick={() => saveEdit(item.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground" onClick={cancelEditing}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // DISPLAY MODE
                    <>
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-[200px]">
                          <p className="font-semibold text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            {activeTab === 'vehicles' ? item.license_plate : item.reference}
                          </p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(item.status || 'Actif')}`}>
                          {item.status || 'Actif'}
                        </span>
                      </div>

                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => startEditing(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => {
                          if (window.confirm('Voulez-vous vraiment supprimer cet élément ?')) {
                            deleteItem.mutate(item.id);
                          }
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};