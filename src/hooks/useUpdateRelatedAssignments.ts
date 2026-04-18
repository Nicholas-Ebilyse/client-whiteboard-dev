import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useUpdateRelatedAssignments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      updates
    }: {
      groupId: string;
      updates: Record<string, any>
    }) => {

      // 🚨 THE SAFETY LOCK: Prevent mass updates if groupId is missing
      if (!groupId || groupId.trim() === '') {
        console.error("CRITICAL: Blocked an attempt to mass-update assignments with a null groupId.");
        // Throwing an error forces the frontend to stop and alerts the developer
        throw new Error("Impossible de mettre à jour le groupe : aucun ID de groupe n'a été fourni.");
      }

      const { data, error } = await supabase
        .from('assignments')
        .update(updates)
        .eq('assignment_group_id', groupId)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
};