import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface SyncGoogleCalendarButtonProps {
  onSyncComplete?: () => void;
}

export const SyncGoogleCalendarButton = ({ onSyncComplete }: SyncGoogleCalendarButtonProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log("[Diagnostics] Initiating sync-google-calendar. Session valid:", !!session);
      
      // Uses the default group calendar configured in the edge function
      const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
        body: {},
      });

      if (error) throw error;

      toast({
        title: "Synchronisation réussie",
        description: `${data.eventsCreated || 0} événements et ${data.notesCreated || 0} notes synchronisés avec Google Agenda.`,
      });

      // Refresh sync status queries
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['sync-statuses-all'] });

      onSyncComplete?.();
    } catch (error: any) {
      console.error('Google Calendar sync error:', error);
      let errorMessage = error.message || "Une erreur s'est produite lors de la synchronisation";
      
      // Extract specific error message from Supabase Edge Function non-2xx response
      if (error && 'context' in error && typeof error.context?.json === 'function') {
        try {
          const clone = error.context.clone();
          const body = await clone.json();
          if (body && body.error) {
            errorMessage = body.error;
          } else if (body && body.message) {
            errorMessage = body.message;
          } else {
            errorMessage = `Erreur brute: ${JSON.stringify(body)}`;
          }
        } catch (e) {
          // Fallback to text if JSON fails
          try {
            const clone = error.context.clone();
            const text = await clone.text();
            if (text) errorMessage = `Erreur texte: ${text}`;
          } catch (e2) {}
        }
      }

      toast({
        title: "Erreur de synchronisation",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Synchronisation...
        </>
      ) : (
        <>
          <Calendar className="h-4 w-4 mr-2" />
          Synchronisation Google Agenda
        </>
      )}
    </Button>
  );
};
