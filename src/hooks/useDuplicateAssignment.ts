import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useDuplicateAssignment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      // Fetch the original assignment
      const { data: original, error: fetchError } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Create a copy without the id and move to next period
      const { id, created_at, updated_at, assignment_group_id, ...assignmentData } = original;
      
      // Calculate next period
      let newStartDate = original.start_date;
      let newStartPeriod = original.start_period;
      let newEndDate = original.end_date;
      let newEndPeriod = original.end_period;
      
      // Move to next period
      if (original.end_period === 'Matin') {
        newStartPeriod = 'Après-midi';
        newStartDate = original.end_date;
        newEndPeriod = 'Après-midi';
        newEndDate = original.end_date;
      } else {
        // End period is Après-midi, so move to next day morning
        const endDate = new Date(original.end_date);
        endDate.setDate(endDate.getDate() + 1);
        newStartDate = endDate.toISOString().split('T')[0];
        newStartPeriod = 'Matin';
        newEndDate = newStartDate;
        newEndPeriod = 'Matin';
      }
      
      const { data, error } = await supabase
        .from('assignments')
        .insert({
          ...assignmentData,
          start_date: newStartDate,
          start_period: newStartPeriod,
          end_date: newEndDate,
          end_period: newEndPeriod,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
};