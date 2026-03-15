import { Receipt } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface InvoicedSummaryProps {
  invoicedAssignments: number;
  totalAssignments: number;
  invoicedNotes: number;
  totalNotes: number;
}

export const InvoicedSummary = ({
  invoicedAssignments,
  totalAssignments,
  invoicedNotes,
  totalNotes,
}: InvoicedSummaryProps) => {
  const pendingAssignments = totalAssignments - invoicedAssignments;
  const pendingNotes = totalNotes - invoicedNotes;
  const totalInvoiced = invoicedAssignments + invoicedNotes;
  const totalPending = pendingAssignments + pendingNotes;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 relative"
          >
            <Receipt className="h-4 w-4" />
            {totalInvoiced > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
                {totalInvoiced}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-56 p-3">
          <p className="font-semibold mb-2 text-sm">Résumé facturation</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Missions facturées:</span>
              <span className="font-medium text-red-600 dark:text-red-400">{invoicedAssignments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Missions en attente:</span>
              <span className="font-medium">{pendingAssignments}</span>
            </div>
            <div className="border-t my-1.5" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notes facturées:</span>
              <span className="font-medium text-red-600 dark:text-red-400">{invoicedNotes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notes en attente:</span>
              <span className="font-medium">{pendingNotes}</span>
            </div>
            <div className="border-t my-1.5" />
            <div className="flex justify-between font-medium">
              <span>Total facturé:</span>
              <span className="text-red-600 dark:text-red-400">{totalInvoiced}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total en attente:</span>
              <span>{totalPending}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
