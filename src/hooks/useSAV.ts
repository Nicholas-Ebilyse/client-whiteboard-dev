import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, addDays, format } from 'date-fns';

export interface SAVRecord {
  id: string;
  external_id: string | null;
  numero: number;
  nom_client: string;
  adresse: string;
  telephone: string | null;
  probleme: string;
  date: string;
  est_resolu: boolean;
  resolved_at: string | null;
  resolved_week_start: string | null;
  created_at: string;
  updated_at: string;
}

export const useSAV = (weekStart: string | undefined, weekEnd: string | undefined) => {
  return useQuery({
    queryKey: ['sav', weekStart, weekEnd],
    queryFn: async () => {
      if (!weekStart || !weekEnd) return [];

      // Fetch all SAV records where:
      // 1. Date is on or before the week end
      // 2. Either not resolved, OR resolved during a week that ends after the current week
      const { data, error } = await supabase
        .from('sav')
        .select('*')
        .lte('date', weekEnd)
        .order('numero', { ascending: false });
      
      if (error) throw error;
      
      // Filter client-side to handle the resolved_week_start logic
      // If resolved, only show if resolved_week_start is null or >= weekStart
      const filtered = (data || []).filter((record: SAVRecord) => {
        if (!record.est_resolu) return true;
        // If resolved, show only if resolved in current week or later
        if (!record.resolved_week_start) return true;
        return record.resolved_week_start >= weekStart;
      });
      
      return filtered as SAVRecord[];
    },
    enabled: !!weekStart && !!weekEnd,
  });
};

export const useUpdateSAVResolved = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, est_resolu, weekStart }: { id: string; est_resolu: boolean; weekStart: string }) => {
      const updates: any = {
        est_resolu,
      };
      
      if (est_resolu) {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_week_start = weekStart;
      } else {
        updates.resolved_at = null;
        updates.resolved_week_start = null;
      }
      
      const { data, error } = await supabase
        .from('sav')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sav'] });
    },
  });
};