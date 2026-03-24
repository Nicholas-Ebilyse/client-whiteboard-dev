import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import { supabase } from "@/integrations/supabase/client";
import { Assignment, Note } from "@/types/planning";
import { z } from "zod";

const emailSchema = z.string().email("Email invalide").max(255, "Email trop long");
const noteSchema = z.string().max(1000, "Note trop longue (maximum 1000 caractères)");

interface SAVRecord {
  id: string;
  numero: number;
  nom_client: string;
  adresse: string;
  telephone: string | null;
  probleme: string;
  date: string;
  est_resolu: boolean;
}

interface SendScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekNumber: number;
  year: number;
  technicians: { id: string; name: string; team_id?: string }[];
  teams: { id: string; name: string }[];
  assignments: {
    team_id: string;
    start_date: string;
    end_date: string;
    start_period: string;
    end_period: string;
    commande_id?: string;
    name?: string;
  }[];
  notes: {
    id: string;
    text: string;
    team_id?: string | null;
    start_date: string;
    end_date?: string;
    period?: string;
  }[];
  weekDates: {
    dayName: string;
    fullDate: string;
  }[];

  commandes: {
    id: string;
    client: string;
    chantier?: string;
  }[];
  savRecords: SAVRecord[];
  absences?: {
    technician_id: string;
    start_date: string;
    end_date: string;
    absence_motives?: { name: string };
  }[];
}

