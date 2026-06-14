import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { format } from "date-fns";

const TABLES = [
  "technicians",
  "assignments",
  "commandes",
  "notes",
  "absences",
  "sav",
  "week_config",
  "app_settings",
  "sync_status",
  "user_roles"
] as const;

type TableName = typeof TABLES[number];

export function DatabaseExportButtons() {
  const { toast } = useToast();
  const [loading, setLoading] = useState<TableName | "all" | null>(null);

  const exportTable = async (table: TableName) => {
    setLoading(table);
    try {
      const { data, error } = await supabase.from(table as any).select("*");
      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast({ title: "Info", description: `La table ${table} est vide.` });
        setLoading(null);
        return;
      }

      // 1. Create a worksheet from the JSON data
      const worksheet = XLSX.utils.json_to_sheet(data);
      
      // 2. Create a new workbook and append the worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, table.substring(0, 31)); // Max 31 chars for Excel tabs

      // 3. Trigger the file download
      XLSX.writeFile(workbook, `Export_${table}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      
      toast({ title: "Succès", description: `Fichier Excel téléchargé (${data.length} lignes)` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
    setLoading(null);
  };

  const exportAll = async () => {
    setLoading("all");
    const workbook = XLSX.utils.book_new();
    let hasData = false;

    for (const table of TABLES) {
      try {
        const { data, error } = await supabase.from(table as any).select("*");
        if (error) throw error;
        
        if (data && data.length > 0) {
          const worksheet = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(workbook, worksheet, table.substring(0, 31));
          hasData = true;
        }
      } catch {
        // skip tables with access errors
      }
    }

    if (hasData) {
      XLSX.writeFile(workbook, `Export_Complet_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast({ title: "Succès", description: "Export complet terminé" });
    } else {
      toast({ title: "Info", description: "Aucune donnée à exporter." });
    }
    
    setLoading(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Excel des tables
          </span>
          <Button onClick={exportAll} disabled={!!loading}>
            {loading === "all" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Tout exporter
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {TABLES.map((table) => (
            <Button
              key={table}
              variant="outline"
              size="sm"
              onClick={() => exportTable(table)}
              disabled={!!loading}
            >
              {loading === table ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
              {table}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}