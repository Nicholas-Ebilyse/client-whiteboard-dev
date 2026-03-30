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
}

export const DailyTeamManagementDialog: React.FC<DailyTeamManagementDialogProps> = ({
    isOpen,
    onClose,
    teamName,
    date,
    activeTechnicians,
    currentRosters,
    onSave,
}) => {
    // Store the currently checked technicians and who is the leader
    const [selectedTechs, setSelectedTechs] = useState<{ id: string; isLeader: boolean }[]>([]);

    // When the dialog opens, load the existing team for that day
    useEffect(() => {
        if (isOpen) {
            setSelectedTechs(
                currentRosters.map(r => ({
                    id: r.technician_id,
                    isLeader: r.is_team_leader || false,
                }))
            );
        }
    }, [isOpen, currentRosters]);

    const handleToggleTech = (techId: string) => {
        setSelectedTechs(prev => {
            const exists = prev.find(t => t.id === techId);
            if (exists) {
                // Remove technician
                return prev.filter(t => t.id !== techId);
            } else {
                // Add technician. If they are the first one, make them leader automatically!
                return [...prev, { id: techId, isLeader: prev.length === 0 }];
            }
        });
    };

    const handleSetLeader = (techId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent the row click from unchecking the box
        setSelectedTechs(prev =>
            prev.map(t => ({
                ...t,
                isLeader: t.id === techId, // Only one leader allowed
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

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Composition de {teamName}</DialogTitle>
                    <p className="text-sm text-muted-foreground capitalize">{formattedDate}</p>
                </DialogHeader>

                <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {activeTechnicians.map(tech => {
                        const isSelected = selectedTechs.some(t => t.id === tech.id);
                        const isLeader = selectedTechs.find(t => t.id === tech.id)?.isLeader;

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
                                    <span className="font-medium">{tech.name}</span>
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

                    {activeTechnicians.length === 0 && (
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