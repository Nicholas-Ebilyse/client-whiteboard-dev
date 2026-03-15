import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SessionExpiryWarningProps {
  timeUntilExpiry: number | null;
  onRefresh: () => Promise<boolean>;
  isRefreshing?: boolean;
}

export const SessionExpiryWarning = ({ 
  timeUntilExpiry, 
  onRefresh,
  isRefreshing = false 
}: SessionExpiryWarningProps) => {
  if (!timeUntilExpiry || timeUntilExpiry <= 0) return null;

  const minutes = Math.floor(timeUntilExpiry / 60000);
  const seconds = Math.floor((timeUntilExpiry % 60000) / 1000);

  const handleRefresh = async () => {
    await onRefresh();
  };

  return (
    <Alert 
      variant="destructive" 
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-auto max-w-md shadow-lg animate-in fade-in slide-in-from-top-2"
    >
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center gap-3">
        <span>
          Session expire dans {minutes > 0 ? `${minutes}m ` : ''}{seconds}s
        </span>
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-7 px-2 text-xs"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          Prolonger
        </Button>
      </AlertDescription>
    </Alert>
  );
};
