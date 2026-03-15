import { useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEBOUNCE_DELAY = 30000; // 30 seconds

// Shared timer across all hook instances
let globalTimer: ReturnType<typeof setTimeout> | null = null;
let syncInProgress = false;

const executeSyncNow = async (): Promise<void> => {
  if (syncInProgress) {
    console.log('Google Calendar sync already in progress, skipping...');
    return;
  }
  
  try {
    syncInProgress = true;
    console.log('Triggering debounced Google Calendar sync...');
    const { error } = await supabase.functions.invoke('sync-google-calendar', {
      body: {},
    });
    
    if (error) {
      console.error('Google Calendar sync error:', error);
    } else {
      console.log('Google Calendar sync triggered successfully');
    }
  } catch (err) {
    console.error('Failed to trigger Google Calendar sync:', err);
  } finally {
    syncInProgress = false;
  }
};

/**
 * Schedules a Google Calendar sync after 30 seconds of inactivity.
 * Each call resets the timer. Safe to call from multiple components.
 */
export const scheduleDebouncedCalendarSync = (): void => {
  if (globalTimer) {
    clearTimeout(globalTimer);
  }
  console.log('Google Calendar sync scheduled in 30s...');
  globalTimer = setTimeout(() => {
    globalTimer = null;
    executeSyncNow();
  }, DEBOUNCE_DELAY);
};

/**
 * Hook that returns a function to schedule a debounced Google Calendar sync.
 */
export const useDebouncedCalendarSync = () => {
  return useCallback(() => {
    scheduleDebouncedCalendarSync();
  }, []);
};

// Keep the original export for manual trigger from the button
export const triggerGoogleCalendarSync = executeSyncNow;
