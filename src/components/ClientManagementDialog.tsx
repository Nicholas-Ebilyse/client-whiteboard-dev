import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, Trash2, MapPin, Building2, Save, ListChecks } from 'lucide-react';
import { useCommandes, useCreateCommande, useUpdateCommande, useDeleteCommande } from '@/hooks/usePlanning';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

// ── NEW SUB-COMPONENT: Optimistic UI & Scroll-Hijack Fix ──
const SiteSkillsPopover = ({ site, categories, skillDefinitions, onUpdateSkills }: any) => {
    const initialSkills = Array.isArray(site.required_skills) ? site.required_skills : [];
    const [localSkills, setLocalSkills] = useState<string[]>(initialSkills);

    useEffect(() => {
        setLocalSkills(Array.isArray(site.required_skills) ? site.required_skills : []);
    }, [site.required_skills]);

    const handleToggle = (skillKey: string, checked: boolean) => {
        const newSkills = checked
            ? [...localSkills, skillKey]
            : localSkills.filter(s => s !== skillKey);
        setLocalSkills(newSkills);
        onUpdateSkills(site.id, newSkills);
    };

    return (
        <Popover modal={true}>
            {/* modal={true} force l'isolation de cet élément par rapport au Dialog parent */}
            <PopoverTrigger asChild>
                <Button
                    variant={localSkills.length > 0 ? "secondary" : "outline"}
                    size="sm"
                    className={`shrink-0 h-9 transition-colors ${localSkills.length > 0 ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : ""}`}
                >
                    <ListChecks className="h-4 w-4 mr-2" />
                    {localSkills.length > 0 ? `${localSkills.length} Requise(s)` : 'Compétences'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 shadow-xl" align="end" side="bottom" avoidCollisions={true}>
                <div className="bg-muted/30 p-3 border-b">
                    <h4 className="font-semibold text-sm">Compétences requises</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Cochez les qualifications obligatoires pour ce chantier.</p>
                </div>

                {/* LE CORRECTIF : 
                    1. max-h-80 est une classe native Tailwind (320px) qui ne peut pas être ignorée par le compilateur.
                    2. onWheel / onTouchMove empêchent le Dialog parent de voler les événements de défilement.
                */}
                <div
                    className="p-4 space-y-4 max-h-80 overflow-y-auto overscroll-contain"
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                >
                    {categories.map((cat: string) => (
                        <div key={cat} className="space-y-2">
                            <h5 className="text-xs font-bold text-primary uppercase bg-primary/5 px-2 py-1 rounded">{cat}</h5>
                            {skillDefinitions.filter((s: any) => s.category === cat).map((skill: any) => {
                                const skillKey = `${cat} - ${skill.name}`;
                                const isSelected = localSkills.includes(skillKey);
                                return (
                                    <label key={skill.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent p-1.5 rounded-md transition-colors ml-1">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 shrink-0"
                                            checked={isSelected}
                                            onChange={(e) => handleToggle(skillKey, e.target.checked)}
                                        />
                                        <span className="leading-tight">{skill.name}</span>
                                    </label>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};

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

    const { data: skillDefinitions = [] } = useQuery({
        queryKey: ['skill_definitions'],
        queryFn: async () => {
            const { data, error } = await supabase.from('skill_definitions').select('*').order('category').order('name');
            if (error) throw error;
            return data;
        },
        enabled: open,
    });

    const categories = Array.from(new Set(skillDefinitions.map(s => s.category)));

    const groupedClients = useMemo(() => {
        const groups: Record<string, any[]> = {};
        commandes.forEach(c => {
            if (!c.client) return;
            if (!groups[c.client]) groups[c.client] = [];
            groups[c.client].push(c);
        });
        return groups;
    }, [commandes]);

    const clientNames = Object.keys(groupedClients).sort();
    const selectedClientSites = selectedClientName ? (groupedClients[selectedClientName] || []) : [];

    const handleCreateNewClient = (e?: React.MouseEvent | React.KeyboardEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!newClientName.trim() || !newClientSite.trim()) return;

        createCommande.mutate({
            client: newClientName.trim(),
            chantier: newClientSite.trim(),
            required_skills: []
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
            chantier: newSiteAddress.trim(),
            required_skills: []
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

    const handleUpdateSiteSkills = (id: string, newSkills: string[]) => {
        updateCommande.mutate({ id, required_skills: newSkills }, {
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
                                        <p className="text-sm text-muted-foreground mt-1">Gérez les adresses et les compétences requises.</p>
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
                                            <div key={site.id} className="group flex items-center gap-2 p-2 bg-card border rounded-lg hover:border-primary/50 transition-colors shadow-sm">
                                                <MapPin className="h-5 w-5 text-muted-foreground shrink-0 ml-1" />
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

                                                <SiteSkillsPopover
                                                    site={site}
                                                    categories={categories}
                                                    skillDefinitions={skillDefinitions}
                                                    onUpdateSkills={handleUpdateSiteSkills}
                                                />

                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 transition-opacity shrink-0 h-9 w-9"
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