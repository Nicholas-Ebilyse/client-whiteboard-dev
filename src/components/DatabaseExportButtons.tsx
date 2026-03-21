import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2 } from "lucide-react";

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
  "user_roles",
  "audit_logs",
] as const;

type TableName = typeof TABLES[number];

function toCsvString(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      const str = val === null || val === undefined ? "" : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
      const csv = toCsvString(data as any as Record<string, unknown>[]);
      downloadCsv(`${table}.csv`, csv);
      toast({ title: "Succès", description: `${table}.csv téléchargé (${data.length} lignes)` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
    setLoading(null);
  };

  const exportAll = async () => {
    setLoading("all");
    for (const table of TABLES) {
      try {
        const { data, error } = await supabase.from(table as any).select("*");
        if (error) throw error;
        if (data && data.length > 0) {
          downloadCsv(`${table}.csv`, toCsvString(data as any as Record<string, unknown>[]));
        }
      } catch {
        // skip tables with access errors
      }
    }
    toast({ title: "Succès", description: "Export terminé" });
    setLoading(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export CSV des tables
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
