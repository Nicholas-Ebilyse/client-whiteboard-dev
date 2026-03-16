import { useState, useMemo } from 'react';
import { SAVRecord, useUpdateSAVResolved } from '@/hooks/useSAV';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wrench, ChevronUp, ChevronDown, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type SortField = 'numero' | 'date' | 'est_resolu' | null;
type SortDirection = 'asc' | 'desc';
type FilterStatus = 'all' | 'resolved' | 'unresolved';

interface SAVTableProps {
  savRecords: SAVRecord[];
  weekStart: string;
  isAbove: boolean;
  onTogglePosition: () => void;
  isAdmin: boolean;
}

export const SAVTable = ({ savRecords, weekStart, isAbove, onTogglePosition, isAdmin }: SAVTableProps) => {
  const updateResolved = useUpdateSAVResolved();
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortField, setSortField] = useState<SortField>('numero');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAndSortedRecords = useMemo(() => {
    let filtered = savRecords;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(r =>
        r.nom_client.toLowerCase().includes(query) ||
        r.probleme.toLowerCase().includes(query)
      );
    }

    if (filterStatus === 'resolved') {
      filtered = filtered.filter(r => r.est_resolu);
    } else if (filterStatus === 'unresolved') {
      filtered = filtered.filter(r => !r.est_resolu);
    }

    if (!sortField) return filtered;

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'numero':
          comparison = a.numero - b.numero;
          break;
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'est_resolu':
          comparison = (a.est_resolu === b.est_resolu) ? 0 : a.est_resolu ? 1 : -1;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [savRecords, sortField, sortDirection, filterStatus, searchQuery]);

  const resolvedCount = savRecords.filter(r => r.est_resolu).length;
  const unresolvedCount = savRecords.filter(r => !r.est_resolu).length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const handleResolvedChange = async (id: string, checked: boolean) => {
    if (!isAdmin) return;

    try {
      await updateResolved.mutateAsync({ id, est_resolu: checked, weekStart });

      try {
        const { error } = await supabase.functions.invoke('update-google-sheets-sav-status', {
          body: { savId: id, estResolu: checked }
        });
        if (error) console.error('Failed to sync with Google Sheets:', error);
      } catch (syncError) {
        console.error('Failed to sync with Google Sheets:', syncError);
      }

      toast.success(checked ? 'SAV marqué comme résolu' : 'SAV marqué comme non résolu');
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const openGoogleMaps = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: '2-digit'
    });
  };

  const formatAddress = (address: string) => address.replace(/,\s*France$/i, '').trim();

  const formatPhone = (phone: string | null) => {
    if (!phone) return { display: '-', full: '-', hasMultiple: false };
    const numbers = phone.split('/').map(n => n.trim());
    return {
      display: numbers.length > 1 ? `${numbers[0]}...` : numbers[0],
      full: phone,
      hasMultiple: numbers.length > 1
    };
  };

  if (savRecords.length === 0) return null;

  return (
    <Card className={cn(
      "w-full shadow-lg border-t-4 border-t-orange-500",
      isAbove ? "mb-4" : "mt-4"
    )}>
      {/* ── Clickable title bar (collapsed by default) ── */}
      <CardHeader
        className="bg-orange-50 dark:bg-orange-950/30 border-b py-2 px-4 cursor-pointer select-none"
        onClick={() => setIsExpanded(prev => !prev)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <Wrench className="h-4 w-4" />
              Service Après-Vente — {unresolvedCount} en cours
              {isExpanded
                ? <ChevronUp className="h-4 w-4 ml-1 opacity-60" />
                : <ChevronDown className="h-4 w-4 ml-1 opacity-60" />}
            </CardTitle>

            {/* Filter tabs — only visible when expanded */}
            {isExpanded && (
              <div
                className="flex items-center gap-1 bg-white/50 dark:bg-black/20 rounded-md p-0.5"
                onClick={e => e.stopPropagation()}
              >
                <Button variant={filterStatus === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterStatus('all')} className="h-6 px-2 text-xs">
                  Tous ({savRecords.length})
                </Button>
                <Button variant={filterStatus === 'unresolved' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterStatus('unresolved')} className="h-6 px-2 text-xs">
                  En cours ({unresolvedCount})
                </Button>
                <Button variant={filterStatus === 'resolved' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterStatus('resolved')} className="h-6 px-2 text-xs">
                  Résolus ({resolvedCount})
                </Button>
              </div>
            )}

            {/* Search — only visible when expanded */}
            {isExpanded && (
              <div className="relative" onClick={e => e.stopPropagation()}>
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 w-40 pl-7 pr-7 text-xs bg-white dark:bg-black/20"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Position toggle button */}
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onTogglePosition(); }}
                  className="h-7 w-7 p-0 hover:bg-orange-100 dark:hover:bg-orange-900/50"
                >
                  {isAbove ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {isAbove ? 'Déplacer en bas' : 'Déplacer en haut'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      {/* ── Table content — only rendered when expanded ── */}
      {isExpanded && (
        <CardContent className="p-0 max-h-[300px] overflow-y-auto">
          <Table className="table-fixed w-full">
            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead className="w-[5%] text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('numero')}>
                  <span className="flex items-center justify-center">N°<SortIcon field="numero" /></span>
                </TableHead>
                <TableHead className="w-[10%]">Client</TableHead>
                <TableHead className="w-[20%]">Adresse</TableHead>
                <TableHead className="w-[10%]">Téléphone</TableHead>
                <TableHead className="w-[40%]">Problème</TableHead>
                <TableHead className="w-[10%] whitespace-nowrap cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('date')}>
                  <span className="flex items-center">Date<SortIcon field="date" /></span>
                </TableHead>
                <TableHead className="w-[5%] text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('est_resolu')}>
                  <span className="flex items-center justify-center">Résolu<SortIcon field="est_resolu" /></span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedRecords.map((record) => (
                <TableRow
                  key={record.id}
                  className={cn("transition-colors", record.est_resolu && "bg-green-50 dark:bg-green-950/20 text-muted-foreground")}
                >
                  <TableCell className="text-center font-medium">{record.numero}</TableCell>
                  <TableCell className="font-medium truncate">
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate cursor-help">{record.nom_client}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top">{record.nom_client}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => openGoogleMaps(record.adresse)}
                            className="text-left hover:text-blue-600 hover:underline flex items-center gap-1 group w-full"
                          >
                            <span className="truncate">{formatAddress(record.adresse)}</span>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[400px]">{formatAddress(record.adresse)}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {(() => {
                      const phone = formatPhone(record.telephone);
                      if (phone.hasMultiple) {
                        return (
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">{phone.display}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top">{phone.full}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      }
                      return phone.display;
                    })()}
                  </TableCell>
                  <TableCell className="overflow-hidden">
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate cursor-help">{record.probleme}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[400px] whitespace-pre-wrap">{record.probleme}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(record.date)}</TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={record.est_resolu}
                      onCheckedChange={(checked) => handleResolvedChange(record.id, checked as boolean)}
                      disabled={!isAdmin || updateResolved.isPending}
                      className={cn(
                        "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600",
                        !isAdmin && "cursor-not-allowed opacity-50"
                      )}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
};