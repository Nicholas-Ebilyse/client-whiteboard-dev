import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, X, Settings } from 'lucide-react';
import { SkillDictionaryDialog } from './SkillDictionaryDialog'; // <--- NEW COMPONENT IMPORTED

interface TechnicianSkillsMatrixProps {
    technicianId: string | null;
    technicianName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const TechnicianSkillsMatrix = ({
    technicianId,
    technicianName,
    open,
    onOpenChange,
}: TechnicianSkillsMatrixProps) => {
    const queryClient = useQueryClient();
    const [localSkills, setLocalSkills] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [dictionaryOpen, setDictionaryOpen] = useState(false); // <--- DIALOG STATE

    const { data: skillDefinitions = [], isLoading: isLoadingDefs } = useQuery({
        queryKey: ['skill_definitions'],
        queryFn: async () => {
            const { data, error } = await supabase.from('skill_definitions').select('*').order('category').order('name');
            if (error) throw error;
            return data;
        },
        enabled: open,
    });

    const { data: technicianData, isLoading: isLoadingTech } = useQuery({
        queryKey: ['technician_skills', technicianId],
        queryFn: async () => {
            if (!technicianId) return null;
            const { data, error } = await supabase.from('technicians').select('detailed_skills').eq('id', technicianId).single();
            if (error) throw error;
            return data;
        },
        enabled: open && !!technicianId,
    });

    useEffect(() => {
        if (technicianData?.detailed_skills) {
            setLocalSkills(technicianData.detailed_skills as Record<string, string>);
        } else {
            setLocalSkills({});
        }
    }, [technicianData, open]);

    const categories = Array.from(new Set(skillDefinitions.map(s => s.category)));

    const handleToggle = (category: string, name: string, value: string) => {
        const key = `${category} - ${name}`;
        setLocalSkills(prev => ({
            ...prev,
            [key]: prev[key] === value ? 'Non renseigné' : value
        }));
    };

    const handleSave = async () => {
        if (!technicianId) return;
        setIsSaving(true);
        try {
            const cleanedSkills = Object.fromEntries(
                Object.entries(localSkills).filter(([_, value]) => value !== 'Non renseigné')
            );

            const { error } = await supabase
                .from('technicians')
                .update({ detailed_skills: cleanedSkills })
                .eq('id', technicianId);

            if (error) throw error;

            toast.success('Matrice de compétences mise à jour');
            queryClient.invalidateQueries({ queryKey: ['technicians'] });
            queryClient.invalidateQueries({ queryKey: ['technician_skills', technicianId] });
            onOpenChange(false);
        } catch (error: any) {
            toast.error(`Erreur lors de la sauvegarde: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const getButtonClass = (currentValue: string, buttonValue: string) => {
        if (currentValue !== buttonValue) return "bg-background text-muted-foreground hover:bg-muted";
        switch (buttonValue) {
            case 'Oui': return "bg-green-100 text-green-700 border-green-300 hover:bg-green-200 shadow-sm";
            case 'Partiel': return "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200 shadow-sm";
            case 'Non': return "bg-red-100 text-red-700 border-red-300 hover:bg-red-200 shadow-sm";
            default: return "";
        }
    };

    const isLoading = isLoadingDefs || isLoadingTech;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="text-xl">Matrice de Compétences</DialogTitle>
                                <DialogDescription className="mt-1">
                                    Évaluation technique de <strong className="text-primary">{technicianName}</strong>
                                </DialogDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setDictionaryOpen(true)} className="shrink-0 bg-slate-50">
                                <Settings className="w-4 h-4 mr-2 text-slate-600" />
                                Catalogue des compétences
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-40">
                                <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                            </div>
                        ) : categories.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 space-y-4">
                                <p className="text-muted-foreground italic">Aucune compétence définie dans le catalogue.</p>
                                <Button onClick={() => setDictionaryOpen(true)}>Ajouter des compétences</Button>
                            </div>
                        ) : (
                            <Tabs defaultValue={categories[0]} className="w-full flex flex-col sm:flex-row gap-6">
                                <TabsList className="flex flex-col h-auto w-full sm:w-48 bg-transparent items-stretch gap-1">
                                    {categories.map(category => {
                                        const categorySkills = skillDefinitions.filter(s => s.category === category);
                                        const filledCount = categorySkills.filter(s => {
                                            const val = localSkills[`${category} - ${s.name}`];
                                            return val === 'Oui' || val === 'Partiel' || val === 'Non';
                                        }).length;

                                        return (
                                            <TabsTrigger
                                                key={category}
                                                value={category}
                                                className="justify-between px-3 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md border transition-all"
                                            >
                                                <span className="truncate text-sm font-semibold">{category}</span>
                                                {filledCount > 0 && (
                                                    <span className="text-[10px] bg-background/20 text-inherit px-1.5 py-0.5 rounded-full ml-2 shrink-0">
                                                        {filledCount}/{categorySkills.length}
                                                    </span>
                                                )}
                                            </TabsTrigger>
                                        );
                                    })}
                                </TabsList>

                                <div className="flex-1 min-w-0 bg-card border rounded-lg p-5 shadow-sm">
                                    {categories.map(category => (
                                        <TabsContent key={category} value={category} className="mt-0 outline-none">
                                            <h3 className="font-bold text-lg mb-5 text-primary border-b pb-2">{category}</h3>
                                            <div className="space-y-3">
                                                {skillDefinitions
                                                    .filter(s => s.category === category)
                                                    .map(skill => {
                                                        const key = `${category} - ${skill.name}`;
                                                        const currentValue = localSkills[key] || 'Non renseigné';

                                                        return (
                                                            <div key={skill.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-md border bg-slate-50/50 hover:bg-slate-50 hover:border-primary/30 transition-colors">
                                                                <span className="text-sm font-medium pl-1">{skill.name}</span>
                                                                <div className="flex rounded-md shadow-sm shrink-0">
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        className={`rounded-r-none border-r-0 h-9 text-xs px-5 transition-colors ${getButtonClass(currentValue, 'Oui')}`}
                                                                        onClick={() => handleToggle(category, skill.name, 'Oui')}
                                                                    >
                                                                        Oui
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        className={`rounded-none h-9 text-xs px-5 transition-colors ${getButtonClass(currentValue, 'Partiel')}`}
                                                                        onClick={() => handleToggle(category, skill.name, 'Partiel')}
                                                                    >
                                                                        Partiel
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        className={`rounded-l-none h-9 text-xs px-5 transition-colors ${getButtonClass(currentValue, 'Non')}`}
                                                                        onClick={() => handleToggle(category, skill.name, 'Non')}
                                                                    >
                                                                        Non
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </TabsContent>
                                    ))}
                                </div>
                            </Tabs>
                        )}
                    </div>

                    <DialogFooter className="p-4 border-t bg-card">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                            <X className="w-4 h-4 mr-2" /> Annuler
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || isLoading}>
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Sauvegarder
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Sub-Dialog for Dictionary Management ── */}
            <SkillDictionaryDialog open={dictionaryOpen} onOpenChange={setDictionaryOpen} />
        </>
    );
};