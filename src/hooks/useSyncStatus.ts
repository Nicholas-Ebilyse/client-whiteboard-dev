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
      // For 'google_sheets', also check 'google_sheets_export' and return the most recent
      const typesToCheck = syncType === 'google_sheets'
        ? ['google_sheets', 'google_sheets_export']
        : syncType ? [syncType] : undefined;

      let query = supabase
        .from('sync_status')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(typesToCheck ? typesToCheck.length * 2 : 1);

      if (typesToCheck) {
        query = query.in('sync_type', typesToCheck);
      }

      const { data, error } = await query;

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Return the most recent record
      return (data?.[0] as SyncStatus | null) || null;
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
