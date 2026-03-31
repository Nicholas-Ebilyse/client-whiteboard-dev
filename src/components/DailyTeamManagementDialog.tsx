import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DailyTeamManagementDialogProps {
    isOpen: boolean;
    onClose: () => void;
    teamName: string;
    date: string;
    activeTechnicians: any[];
    currentRosters: any[];
    onSave: (rosters: { technician_id: string; is_team_leader: boolean }[]) => void;
    baseTeamId?: string; // We added this prop!
}

export const DailyTeamManagementDialog: React.FC<DailyTeamManagementDialogProps> = ({
    isOpen,
    onClose,
    teamName,
    date,
    activeTechnicians,
    currentRosters,
    onSave,
    baseTeamId,
}) => {
    const [selectedTechs, setSelectedTechs] = useState<{ id: string; isLeader: boolean }[]>([]);

    useEffect(() => {
        if (isOpen) {
            if (currentRosters.length > 0) {
                // If a roster exists for this day, load it
                setSelectedTechs(
                    currentRosters.map(r => ({
                        id: r.technician_id,
                        isLeader: r.is_team_leader || false,
                    }))
                );
            } else if (baseTeamId) {
                // UX Fix: If empty, pre-check the base team members to save time!
                const baseMembers = activeTechnicians.filter(t => t.team_id === baseTeamId);
                setSelectedTechs(
                    baseMembers.map((t, index) => ({
                        id: t.id,
                        isLeader: index === 0, // Make the first person the leader automatically
                    }))
                );
            } else {
                setSelectedTechs([]);
            }
        }
    }, [isOpen, currentRosters, activeTechnicians, baseTeamId]);

    const handleToggleTech = (techId: string) => {
        setSelectedTechs(prev => {
            const exists = prev.find(t => t.id === techId);
            if (exists) {
                return prev.filter(t => t.id !== techId);
            } else {
                return [...prev, { id: techId, isLeader: prev.length === 0 }];
            }
        });
    };

    const handleSetLeader = (techId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedTechs(prev =>
            prev.map(t => ({
                ...t,
                isLeader: t.id === techId,
            }))
        );
    };

    const handleSave = () => {
        onSave(
            selectedTechs.map(t => ({
                technician_id: t.id,
                is_team_leader: t.isLeader,
            }))
        );
        onClose();
    };

    if (!date) return null;

    const formattedDate = format(new Date(date), 'EEEE d MMMM yyyy', { locale: fr });

    // UX Fix: Sort the list so Base Team members always appear at the very top
    const sortedTechnicians = [...activeTechnicians].sort((a, b) => {
        const aIsBase = a.team_id === baseTeamId;
        const bIsBase = b.team_id === baseTeamId;
        if (aIsBase && !bIsBase) return -1;
        if (!aIsBase && bIsBase) return 1;
        return a.name.localeCompare(b.name);
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Composition de {teamName}</DialogTitle>
                    <p className="text-sm text-muted-foreground capitalize">{formattedDate}</p>
                </DialogHeader>

                <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {sortedTechnicians.map(tech => {
                        const isSelected = selectedTechs.some(t => t.id === tech.id);
                        const isLeader = selectedTechs.find(t => t.id === tech.id)?.isLeader;
                        const isBaseTeamMember = tech.team_id === baseTeamId;

                        return (
                            <div
                                key={tech.id}
                                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                                    }`}
                                onClick={() => handleToggleTech(tech.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => handleToggleTech(tech.id)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-medium">{tech.name}</span>
                                        {/* Visual indicator for base team members */}
                                        {isBaseTeamMember && (
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                                Équipe de base
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {isSelected && (
                                    <Button
                                        type="button"
                                        variant={isLeader ? "default" : "outline"}
                                        size="sm"
                                        className={`h-7 text-xs ${isLeader ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-none shadow-sm' : ''}`}
                                        onClick={(e) => handleSetLeader(tech.id, e)}
                                    >
                                        {isLeader ? '⭐ Chef' : 'Définir Chef'}
                                    </Button>
                                )}
                            </div>
                        );
                    })}

                    {sortedTechnicians.length === 0 && (
                        <p className="text-sm text-center text-muted-foreground italic py-4">
                            Aucun technicien disponible. Ajoutez-en via le menu Admin.
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Annuler</Button>
                    <Button onClick={handleSave}>Enregistrer l'équipe</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};