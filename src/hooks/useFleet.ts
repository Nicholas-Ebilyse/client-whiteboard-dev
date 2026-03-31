import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useFleet = (table: 'vehicles' | 'equipment') => {
  return useQuery({
    queryKey: ['fleet', table],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateFleetItem = (table: 'vehicles' | 'equipment') => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.from(table).insert([item]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fleet', table] }),
  });
};

export const useDeleteFleetItem = (table: 'vehicles' | 'equipment') => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fleet', table] }),
  });
};