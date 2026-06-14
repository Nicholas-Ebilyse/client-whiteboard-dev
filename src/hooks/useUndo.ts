import { useEffect } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Global variable to remember the last deleted item in memory
export let lastDeletedAssignmentId: string | null = null;

export const setLastDeletedAssignmentId = (id: string | null) => {
    lastDeletedAssignmentId = id;
};

export const useUndo = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            // Trigger on Ctrl+Z or Cmd+Z
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                if (lastDeletedAssignmentId) {
                    e.preventDefault(); // Prevent browser native undo
                    const idToRestore = lastDeletedAssignmentId;
                    
                    try {
                        const { error } = await supabase
                            .from('assignments')
                            .update({ is_deleted: false })
                            .eq('id', idToRestore);

                        if (error) throw error;

                        toast.success('Affectation restaurée avec succès !');
                        setLastDeletedAssignmentId(null); // Clear memory after successful undo
                        queryClient.invalidateQueries({ queryKey: ['assignments'] });
                    } catch (err) {
                        console.error('Erreur lors de l\'annulation:', err);
                        toast.error('Erreur lors de la restauration');
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [queryClient]);
};