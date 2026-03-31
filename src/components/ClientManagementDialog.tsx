import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, Trash2, MapPin, Building2, Save } from 'lucide-react';
import { useCommandes, useCreateCommande, useUpdateCommande, useDeleteCommande } from '@/hooks/usePlanning';
import { toast } from 'sonner';

interface ClientManagementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const ClientManagementDialog = ({ open, onOpenChange }: ClientManagementDialogProps) => {
    const { data: commandes = [] } = useCommandes();
    const createCommande = useCreateCommande();
    const updateCommande = useUpdateCommande();
    const deleteCommande = useDeleteCommande();

    const [selectedClientName, setSelectedClientName] = useState<string | null>(null);

    const [isAddingNewClient, setIsAddingNewClient] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientSite, setNewClientSite] = useState('');

    const [isAddingSite, setIsAddingSite] = useState(false);
    const [newSiteAddress, setNewSiteAddress] = useState('');

    // Group all work sites by Client Name safely
    const groupedClients = useMemo(() => {
        const groups: Record<string, any[]> = {};
        commandes.forEach(c => {
            // Ignore empty/null clients
            if (!c.client) return;
            if (!groups[c.client]) groups[c.client] = [];
            groups[c.client].push(c);
        });
        return groups;
    }, [commandes]);

    const clientNames = Object.keys(groupedClients).sort();

    // THE FIX: Add '|| []' so that if the client isn't loaded yet, it defaults to an empty array instead of undefined!
    const selectedClientSites = selectedClientName ? (groupedClients[selectedClientName] || []) : [];

    const handleCreateNewClient = (e?: React.MouseEvent | React.KeyboardEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!newClientName.trim() || !newClientSite.trim()) return;

        createCommande.mutate({
            client: newClientName.trim(),
            chantier: newClientSite.trim()
        }, {
            onSuccess: () => {
                toast.success("Nouveau client et chantier créés !");
                setIsAddingNewClient(false);
                const savedName = newClientName.trim();
                setNewClientName('');
                setNewClientSite('');
                setSelectedClientName(savedName);
            },
            onError: (err) => toast.error(`Erreur: ${err.message}`)
        });
    };

    const handleAddSiteToClient = (e?: React.MouseEvent | React.KeyboardEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!selectedClientName || !newSiteAddress.trim()) return;

        createCommande.mutate({
            client: selectedClientName,
            chantier: newSiteAddress.trim()
        }, {
            onSuccess: () => {
                toast.success("Nouveau chantier ajouté au client !");
                setIsAddingSite(false);
                setNewSiteAddress('');
            },
            onError: (err) => toast.error(`Erreur: ${err.message}`)
        });
    };

    const handleDeleteSite = (id: string, siteName: string) => {
        if (confirm(`Êtes-vous sûr de vouloir supprimer le chantier "${siteName}" ?`)) {
            deleteCommande.mutate(id, {
                onSuccess: () => {
                    toast.success("Chantier supprimé !");
                    if (selectedClientSites.length <= 1) {
                        setSelectedClientName(null);
                    }
                },
                onError: (err) => toast.error(`Erreur: ${err.message}`)
            });
        }
    };

    const handleUpdateSite = (id: string, newAddress: string) => {
        updateCommande.mutate({ id, chantier: newAddress }, {
            onSuccess: () => toast.success("Adresse mise à jour !"),
            onError: (err) => toast.error(`Erreur: ${err.message}`)
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden bg-card">
                <DialogHeader className="p-6 pb-2 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <Building2 className="h-6 w-6 text-primary" />
                        Gestion des Clients & Chantiers
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT SIDE: Client List */}
                    <div className="w-1/3 border-r bg-muted/10 flex flex-col">
                        <div className="p-4 border-b">
                            <Button
                                type="button"
                                className="w-full"
                                variant={isAddingNewClient ? "secondary" : "default"}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsAddingNewClient(true);
                                    setSelectedClientName(null);
                                }}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Nouveau Client
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {clientNames.map(clientName => (
                                <button
                                    key={clientName}
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setSelectedClientName(clientName);
                                        setIsAddingNewClient(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 rounded-md transition-colors text-sm font-medium ${selectedClientName === clientName
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-accent'
                                        }`}
                                >
                                    {clientName}
                                    <span className="block text-xs opacity-70 mt-0.5 font-normal">
                                        {/* Safe fallback here too */}
                                        {(groupedClients[clientName] || []).length} chantier(s)
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT SIDE: Details & Work Sites */}
                    <div className="w-2/3 flex flex-col bg-background">

                        {/* VIEW: Creating a Brand New Client */}
                        {isAddingNewClient && (
                            <div className="p-8 max-w-md mx-auto w-full space-y-6">
                                <div className="space-y-2">
                                    <h3 className="text-lg font-semibold">Ajouter un nouveau client</h3>
                                    <p className="text-sm text-muted-foreground">Créez le client et ajoutez sa première adresse de chantier.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Nom du Client</Label>
                                        <Input
                                            placeholder="Ex: Mairie de Paris"
                                            value={newClientName}
                                            onChange={(e) => setNewClientName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateNewClient(e)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Adresse du premier chantier</Label>
                                        <Input
                                            placeholder="Ex: 12 Rue de Rivoli, 75001 Paris"
                                            value={newClientSite}
                                            onChange={(e) => setNewClientSite(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateNewClient(e)}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        className="w-full mt-4"
                                        onClick={handleCreateNewClient}
                                    >
                                        <Save className="h-4 w-4 mr-2" />
                                        Enregistrer le client
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* VIEW: Managing an Existing Client */}
                        {!isAddingNewClient && selectedClientName && (
                            <div className="flex flex-col h-full">
                                <div className="p-6 border-b flex justify-between items-center bg-muted/5 shrink-0">
                                    <div>
                                        <h3 className="text-2xl font-bold text-primary">{selectedClientName}</h3>
                                        <p className="text-sm text-muted-foreground mt-1">Gérez les adresses d'intervention de ce client.</p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsAddingSite(!isAddingSite);
                                        }}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Ajouter un chantier
                                    </Button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {/* Add New Site Inline Form */}
                                    {isAddingSite && (
                                        <div className="bg-accent/50 p-4 rounded-lg border border-primary/20 flex gap-2 items-end mb-6">
                                            <div className="flex-1 space-y-2">
                                                <Label>Nouvelle adresse de chantier</Label>
                                                <Input
                                                    placeholder="Saisissez l'adresse du nouveau site..."
                                                    value={newSiteAddress}
                                                    onChange={(e) => setNewSiteAddress(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSiteToClient(e)}
                                                    autoFocus
                                                />
                                            </div>
                                            <Button type="button" onClick={handleAddSiteToClient}>Enregistrer</Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setIsAddingSite(false);
                                                }}
                                            >
                                                Annuler
                                            </Button>
                                        </div>
                                    )}

                                    {/* List of Sites */}
                                    <div className="space-y-3">
                                        {selectedClientSites.map(site => (
                                            <div key={site.id} className="group flex items-center gap-3 p-3 bg-card border rounded-lg hover:border-primary/50 transition-colors shadow-sm">
                                                <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                                                <Input
                                                    defaultValue={site.chantier}
                                                    onBlur={(e) => {
                                                        if (e.target.value !== site.chantier && e.target.value.trim() !== '') {
                                                            handleUpdateSite(site.id, e.target.value);
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    className="flex-1 border-transparent hover:border-input focus:border-input bg-transparent"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 transition-opacity shrink-0"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleDeleteSite(site.id, site.chantier);
                                                    }}
                                                    title="Supprimer ce chantier"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* VIEW: Empty State */}
                        {!isAddingNewClient && !selectedClientName && (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                                <Building2 className="h-16 w-16 mb-4 opacity-20" />
                                <p className="text-lg font-medium">Sélectionnez un client</p>
                                <p className="text-sm mt-1 max-w-xs">Choisissez un client dans la liste de gauche pour voir et gérer ses chantiers, ou créez-en un nouveau.</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};