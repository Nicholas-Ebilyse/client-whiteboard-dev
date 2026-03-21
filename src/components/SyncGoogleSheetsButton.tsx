import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sheet, Upload, Download, Loader2, Info } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export const SyncGoogleSheetsButton = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<"import" | "export" | null>(null);
  const { data: syncStatus } = useSyncStatus("google_sheets");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const extractError = async (error: any): Promise<string> => {
    let msg = error.message || "Une erreur s'est produite";
    if (error && "context" in error && typeof error.context?.json === "function") {
      try {
        const body = await error.context.clone().json();
        if (body?.error) msg = body.error;
        else if (body?.message) msg = body.message;
      } catch {
        try {
          const text = await error.context.clone().text();
          if (text) msg = text;
        } catch {}
      }
    }
    return msg;
  };

  const handleSync = async () => {
    setLoading("import");
    try {
      const { data, error } = await supabase.functions.invoke("sync-google-sheets");
      if (error) throw error;

      const c = data?.counts || {};
      toast({
        title: "Import réussi",
        description: `${c.techniciens || 0} techniciens, ${c.commandes || 0} commandes, ${c.sav || 0} SAV, ${c.affectations || 0} affectations, ${c.absences || 0} absences, ${c.notes || 0} notes importés.`,
      });

      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["sav"] });

      queryClient.invalidateQueries({ queryKey: ["sync-status"] });

      setOpen(false);
    } catch (error: any) {
      toast({ title: "Erreur de synchronisation", description: await extractError(error), variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleExport = async () => {
    setLoading("export");
    try {
      const { data, error } = await supabase.functions.invoke("export-to-sheets");
      if (error) throw error;

      const c = data?.counts || {};
      toast({
        title: "Export réussi",
        description: `${c.techniciens || 0} techniciens, ${c.commandes || 0} commandes, ${c.sav || 0} SAV, ${c.affectations || 0} affectations, ${c.notes || 0} notes exportés.`,
      });

      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['sync-statuses-all'] });

      setOpen(false);
    } catch (error: any) {
      toast({ title: "Erreur d'export", description: await extractError(error), variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sheet className="h-4 w-4 mr-2" />
          Synchronisation base de données
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Google Sheets · Synchronisation</DialogTitle>
          <DialogDescription>
            Synchronisez manuellement les données entre l'application et la base Google Sheets.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {syncStatus && (
            <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>
                Dernier transfert : {formatDistanceToNow(new Date(syncStatus.completed_at || syncStatus.started_at), { addSuffix: true, locale: fr })}
                {syncStatus.status === 'error' && (
                  <span className="text-destructive ml-1.5 font-medium">(Échec)</span>
                )}
              </span>
            </div>
          )}

          <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              <div>
                <p className="font-semibold text-foreground">Importer</p>
                <p className="text-xs">Charge les données depuis Google Sheets vers l'application.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <div>
                <p className="font-semibold text-foreground">Exporter</p>
                <p className="text-xs">Sauvegarde l'intégralité des tables vers votre Google Sheet.</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading !== null}>
            Annuler
          </Button>
          <Button variant="outline" onClick={handleSync} disabled={loading !== null}>
            {loading === "import" ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Import…</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" />Importer depuis Sheets</>
            )}
          </Button>
          <Button onClick={handleExport} disabled={loading !== null}>
            {loading === "export" ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Export…</>
            ) : (
              <><Download className="h-4 w-4 mr-2" />Exporter vers Sheets</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
