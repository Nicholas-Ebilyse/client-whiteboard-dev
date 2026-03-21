import { useAllSyncStatuses } from "@/hooks/useSyncStatus";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, AlertCircle, Loader2, Database, Calendar } from "lucide-react";

// Build timestamp injected by Vite at build time, or falls back to current time in dev mode
const BUILD_TIME: string = typeof __BUILD_TIME__ !== 'undefined'
  ? __BUILD_TIME__ as string
  : new Date().toISOString().replace('T', ' ').slice(0, 16);

const STALE_RUNNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

type SyncRecord = {
  status?: string;
  started_at?: string;
  completed_at?: string | null;
  records_synced?: number;
} | null | undefined;

export const SyncStatusDisplay = () => {
  const { data: syncStatuses } = useAllSyncStatuses();

  // A 'running' record older than 5 minutes is considered stale (function likely crashed)
  const isStaleRunning = (status: string | undefined, startedAt: string | undefined) => {
    if (status !== 'running' || !startedAt) return false;
    return Date.now() - new Date(startedAt).getTime() > STALE_RUNNING_THRESHOLD_MS;
  };

  const formatSyncTime = (record: SyncRecord) => {
    if (!record) return null;
    // Prefer completed_at if available, fall back to started_at
    const timeStr = record.completed_at || record.started_at;
    if (!timeStr) return null;
    return formatDistanceToNow(new Date(timeStr), { addSuffix: true, locale: fr });
  };

  const getStatusIcon = (status: string | undefined, startedAt?: string) => {
    if (!status) return null;
    if (isStaleRunning(status, startedAt)) {
      return <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />;
    }
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

  // Use whichever sync record is more recent between 'sheets' and 'database' types
  const sheetsRecord = syncStatuses?.sheets;
  const dbRecord = syncStatuses?.database;
  const dataRecord: SyncRecord = (() => {
    if (!sheetsRecord && !dbRecord) return null;
    if (!sheetsRecord) return dbRecord;
    if (!dbRecord) return sheetsRecord;
    const sheetsTime = new Date(sheetsRecord.started_at).getTime();
    const dbTime = new Date(dbRecord.started_at).getTime();
    return sheetsTime > dbTime ? sheetsRecord : dbRecord;
  })();

  const dataStatus = dataRecord?.status;
  const dataIsStale = isStaleRunning(dataStatus, dataRecord?.started_at);
  const dataIsRunning = dataStatus === 'running' && !dataIsStale;

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {/* Database/Sheets sync status */}
      {dataRecord && (
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          {getStatusIcon(dataStatus, dataRecord.started_at)}
          <span className={dataStatus === 'error' ? 'text-destructive' : dataIsStale ? 'text-amber-600' : 'text-muted-foreground'}>
            {dataIsRunning ? (
              'Sync Données en cours...'
            ) : (
              <>
                Données : {formatSyncTime(dataRecord)}
                {(dataRecord.records_synced || 0) > 0 && ` (${dataRecord.records_synced} lig.)`}
              </>
            )}
          </span>
        </div>
      )}

      {/* Calendar sync status */}
      {syncStatuses?.calendar && (
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          {getStatusIcon(syncStatuses.calendar.status, syncStatuses.calendar.started_at)}
          <span className={syncStatuses.calendar.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
            {syncStatuses.calendar.status === 'running' && !isStaleRunning(syncStatuses.calendar.status, syncStatuses.calendar.started_at) ? (
              'Sync Agenda en cours...'
            ) : syncStatuses.calendar.status === 'error' ? (
              `Erreur Agenda ${formatSyncTime(syncStatuses.calendar)}`
            ) : (
              <>
                Agenda : {formatSyncTime(syncStatuses.calendar)}
                {(syncStatuses.calendar.records_synced || 0) > 0 && ` (${syncStatuses.calendar.records_synced} évén.)`}
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
