import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            supabase
              .from('user_roles')
              .select('role, is_suspended')
              .eq('user_id', session.user.id)
              .maybeSingle()
              .then(({ data }) => {
                // If user is suspended, sign them out immediately
                if (data?.is_suspended) {
                  supabase.auth.signOut();
                  setIsAdmin(false);
                  setLoading(false);
                  return;
                }
                
                setIsAdmin(data?.role === 'admin');
                setLoading(false);
              });
          }, 0);
        } else {
          setIsAdmin(false);
          setLoading(false);
        }
      }
    );

    // Set up real-time subscription to user_roles to detect suspension changes
    const roleSubscription = supabase
      .channel('user_roles_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_roles'
        },
        (payload: any) => {
          // Defer Supabase calls to prevent deadlock
          setTimeout(() => {
            supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
              // If current user's suspension status changed, sign them out
              if (currentSession?.user && payload.new.user_id === currentSession.user.id && payload.new.is_suspended) {
                supabase.auth.signOut();
                setSession(null);
                setUser(null);
                setIsAdmin(false);
              }
            });
          }, 0);
        }
      )
      .subscribe();

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const { data } = await supabase
          .from('user_roles')
          .select('role, is_suspended')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        // If user is suspended, sign them out
        if (data?.is_suspended) {
          await supabase.auth.signOut();
          setIsAdmin(false);
          setLoading(false);
          return;
        }
        
        setIsAdmin(data?.role === 'admin');
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      roleSubscription.unsubscribe();
    };
  }, []);

  return { user, session, isAdmin, loading };
};
