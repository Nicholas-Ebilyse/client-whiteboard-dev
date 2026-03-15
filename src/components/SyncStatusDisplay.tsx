import { useAllSyncStatuses } from "@/hooks/useSyncStatus";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, AlertCircle, Loader2, Database, Calendar } from "lucide-react";

// Build timestamp injected by Vite at build time, or falls back to current time in dev mode
const BUILD_TIME: string = typeof __BUILD_TIME__ !== 'undefined'
  ? __BUILD_TIME__ as string
  : new Date().toISOString().replace('T', ' ').slice(0, 16);

export const SyncStatusDisplay = () => {
  const { data: syncStatuses } = useAllSyncStatuses();

  const getNextDbSyncTime = () => {
    if (!syncStatuses?.database?.started_at) return "dans 5 minutes";
    const lastSync = new Date(syncStatuses.database.started_at);
    const nextSync = new Date(lastSync.getTime() + 5 * 60 * 1000);
    const now = new Date();

    if (nextSync < now) {
      return "bientôt";
    }

    return `dans ${formatDistanceToNow(nextSync, { addSuffix: false, locale: fr })}`;
  };

  const formatSyncTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: fr });
  };

  const getStatusIcon = (status: string | undefined, type: 'db' | 'cal') => {
    if (!status) return null;

    if (status === 'success') {
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />;
    }
    if (status === 'error') {
      return <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />;
    }
    if (status === 'running') {
      return <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin flex-shrink-0" />;
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {/* Database/Sheets sync status */}
      {(syncStatuses?.database || syncStatuses?.sheets) && (
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          {getStatusIcon(syncStatuses.sheets?.status || syncStatuses.database?.status, 'db')}
          <span className={(syncStatuses.sheets?.status === 'error' || syncStatuses.database?.status === 'error') ? 'text-destructive' : 'text-muted-foreground'}>
            {syncStatuses.sheets?.status === 'running' || syncStatuses.database?.status === 'running' ? (
              'Sync Données en cours...'
            ) : (
              <>
                Données : {formatSyncTime(syncStatuses.sheets?.started_at || syncStatuses.database?.started_at || '')}
                {(syncStatuses.sheets?.records_synced || 0) + (syncStatuses.database?.records_synced || 0) > 0 &&
                  ` (${(syncStatuses.sheets?.records_synced || 0) + (syncStatuses.database?.records_synced || 0)} lig.)`}
              </>
            )}
          </span>
        </div>
      )}

      {/* Calendar sync status */}
      {syncStatuses?.calendar && (
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          {getStatusIcon(syncStatuses.calendar.status, 'cal')}
          <span className={syncStatuses.calendar.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
            {syncStatuses.calendar.status === 'running' ? (
              'Sync Agenda en cours...'
            ) : syncStatuses.calendar.status === 'error' ? (
              `Erreur Agenda ${formatSyncTime(syncStatuses.calendar.started_at)}`
            ) : (
              <>
                Agenda : {formatSyncTime(syncStatuses.calendar.started_at)}
                {syncStatuses.calendar.records_synced > 0 && ` (${syncStatuses.calendar.records_synced} évén.)`}
              </>
            )}
          </span>
        </div>
      )}

      {/* Version Number (Admin only) — dynamic build timestamp */}
      <div className="pt-1 mt-1 border-t border-border/30">
        <span className="text-[10px] text-muted-foreground font-mono opacity-50">
          Build {BUILD_TIME}
        </span>
      </div>
    </div>
  );
};

