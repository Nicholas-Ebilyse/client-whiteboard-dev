import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TriangleAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DailyTeamManagementDialogProps {
    isOpen: boolean;
    onClose: () => void;
    teamName: string;
    date: string;
    activeTechnicians: any[];
    currentRosters: any[];
    onSave: (rosters: { technician_id: string; is_team_leader: boolean }[]) => void;
    baseTeamId?: string;
    allAssignments?: any[];
    commandes?: any[];
    allRosters?: any[];
    absences?: any[];
    teams?: any[];
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
    allAssignments = [],
    commandes = [],
    allRosters = [],
    absences = [],
    teams = [],
}) => {
    const [selectedTechs, setSelectedTechs] = useState<{ id: string; isLeader: boolean }[]>([]);

    // ── SMART IN-MEMORY COMPUTATION: Skills required for worksites on this date ──
    const requiredSkills = useMemo(() => {
        if (!isOpen || !date) return [];
        let teamId = baseTeamId;
        if (!teamId && teams.length > 0) {
            teamId = teams.find(t => t.name === teamName)?.id;
        }
        if (!teamId || allAssignments.length === 0) return [];

        const teamAssignments = allAssignments.filter(a => {
            const aTeamId = a.team_id || a.teamId;
            const aStart = a.start_date || a.startDate;
            const aEnd = a.end_date || a.endDate;
            return aTeamId === teamId && aStart <= date && aEnd >= date;
        });

        if (teamAssignments.length === 0) return [];

        const commandeIds = new Set(teamAssignments.map(a => a.commande_id || a.commandeId).filter(Boolean));
        const skills = new Set<string>();
        commandes.forEach(c => {
            if (commandeIds.has(c.id) && Array.isArray(c.required_skills)) {
                c.required_skills.forEach((s: string) => skills.add(s));
            }
        });

        return Array.from(skills);
    }, [isOpen, date, baseTeamId, teamName, teams, allAssignments, commandes]);

    // ── SMART IN-MEMORY AVAILABILITY SCANNER: Identify already busy/absent techs ──
    const busyTechIds = useMemo(() => {
        if (!isOpen || !date) return new Set<string>();
        const busy = new Set<string>();

        // 1. Technicians rostered on another team on this date
        allRosters.forEach(roster => {
            if (roster.date === date && roster.team_name !== teamName && roster.technician_id) {
                busy.add(roster.technician_id);
            }
        });

        // 2. Technicians officially absent on this date
        absences.forEach(abs => {
            const start = abs.start_date || abs.startDate;
            const end = abs.end_date || abs.endDate;
            if (abs.technician_id && start <= date && end >= date) {
                busy.add(abs.technician_id);
            }
        });

        return busy;
    }, [isOpen, date, teamName, allRosters, absences]);

    // ── INITIALIZE SELECTED TECHNICIANS ──
    useEffect(() => {
        if (!isOpen) return;

        if (currentRosters && currentRosters.length > 0) {
            setSelectedTechs(
                currentRosters.map(r => ({
                    id: r.technician_id,
                    isLeader: r.is_team_leader || false,
                }))
            );
        } else if (baseTeamId) {
            const baseMembers = activeTechnicians.filter(
                t => t.team_id === baseTeamId && !busyTechIds.has(t.id)
            );
            setSelectedTechs(
                baseMembers.map((t, index) => ({
                    id: t.id,
                    isLeader: index === 0,
                }))
            );
        } else {
            setSelectedTechs([]);
        }
    }, [isOpen, currentRosters, baseTeamId, activeTechnicians, busyTechIds]);

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
        const validSelectedTechs = selectedTechs.filter(t => !busyTechIds.has(t.id));
        onSave(
            validSelectedTechs.map(t => ({
                technician_id: t.id,
                is_team_leader: t.isLeader,
            }))
        );
        onClose();
    };

    if (!date) return null;

    const formattedDate = format(new Date(date), 'EEEE d MMMM yyyy', { locale: fr });

    // ── FIXED SORTING LOGIC: Safely handles unassigned technicians (null team_id) ──
    const sortedTechnicians = [...activeTechnicians]
        .filter(tech => !busyTechIds.has(tech.id))
        .sort((a, b) => {
            const aIsBase = baseTeamId && a.team_id === baseTeamId;
            const bIsBase = baseTeamId && b.team_id === baseTeamId;
            
            // Base team members always go to the top
            if (aIsBase && !bIsBase) return -1;
            if (!aIsBase && bIsBase) return 1;
            
            // Then sort alphabetically
            return (a.name || '').localeCompare(b.name || '');
        });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Composition de {teamName}</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground capitalize">{formattedDate}</DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {sortedTechnicians.map(tech => {
                        const isSelected = selectedTechs.some(t => t.id === tech.id);
                        const isLeader = selectedTechs.find(t => t.id === tech.id)?.isLeader;
                        const isBaseTeamMember = baseTeamId && tech.team_id === baseTeamId;

                        const missingSkills = requiredSkills.filter(reqSkill => {
                            return tech.detailed_skills?.[reqSkill] !== 'Oui';
                        });

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
                                        <div className="font-medium flex items-center gap-1.5">
                                            {tech.name}
                                            {missingSkills.length > 0 && (
                                                <TooltipProvider delayDuration={100}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                            <TriangleAlert className="h-4 w-4 text-amber-500 hover:text-amber-600 transition-colors" />
                                                        </TooltipTrigger>
                                                        <TooltipContent side="right" className="border-amber-200 bg-amber-50 text-amber-900 shadow-md">
                                                            <p className="font-semibold text-xs mb-1">Compétence(s) manquante(s) :</p>
                                                            <ul className="text-xs list-disc pl-4 space-y-0.5">
                                                                {missingSkills.map(s => <li key={s}>{s}</li>)}
                                                            </ul>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </div>
                                        {isBaseTeamMember ? (
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                                Équipe de base
                                            </span>
                                        ) : !tech.team_id && (
                                            <span className="text-[10px] text-slate-400 italic">
                                                Non affecté
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
                            Tous les techniciens sont déjà affectés ailleurs aujourd'hui.
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