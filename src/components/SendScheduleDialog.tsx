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
  technicians: any[];
  assignments: any[];
  notes: any[];
  weekDates: any[];

  commandes: any[];
  savRecords: SAVRecord[];
  absences?: any[];
}

export const SendScheduleDialog = ({
  open,
  onOpenChange,
  weekNumber,
  year,
  technicians,
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

      // Build table data - Issue #11: Don't repeat date for both periods
      const periods = ['Matin', 'Après-midi'];
      const tableData: any[] = [];
      let lastDateAdded = '';

      weekDates.forEach((dateInfo: any) => {
        periods.forEach((period, periodIndex) => {
          // Extract day number from the date
          const dayNumber = new Date(dateInfo.fullDate).getDate();
          const dateString = `${dateInfo.dayName} ${dayNumber}`;

          const row: any[] = [
            // Issue #11: Only show date on first period (Matin)
            periodIndex === 0 ? dateString : '',
            period
          ];

          technicians.forEach((tech: any) => {
            const techAssignments = assignments.filter(
              (a: any) =>
                a.technician_id === tech.id &&
                new Date(a.start_date) <= new Date(dateInfo.fullDate) &&
                new Date(a.end_date) >= new Date(dateInfo.fullDate) &&
                (a.start_date !== dateInfo.fullDate || a.start_period === period || a.start_period === 'Matin') &&
                (a.end_date !== dateInfo.fullDate || a.end_period === period || a.end_period === 'Après-midi')
            );

            const techNotes = notes.filter(
              (n: any) => n.technician_id === tech.id && n.start_date === dateInfo.fullDate && n.period === period
            );

            const isTechAbsent = absences.some(
              (a: any) =>
                a.technician_id === tech.id &&
                new Date(a.start_date) <= new Date(dateInfo.fullDate) &&
                new Date(a.end_date) >= new Date(dateInfo.fullDate)
            );

            const absenceReason = absences.find(
              (a: any) =>
                a.technician_id === tech.id &&
                new Date(a.start_date) <= new Date(dateInfo.fullDate) &&
                new Date(a.end_date) >= new Date(dateInfo.fullDate)
            )?.absence_motives?.name;

            const cellContent = [
              ...(isTechAbsent ? [`ABSENCE${absenceReason ? ' - ' + absenceReason : ''}`] : []),
              ...techAssignments.map((a: any) => {
                // Use commandes.chantier field for address
                const commande = commandes.find((c: any) => c.id === a.commande_id);
                if (commande) {
                  // Show client on first line, address on second line without "Adresse:" prefix
                  let text = commande.client;
                  if (commande.chantier) {
                    text += `\n${commande.chantier}`;
                  }
                  return text;
                }
                return a.name;
              }),
              ...techNotes.map((n: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                return 'Note: ' + n.text;
              })
            ].join('\n\n');

            row.push(cellContent || '-');
          });

          tableData.push(row);
        });
      });

      // Generate table with improved styling
      autoTable(pdf, {
        head: [['Date', 'Période', ...technicians.map((t: any) => t.name)]],
        body: tableData,
        startY: 25,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 3,
          overflow: 'linebreak',
          valign: 'middle',
          halign: 'left',
        },
        headStyles: {
          fillColor: [66, 135, 245],
          textColor: 255,
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 35, fontStyle: 'bold' },  // Issue #6: Increased width for Date column
          1: { cellWidth: 35, halign: 'center' },    // Issue #6: Increased width for Periode column
        },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index >= 2) {
            const cellText = data.cell.text.join(' ');
            if (cellText.includes('ABSENCE')) {
              data.cell.styles.fillColor = [255, 240, 240];
            } else if (cellText.includes('SAV')) {
              data.cell.styles.fillColor = [255, 250, 205];
            } else if (cellText.trim() && cellText !== '-') {
              data.cell.styles.fillColor = [240, 248, 255];
            }
          }
        },
        margin: { top: 25, right: 10, bottom: 10, left: 10 },
      });

      // Add SAV table if there are records
      if (savRecords && savRecords.length > 0) {
        const planningFinalY = (pdf as any).lastAutoTable.finalY || 25;

        // Add SAV section title
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Service Après-Vente', 14, planningFinalY + 15);

        // Helper to format date in French
        const formatDate = (dateStr: string) => {
          const date = new Date(dateStr);
          return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: '2-digit'
          });
        };

        // Helper to remove ", France" from address
        const formatAddress = (address: string) => {
          return address.replace(/,\s*France$/i, '').trim();
        };

        // Build SAV table data
        const savTableData = savRecords.map(record => [
          record.numero.toString(),
          record.nom_client,
          formatAddress(record.adresse),
          record.telephone || '-',
          record.probleme,
          formatDate(record.date),
          record.est_resolu ? 'Oui' : 'Non'
        ]);

        autoTable(pdf, {
          head: [['N°', 'Client', 'Adresse', 'Téléphone', 'Problème', 'Date', 'Résolu']],
          body: savTableData,
          startY: planningFinalY + 20,
          theme: 'grid',
          styles: {
            fontSize: 8,
            cellPadding: 2,
            overflow: 'linebreak',
            valign: 'top',
            halign: 'left',
          },
          headStyles: {
            fillColor: [249, 115, 22], // Orange color matching SAV theme
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center',
          },
          columnStyles: {
            0: { cellWidth: 12, halign: 'center' },   // N°
            1: { cellWidth: 30 },                      // Client
            2: { cellWidth: 50 },                      // Adresse (wider for full address)
            3: { cellWidth: 25 },                      // Téléphone
            4: { cellWidth: 90 },                      // Problème (widest for description)
            5: { cellWidth: 22, halign: 'center' },   // Date
            6: { cellWidth: 15, halign: 'center' },   // Résolu
          },
          didParseCell: (data: any) => {
            if (data.section === 'body') {
              // Color resolved rows in green
              const isResolved = data.row.raw[6] === 'Oui';
              if (isResolved) {
                data.cell.styles.fillColor = [220, 252, 231]; // Light green
                data.cell.styles.textColor = [100, 100, 100];
              }
            }
          },
          margin: { top: 10, right: 10, bottom: 10, left: 10 },
        });
      }

      // Add note if provided
      if (note) {
        const finalY = (pdf as any).lastAutoTable.finalY || 25;
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
    } catch (error: any) {
      console.error("Erreur lors de l'envoi:", error);
      toast.error(`Erreur d'envoi: ${error?.message || "Inconnue"}`);
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
