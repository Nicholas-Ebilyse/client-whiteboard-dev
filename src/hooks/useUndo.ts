import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export let lastDeletedAssignmentId: string | null = null;
let listeners: ((id: string | null) => void)[] = [];

export const setLastDeletedAssignmentId = (id: string | null) => {
    lastDeletedAssignmentId = id;
    listeners.forEach(l => l(id)); // Notify React when a delete happens
};

export const useUndo = () => {
    const queryClient = useQueryClient();
    const [deletedId, setDeletedId] = useState<string | null>(lastDeletedAssignmentId);

    // Sync memory to React state
    useEffect(() => {
        const listener = (id: string | null) => setDeletedId(id);
        listeners.push(listener);
        return () => { listeners = listeners.filter(l => l !== listener); };
    }, []);

    const triggerUndo = async () => {
        if (lastDeletedAssignmentId) {
            const idToRestore = lastDeletedAssignmentId;
            try {
                const { error } = await supabase.from('assignments').update({ is_deleted: false }).eq('id', idToRestore);
                if (error) throw error;
                toast.success('Affectation restaurée avec succès !');
                setLastDeletedAssignmentId(null);
                queryClient.invalidateQueries({ queryKey: ['assignments'] });
            } catch (err) {
                toast.error('Erreur lors de la restauration');
            }
        }
    };

    // Keyboard listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                if (lastDeletedAssignmentId) {
                    e.preventDefault();
                    triggerUndo();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [queryClient]);

    return { canUndoDelete: !!deletedId, triggerUndoDelete: triggerUndo };
};