export const SendScheduleDialog = ({
  open,
  onOpenChange,
  weekNumber,
  year,
  technicians,
  teams,
  assignments,
  notes,
  weekDates,

  commandes,
  savRecords,
  absences = []
}: SendScheduleDialogProps) => {
  const [email, setEmail] = useState("nicholas@ebilyse.com");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    // Validate email
    try {
      emailSchema.parse(email);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    // Validate note
    if (note) {
      try {
        noteSchema.parse(note);
      } catch (error) {
        if (error instanceof z.ZodError) {
          toast.error(error.errors[0].message);
          return;
        }
      }
    }

    setIsLoading(true);
    try {
      // Refresh the session to ensure we have a valid token
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();

      if (sessionError || !session) {
        console.error("Session refresh failed:", sessionError);
        toast.error("Session expirée. Veuillez vous reconnecter.");
        setIsLoading(false);
        return;
      }

      console.log("Session refreshed successfully, access token present:", !!session.access_token);

      toast.info("Génération du PDF en cours...");

      // Create PDF programmatically
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      // Add title with better formatting
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Planning Hebdomadaire - Semaine ${weekNumber} - ${year}`, pdf.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

      // Build table data
      const tableData: (string | string[])[][] = [];

      teams.forEach((team) => {
        const teamTechs = technicians.filter(t => t.team_id === team.id);
        const row: (string | string[])[] = [team.name];

        weekDates.forEach((dateInfo) => {
          // Assignments for this team and this date
          const dateFull = dateInfo.fullDate;
          
          const teamAssignments = assignments.filter((a) => {
            const assignmentStart = new Date(a.start_date).getTime();
            const assignmentEnd = new Date(a.end_date).getTime();
            const currentDay = new Date(dateFull).getTime();

            return (
              a.team_id === team.id &&
              assignmentStart <= currentDay &&
              assignmentEnd >= currentDay
            );
          });

          const teamNotes = notes.filter(
            (n) => n.team_id === team.id && n.start_date <= dateFull && (!n.end_date || n.end_date >= dateFull)
          );

          const absentTechs = teamTechs.filter((tech) => 
            absences?.some((a) => {
              const absenceStart = new Date(a.start_date).getTime();
              const absenceEnd = new Date(a.end_date).getTime();
              const currentDay = new Date(dateFull).getTime();
              return (
                a.technician_id === tech.id &&
                absenceStart <= currentDay &&
                absenceEnd >= currentDay
              );
            })
          );

          const isTeamAbsent = absentTechs.length > 0;
          const absentTechNames = absentTechs.map(t => t.name).join(', ');

          const formattedAssignments = teamAssignments.map((a) => {
            const commande = commandes.find((c) => c.id === a.commande_id);
            let text = a.name || "";
            if (commande) {
              text = commande.client;
              if (commande.chantier) {
                text += `\n${commande.chantier}`;
              }
            }
            
            // Add tiny indicators for partial days
            const isJustMatin = a.start_date === dateFull && a.start_period === 'Matin' && a.end_date === dateFull && a.end_period === 'Matin';
            const isJustAprem = a.start_date === dateFull && a.start_period === 'Après-midi' && a.end_date === dateFull && a.end_period === 'Après-midi';
            
            if (isJustMatin) return `[Matin]\n${text}`;
            if (isJustAprem) return `[Après-midi]\n${text}`;
            return text;
          });

          const cellContent = [
            ...(isTeamAbsent ? [`ABSENCE ${absentTechNames}`] : []),
            ...formattedAssignments,
            ...teamNotes.map((n) => `Note: ${n.text}`)
          ].filter(Boolean).join('\n\n');

          row.push(cellContent || '-');
        });

        tableData.push(row);
      });

      // Headers corresponding to week dates
      const headRow = [
        'Équipe',
        ...weekDates.map((d) => `${d.dayName} ${new Date(d.fullDate).getDate()}`)
      ];

      // Generate table with improved styling
      autoTable(pdf, {
        head: [headRow],
        body: tableData,
        startY: 25,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 3,
          overflow: 'linebreak',
          valign: 'middle',
          halign: 'left',
        },
        headStyles: {
          fillColor: [66, 135, 245],
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 30, fontStyle: 'bold', halign: 'center' },  // Tech name column
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index >= 1) {
            const cellText = data.cell.text.join(' ');
            if (cellText.includes('ABSENCE')) {
              data.cell.styles.fillColor = [255, 240, 240];
            } else if (cellText.trim() && cellText !== '-') {
              data.cell.styles.fillColor = [240, 248, 255];
            }
          }
        },
        margin: { top: 25, right: 10, bottom: 10, left: 10 },
      });

      // Add note if provided
      if (note) {
        const finalY = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 25;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'italic');
        pdf.text(`Note: ${note}`, 14, finalY + 10);
      }

      const pdfBase64 = pdf.output('datauristring').split(',')[1];

      // Send email via edge function
      console.log("Sending schedule email to:", email.trim());
      const { data, error } = await supabase.functions.invoke('send-schedule-email', {
        body: {
          email: email.trim(),
          note: note.trim(),
          weekNumber,
          year,
          pdfData: pdfBase64
        }
      });

      console.log("Edge function response:", { data, error });

      if (error) {
        console.error("Edge function error:", error);
        if (error.message?.includes('Auth') || error.message?.includes('Unauthorized')) {
          toast.error("Session expirée. Veuillez vous reconnecter.");
          return;
        }
        throw error;
      }

      if (data?.error) {
        console.error("Email sending error:", data.error);
        throw new Error(data.error);
      }

      toast.success("Email envoyé avec succès!");
      setNote("");
      setEmail("nicholas@ebilyse.com");
      onOpenChange(false);
    } catch (error: unknown) {
      const err = error as { message?: string; context?: { status?: number; json: () => Promise<unknown> } };
      console.error("Erreur lors de l'envoi:", error);
      let details = err?.message || "Inconnue";
      if (err?.context) {
        try {
          details += ` (${err.context.status || ""} - ${JSON.stringify(await err.context.json())})`;
        } catch {
          // ignore parsing error
        }
      }
      toast.error(`Erreur d'envoi: ${details}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Envoyer le planning par email</DialogTitle>
          <DialogDescription>
            Planning de la semaine {weekNumber} - {year}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              placeholder="nicholas@ebilyse.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note (optionnelle)</Label>
            <Textarea
              id="note"
              placeholder="Ajoutez une note personnalisée..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isLoading}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Envoyer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
