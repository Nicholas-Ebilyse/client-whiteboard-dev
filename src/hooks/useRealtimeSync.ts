import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useRealtimeSync = () => {
  const queryClient = useQueryClient();
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    const triggerDebouncedInvalidate = (queryKey: string) => {
      if (debounceTimers.current[queryKey]) {
        clearTimeout(debounceTimers.current[queryKey]);
      }
      debounceTimers.current[queryKey] = setTimeout(() => {
        console.log(`🔄 Realtime coalesced invalidation: ${queryKey}`);
        queryClient.invalidateQueries({ queryKey: [queryKey] });
        delete debounceTimers.current[queryKey];
      }, 200);
    };

    // 1. Create the channel object first
    const channel = supabase.channel('planning-realtime');

    // 2. Attach listeners sequentially (DO NOT chain them)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'assignments' },
      () => triggerDebouncedInvalidate('assignments')
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'daily_team_rosters' },
      () => triggerDebouncedInvalidate('dailyTeamRosters')
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notes' },
      () => triggerDebouncedInvalidate('notes')
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'absences' },
      () => triggerDebouncedInvalidate('absences')
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'technicians' },
      () => triggerDebouncedInvalidate('technicians')
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'teams' },
      () => triggerDebouncedInvalidate('teams')
    );

    // 3. Subscribe to the channel
    channel.subscribe();

    // 4. Cleanup on unmount
    return () => {
      Object.values(debounceTimers.current).forEach(t => clearTimeout(t));
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
