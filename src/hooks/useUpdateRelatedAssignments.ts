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