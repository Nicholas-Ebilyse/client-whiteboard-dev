import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SyncStatus {
  id: string;
  sync_type: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'error';
  records_synced: number;
  error_message: string | null;
  error_details: any;
}

export const useSyncStatus = (syncType?: string) => {
  return useQuery({
    queryKey: ['sync-status', syncType],
    queryFn: async () => {
      let query = supabase
        .from('sync_status')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1);

      if (syncType) {
        query = query.eq('sync_type', syncType);
      }

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data as SyncStatus | null;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useAllSyncStatuses = () => {
  return useQuery({
    queryKey: ['sync-statuses-all'],
    queryFn: async () => {
      // Get latest status for each sync type
      const { data, error } = await supabase
        .from('sync_status')
        .select('*')
        .order('started_at', { ascending: false });

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Group by sync_type and get the latest for each
      const statusMap = new Map<string, SyncStatus>();
      for (const status of (data || [])) {
        if (!statusMap.has(status.sync_type)) {
          statusMap.set(status.sync_type, status as SyncStatus);
        }
      }

      return {
        database: statusMap.get('google_sheets_webhook') || null,
        sheets: statusMap.get('google_sheets') || statusMap.get('google_sheets_export') || null,
        calendar: statusMap.get('google_calendar') || null,
      };
    },
    refetchInterval: 30000,
  });
};
