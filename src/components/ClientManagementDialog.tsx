import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, Trash2, MapPin, Building2, Save, ListChecks, Car, Wrench } from 'lucide-react';
import { useCommandes, useCreateCommande, useUpdateCommande, useDeleteCommande } from '@/hooks/usePlanning';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

// ── 1. Skills Popover ──
const SiteSkillsPopover = ({ site, categories, skillDefinitions, onUpdateSkills }: any) => {
    const initialSkills = Array.isArray(site.required_skills) ? site.required_skills : [];
    const [localSkills, setLocalSkills] = useState<string[]>(initialSkills);

    useEffect(() => {
        setLocalSkills(Array.isArray(site.required_skills) ? site.required_skills : []);
    }, [site.required_skills]);

    const handleToggle = (skillKey: string, checked: boolean) => {
        const newSkills = checked ? [...localSkills, skillKey] : localSkills.filter(s => s !== skillKey);
        setLocalSkills(newSkills);
        onUpdateSkills(site.id, newSkills);
    };

    return (
        <Popover modal={true}>
            <PopoverTrigger asChild>
                <Button variant={localSkills.length > 0 ? "secondary" : "outline"} size="sm" className={`shrink-0 h-9 transition-colors ${localSkills.length > 0 ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : ""}`}>
                    <ListChecks className="h-4 w-4 mr-1.5" />
                    {localSkills.length > 0 ? `${localSkills.length} Req.` : 'Compétences'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 shadow-xl" align="end" side="bottom" avoidCollisions={true}>
                <div className="bg-muted/30 p-3 border-b">
                    <h4 className="font-semibold text-sm">Compétences requises</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Cochez les qualifications obligatoires pour ce chantier.</p>
                </div>
                <div className="p-4 space-y-4 max-h-80 overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                    {categories.map((cat: string) => (
                        <div key={cat} className="space-y-2">
                            <h5 className="text-xs font-bold text-primary uppercase bg-primary/5 px-2 py-1 rounded">{cat}</h5>
                            {skillDefinitions.filter((s: any) => s.category === cat).map((skill: any) => {
                                const skillKey = `${cat} - ${skill.name}`;
                                const isSelected = localSkills.includes(skillKey);
                                return (
                                    <label key={skill.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent p-1.5 rounded-md transition-colors ml-1">
                                        <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 shrink-0" checked={isSelected} onChange={(e) => handleToggle(skillKey, e.target.checked)} />
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

// ── 2. Vehicles Popover ──
const SiteVehiclesPopover = ({ site, vehicles, onUpdateVehicles }: any) => {
    const initialVehicles = Array.isArray(site.required_vehicles) ? site.required_vehicles : [];
    const [localVehicles, setLocalVehicles] = useState<string[]>(initialVehicles);

    useEffect(() => {
        setLocalVehicles(Array.isArray(site.required_vehicles) ? site.required_vehicles : []);
    }, [site.required_vehicles]);

    const handleToggle = (vehicleId: string, checked: boolean) => {
        const newVehicles = checked ? [...localVehicles, vehicleId] : localVehicles.filter(id => id !== vehicleId);
        setLocalVehicles(newVehicles);
        onUpdateVehicles(site.id, newVehicles);
    };

    return (
        <Popover modal={true}>
            <PopoverTrigger asChild>
                <Button variant={localVehicles.length > 0 ? "secondary" : "outline"} size="sm" className={`shrink-0 h-9 transition-colors ${localVehicles.length > 0 ? "bg-blue-100 text-blue-800 hover:bg-blue-200" : ""}`}>
                    <Car className="h-4 w-4 mr-1.5" />
                    {localVehicles.length > 0 ? `${localVehicles.length} Req.` : 'Véhicules'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 shadow-xl" align="end" side="bottom" avoidCollisions={true}>
                <div className="bg-muted/30 p-3 border-b">
                    <h4 className="font-semibold text-sm">Véhicules requis</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Cochez les véhicules obligatoires pour ce chantier.</p>
                </div>
                <div className="p-4 space-y-2 max-h-80 overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                    {vehicles.map((v: any) => {
                        const isSelected = localVehicles.includes(v.id);
                        // Safely fall back through properties if naming conventions differ
                        const displayName = v.name || v.registration || v.id;
                        return (
                            <label key={v.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent p-1.5 rounded-md transition-colors ml-1">
                                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-600 h-4 w-4 shrink-0" checked={isSelected} onChange={(e) => handleToggle(v.id, e.target.checked)} />
                                <span className="leading-tight">{displayName}</span>
                            </label>
                        );
                    })}
                    {vehicles.length === 0 && <p className="text-xs text-muted-foreground italic">Aucun véhicule trouvé.</p>}
                </div>
            </PopoverContent>
        </Popover>
    );
};

// ── 3. Equipment Popover ──
const SiteEquipmentPopover = ({ site, equipment, onUpdateEquipment }: any) => {
    const initialEquipment = Array.isArray(site.required_equipment) ? site.required_equipment : [];
    const [localEquipment, setLocalEquipment] = useState<string[]>(initialEquipment);

    useEffect(() => {
        setLocalEquipment(Array.isArray(site.required_equipment) ? site.required_equipment : []);
    }, [site.required_equipment]);

    const handleToggle = (equipmentId: string, checked: boolean) => {
        const newEquipment = checked ? [...localEquipment, equipmentId] : localEquipment.filter(id => id !== equipmentId);
        setLocalEquipment(newEquipment);
        onUpdateEquipment(site.id, newEquipment);
    };

    return (
        <Popover modal={true}>
            <PopoverTrigger asChild>
                <Button variant={localEquipment.length > 0 ? "secondary" : "outline"} size="sm" className={`shrink-0 h-9 transition-colors ${localEquipment.length > 0 ? "bg-orange-100 text-orange-800 hover:bg-orange-200" : ""}`}>
                    <Wrench className="h-4 w-4 mr-1.5" />
                    {localEquipment.length > 0 ? `${localEquipment.length} Req.` : 'Matériel'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 shadow-xl" align="end" side="bottom" avoidCollisions={true}>
                <div className="bg-muted/30 p-3 border-b">
                    <h4 className="font-semibold text-sm">Matériel requis</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Cochez le matériel obligatoire pour ce chantier.</p>
                </div>
                <div className="p-4 space-y-2 max-h-80 overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                    {equipment.map((eq: any) => {
                        const isSelected = localEquipment.includes(eq.id);
                        const displayName = eq.name || eq.id;
                        return (
                            <label key={eq.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent p-1.5 rounded-md transition-colors ml-1">
                                <input type="checkbox" className="rounded border-gray-300 text-orange-600 focus:ring-orange-600 h-4 w-4 shrink-0" checked={isSelected} onChange={(e) => handleToggle(eq.id, e.target.checked)} />
                                <span className="leading-tight">{displayName}</span>
                            </label>
                        );
                    })}
                    {equipment.length === 0 && <p className="text-xs text-muted-foreground italic">Aucun matériel trouvé.</p>}
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

    // Fetch dynamic data lists
    const { data: skillDefinitions = [] } = useQuery({
        queryKey: ['skill_definitions'],
        queryFn: async () => {
            const { data, error } = await supabase.from('skill_definitions').select('*').order('category').order('name');
            if (error) throw error;
            return data;
        },
        enabled: open,
    });

    const { data: vehiclesList = [] } = useQuery({
        queryKey: ['vehicles'],
        queryFn: async () => {
            const { data, error } = await supabase.from('vehicles').select('*');
            if (error) throw error;
            return data;
        },
        enabled: open,
    });

    const { data: equipmentList = [] } = useQuery({
        queryKey: ['equipment'],
        queryFn: async () => {
            const { data, error } = await supabase.from('equipment').select('*');
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
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (!newClientName.trim() || !newClientSite.trim()) return;

        createCommande.mutate({
            client: newClientName.trim(),
            chantier: newClientSite.trim(),
            required_skills: [],
            required_vehicles: [],
            required_equipment: []
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
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (!selectedClientName || !newSiteAddress.trim()) return;

        createCommande.mutate({
            client: selectedClientName,
            chantier: newSiteAddress.trim(),
            required_skills: [],
            required_vehicles: [],
            required_equipment: []
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
                    if (selectedClientSites.length <= 1) setSelectedClientName(null);
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

    // Updaters for the 3 arrays
    const handleUpdateSiteSkills = (id: string, newSkills: string[]) => {
        updateCommande.mutate({ id, required_skills: newSkills }, { onError: (err) => toast.error(`Erreur: ${err.message}`) });
    };
    const handleUpdateSiteVehicles = (id: string, newVehicles: string[]) => {
        updateCommande.mutate({ id, required_vehicles: newVehicles }, { onError: (err) => toast.error(`Erreur: ${err.message}`) });
    };
    const handleUpdateSiteEquipment = (id: string, newEquipment: string[]) => {
        updateCommande.mutate({ id, required_equipment: newEquipment }, { onError: (err) => toast.error(`Erreur: ${err.message}`) });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[1000px] h-[85vh] flex flex-col p-0 overflow-hidden bg-card">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <Building2 className="h-6 w-6 text-primary" />
                        Gestion des Clients & Chantiers
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT SIDE: Client List */}
                    <div className="w-1/3 border-r bg-muted/10 flex flex-col">
                        <div className="p-4 border-b">
                            <Button type="button" className="w-full" variant={isAddingNewClient ? "secondary" : "default"} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsAddingNewClient(true); setSelectedClientName(null); }}>
                                <Plus className="h-4 w-4 mr-2" /> Nouveau Client
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {clientNames.map(clientName => (
                                <button key={clientName} type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedClientName(clientName); setIsAddingNewClient(false); }} className={`w-full text-left px-4 py-3 rounded-md transition-colors text-sm font-medium ${selectedClientName === clientName ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
                                    {clientName}
                                    <span className="block text-xs opacity-70 mt-0.5 font-normal">{(groupedClients[clientName] || []).length} chantier(s)</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT SIDE: Details & Work Sites */}
                    <div className="w-2/3 flex flex-col bg-background">
                        {isAddingNewClient && (
                            <div className="p-8 max-w-md mx-auto w-full space-y-6">
                                <div className="space-y-2">
                                    <h3 className="text-lg font-semibold">Ajouter un nouveau client</h3>
                                    <p className="text-sm text-muted-foreground">Créez le client et ajoutez sa première adresse de chantier.</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Nom du Client</Label>
                                        <Input placeholder="Ex: Mairie de Paris" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateNewClient(e)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Adresse du premier chantier</Label>
                                        <Input placeholder="Ex: 12 Rue de Rivoli, 75001 Paris" value={newClientSite} onChange={(e) => setNewClientSite(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateNewClient(e)} />
                                    </div>
                                    <Button type="button" className="w-full mt-4" onClick={handleCreateNewClient}>
                                        <Save className="h-4 w-4 mr-2" /> Enregistrer le client
                                    </Button>
                                </div>
                            </div>
                        )}

                        {!isAddingNewClient && selectedClientName && (
                            <div className="flex flex-col h-full">
                                <div className="p-6 border-b flex justify-between items-center bg-muted/5 shrink-0">
                                    <div>
                                        <h3 className="text-2xl font-bold text-primary">{selectedClientName}</h3>
                                        <p className="text-sm text-muted-foreground mt-1">Gérez les adresses et les obligations de chantier.</p>
                                    </div>
                                    <Button type="button" variant="outline" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsAddingSite(!isAddingSite); }}>
                                        <Plus className="h-4 w-4 mr-2" /> Ajouter un chantier
                                    </Button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {isAddingSite && (
                                        <div className="bg-accent/50 p-4 rounded-lg border border-primary/20 flex gap-2 items-end mb-6">
                                            <div className="flex-1 space-y-2">
                                                <Label>Nouvelle adresse de chantier</Label>
                                                <Input placeholder="Saisissez l'adresse du nouveau site..." value={newSiteAddress} onChange={(e) => setNewSiteAddress(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSiteToClient(e)} autoFocus />
                                            </div>
                                            <Button type="button" onClick={handleAddSiteToClient}>Enregistrer</Button>
                                            <Button type="button" variant="ghost" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsAddingSite(false); }}>Annuler</Button>
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        {selectedClientSites.map(site => (
                                            <div key={site.id} className="group flex flex-col gap-2 p-3 bg-card border rounded-lg hover:border-primary/50 transition-colors shadow-sm">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-5 w-5 text-muted-foreground shrink-0 ml-1" />
                                                    <Input
                                                        defaultValue={site.chantier}
                                                        onBlur={(e) => { if (e.target.value !== site.chantier && e.target.value.trim() !== '') handleUpdateSite(site.id, e.target.value); }}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); e.currentTarget.blur(); } }}
                                                        className="flex-1 border-transparent hover:border-input focus:border-input bg-transparent font-medium"
                                                    />
                                                    <Button
                                                        type="button" variant="ghost" size="icon"
                                                        className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 transition-opacity shrink-0 h-9 w-9"
                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteSite(site.id, site.chantier); }}
                                                        title="Supprimer ce chantier"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>

                                                {/* The 3 Requirement Checklists! */}
                                                <div className="flex flex-wrap items-center gap-2 pl-8">
                                                    <SiteSkillsPopover site={site} categories={categories} skillDefinitions={skillDefinitions} onUpdateSkills={handleUpdateSiteSkills} />
                                                    <SiteVehiclesPopover site={site} vehicles={vehiclesList} onUpdateVehicles={handleUpdateSiteVehicles} />
                                                    <SiteEquipmentPopover site={site} equipment={equipmentList} onUpdateEquipment={handleUpdateSiteEquipment} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

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