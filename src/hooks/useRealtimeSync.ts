import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useRealtimeSync = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // 1. Create the channel object first
    const channel = supabase.channel('planning-realtime');

    // 2. Attach listeners sequentially (DO NOT chain them)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'assignments' },
      () => {
        console.log('🔄 Realtime update detected: assignments');
        queryClient.invalidateQueries({ queryKey: ['assignments'] });
      }
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notes' },
      () => {
        console.log('🔄 Realtime update detected: notes');
        queryClient.invalidateQueries({ queryKey: ['notes'] });
      }
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'absences' },
      () => {
        console.log('🔄 Realtime update detected: absences');
        queryClient.invalidateQueries({ queryKey: ['absences'] });
      }
    );

    // 3. Finally, subscribe to the channel
    channel.subscribe();

    // 4. Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};