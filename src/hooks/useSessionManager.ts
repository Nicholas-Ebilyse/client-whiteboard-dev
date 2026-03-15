import { useEffect, useState, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const SESSION_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
const SESSION_WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

interface UseSessionManagerReturn {
  sessionExpiringSoon: boolean;
  timeUntilExpiry: number | null;
  refreshSession: () => Promise<boolean>;
}

export const useSessionManager = (session: Session | null): UseSessionManagerReturn => {
  const [sessionExpiringSoon, setSessionExpiringSoon] = useState(false);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const expiryCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Session refresh failed:', error);
        return false;
      }
      console.log('Session refreshed successfully');
      setSessionExpiringSoon(false);
      return true;
    } catch (error) {
      console.error('Session refresh error:', error);
      return false;
    }
  }, []);

  const checkSessionExpiry = useCallback(() => {
    if (!session?.expires_at) {
      setSessionExpiringSoon(false);
      setTimeUntilExpiry(null);
      return;
    }

    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const remaining = expiresAt - now;

    setTimeUntilExpiry(remaining);

    if (remaining <= SESSION_WARNING_THRESHOLD && remaining > 0) {
      setSessionExpiringSoon(true);
    } else {
      setSessionExpiringSoon(false);
    }

    // Auto-refresh if we're in the warning zone
    if (remaining <= SESSION_WARNING_THRESHOLD && remaining > 0) {
      refreshSession();
    }
  }, [session, refreshSession]);

  // Set up automatic session refresh
  useEffect(() => {
    if (!session) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      if (expiryCheckIntervalRef.current) {
        clearInterval(expiryCheckIntervalRef.current);
        expiryCheckIntervalRef.current = null;
      }
      return;
    }

    // Refresh session periodically
    refreshIntervalRef.current = setInterval(() => {
      refreshSession();
    }, SESSION_REFRESH_INTERVAL);

    // Check expiry more frequently
    expiryCheckIntervalRef.current = setInterval(() => {
      checkSessionExpiry();
    }, 30 * 1000); // Check every 30 seconds

    // Initial check
    checkSessionExpiry();

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (expiryCheckIntervalRef.current) {
        clearInterval(expiryCheckIntervalRef.current);
      }
    };
  }, [session, refreshSession, checkSessionExpiry]);

  return {
    sessionExpiringSoon,
    timeUntilExpiry,
    refreshSession,
  };
};
