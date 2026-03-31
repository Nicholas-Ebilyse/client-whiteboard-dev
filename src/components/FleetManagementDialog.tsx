import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Trash2, Plus, Car, Wrench } from 'lucide-react';
import { useFleet, useCreateFleetItem, useDeleteFleetItem } from '@/hooks/useFleet';
import { toast } from 'sonner';

export const FleetManagementDialog = ({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) => {
  const [activeTab, setActiveTab] = useState<'vehicles' | 'equipment'>('vehicles');
  const [newName, setNewName] = useState('');
  const [newRef, setNewRef] = useState('');

  const { data: items = [], isLoading } = useFleet(activeTab);
  const createItem = useCreateFleetItem(activeTab);
  const deleteItem = useDeleteFleetItem(activeTab);

  const handleAdd = () => {
    if (!newName.trim()) return;
    createItem.mutate(
      { name: newName, [activeTab === 'vehicles' ? 'license_plate' : 'reference']: newRef },
      {
        onSuccess: () => {
          toast.success('Élément ajouté avec succès');
          setNewName('');
          setNewRef('');
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Car className="h-5 w-5" />
            Flotte et Matériel
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'vehicles' | 'equipment')} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="vehicles" className="gap-2"><Car className="h-4 w-4" /> Véhicules</TabsTrigger>
            <TabsTrigger value="equipment" className="gap-2"><Wrench className="h-4 w-4" /> Matériel</TabsTrigger>
          </TabsList>

          <div className="mt-6 flex gap-2 mb-4">
            <Input
              placeholder="Nom (ex: Renault Kangoo)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder={activeTab === 'vehicles' ? "Immatriculation" : "Référence / Numéro"}
              value={newRef}
              onChange={e => setNewRef(e.target.value)}
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={!newName.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </div>

          <div className="border rounded-md min-h-[300px] max-h-[50vh] overflow-y-auto p-2 bg-muted/20 space-y-2">
            {isLoading ? (
              <p className="text-center text-muted-foreground p-4">Chargement...</p>
            ) : items.length === 0 ? (
              <p className="text-center text-muted-foreground p-4 italic">Aucun élément trouvé.</p>
            ) : (
              items.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-2 md:p-3 bg-background border rounded-md shadow-sm">
                  <div>
                    <p className="font-semibold text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {activeTab === 'vehicles' ? item.license_plate : item.reference}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => {
                    if (window.confirm('Voulez-vous vraiment supprimer cet élément ?')) {
                      deleteItem.mutate(item.id);
                    }
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};