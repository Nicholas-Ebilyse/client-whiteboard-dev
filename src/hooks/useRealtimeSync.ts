import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useRealtimeSync = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // We create a single WebSocket channel to listen to multiple tables
    const channel = supabase.channel('planning-realtime')
      // Listen for any change (INSERT, UPDATE, DELETE) on the assignments table
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assignments' },
        () => {
          console.log('🔄 Realtime update detected: assignments');
          queryClient.invalidateQueries({ queryKey: ['assignments'] });
        }
      )
      // Listen for notes changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        () => {
          console.log('🔄 Realtime update detected: notes');
          queryClient.invalidateQueries({ queryKey: ['notes'] });
        }
      )
      // Listen for absences changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'absences' },
        () => {
          console.log('🔄 Realtime update detected: absences');
          queryClient.invalidateQueries({ queryKey: ['absences'] });
        }
      )
      .subscribe();

    // Cleanup function when the component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};