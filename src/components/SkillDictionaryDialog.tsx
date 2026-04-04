import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Trash2, Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const SkillDictionaryDialog = ({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) => {
    const queryClient = useQueryClient();
    const [newCategory, setNewCategory] = useState('');
    const [newName, setNewName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: skills = [], isLoading } = useQuery({
        queryKey: ['skill_definitions'],
        queryFn: async () => {
            const { data, error } = await supabase.from('skill_definitions').select('*').order('category').order('name');
            if (error) throw error;
            return data;
        },
        enabled: open,
    });

    const categories = Array.from(new Set(skills.map(s => s.category)));

    const handleAdd = async () => {
        if (!newCategory.trim() || !newName.trim()) {
            toast.error('Veuillez remplir la catégorie et le nom de la compétence');
            return;
        }
        setIsSubmitting(true);
        const { error } = await supabase.from('skill_definitions').insert({
            category: newCategory.trim(),
            name: newName.trim()
        });

        if (error) {
            if (error.code === '23505') toast.error('Cette compétence existe déjà dans cette catégorie');
            else toast.error(error.message);
        } else {
            toast.success('Compétence ajoutée au catalogue');
            setNewName(''); // We keep the category filled to easily add multiple skills to the same tab!
            queryClient.invalidateQueries({ queryKey: ['skill_definitions'] });
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Supprimer cette compétence du catalogue ? (Les techniciens conserveront leur évaluation en base de données, mais elle ne sera plus affichée)')) return;

        const { error } = await supabase.from('skill_definitions').delete().eq('id', id);
        if (error) toast.error(error.message);
        else {
            toast.success('Compétence retirée du catalogue');
            queryClient.invalidateQueries({ queryKey: ['skill_definitions'] });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl max-h-[85vh] flex flex-col bg-slate-50">
                <DialogHeader className="bg-white p-4 border-b -mx-6 -mt-6 mb-2 rounded-t-lg">
                    <DialogTitle>Catalogue des compétences</DialogTitle>
                    <DialogDescription>
                        Gérez les catégories et les compétences. Vos modifications apparaîtront instantanément dans la Matrice de tous les techniciens.
                    </DialogDescription>
                </DialogHeader>

                {/* ── Formulaire d'ajout ── */}
                <div className="flex flex-col sm:flex-row gap-3 items-end bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex-1 w-full space-y-1.5">
                        <Label className="text-xs font-semibold text-primary">Catégorie</Label>
                        <Input
                            list="categories-list"
                            value={newCategory}
                            onChange={e => setNewCategory(e.target.value)}
                            placeholder="Ex: CACES, Permis..."
                            className="h-9"
                        />
                        <datalist id="categories-list">
                            {categories.map(c => <option key={c} value={c} />)}
                        </datalist>
                    </div>
                    <div className="flex-1 w-full space-y-1.5">
                        <Label className="text-xs font-semibold text-primary">Nouvelle compétence</Label>
                        <Input
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="Ex: Grue, SST..."
                            className="h-9"
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        />
                    </div>
                    <Button onClick={handleAdd} disabled={isSubmitting} className="w-full sm:w-auto h-9">
                        <Plus className="w-4 h-4 sm:mr-1" /> <span className="sm:hidden lg:inline">Ajouter</span>
                    </Button>
                </div>

                {/* ── Liste du dictionnaire ── */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-5 mt-4">
                    {isLoading ? (
                        <p className="text-center text-muted-foreground text-sm py-8">Chargement du catalogue...</p>
                    ) : categories.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-8 italic bg-white rounded-lg border border-dashed">Le catalogue est vide.</p>
                    ) : (
                        categories.map(cat => (
                            <div key={cat} className="space-y-2 bg-white p-3 rounded-lg border shadow-sm">
                                <h3 className="font-bold text-slate-700 border-b pb-2 flex items-center justify-between">
                                    {cat}
                                    <span className="text-[10px] font-normal bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                        {skills.filter(s => s.category === cat).length} éléments
                                    </span>
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    {skills.filter(s => s.category === cat).map(skill => (
                                        <div key={skill.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded p-1.5 hover:border-slate-300 transition-colors">
                                            <span className="text-xs font-medium truncate mr-2 px-1">{skill.name}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-50 hover:text-red-600 shrink-0" onClick={() => handleDelete(skill.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};