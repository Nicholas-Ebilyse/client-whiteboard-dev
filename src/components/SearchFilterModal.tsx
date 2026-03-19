import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Commande {
  id: string;
  client: string;
  chantier: string;
}

interface Assignment {
  id: string;
  team_id: string | null;
  commande_id: string | null;
  start_date: string;
  end_date: string;
  comment?: string | null;
}

interface Team {
  id: string;
  name: string;
  color: string;
}

interface SearchFilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commandes: Commande[];
  assignments: Assignment[];
  teams: Team[];
}

type SearchMode = 'client' | 'chantier' | 'team';

interface ResultRow {
  assignmentId: string;
  client: string;
  chantier: string;
  teamName: string;
  startDate: string;
  endDate: string;
  comment?: string | null;
}

export const SearchFilterModal = ({
  open,
  onOpenChange,
  commandes,
  assignments,
  teams,
}: SearchFilterModalProps) => {
  const [searchMode, setSearchMode] = useState<SearchMode>('client');
  const [query, setQuery] = useState('');

  const results = useMemo<ResultRow[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return assignments
      .filter((a) => {
        const commande = commandes.find((c) => c.id === a.commande_id);
        const team = teams.find((t) => t.id === a.team_id);

        if (searchMode === 'client') {
          return commande?.client?.toLowerCase().includes(q);
        }
        if (searchMode === 'chantier') {
          return commande?.chantier?.toLowerCase().includes(q);
        }
        if (searchMode === 'team') {
          return team?.name?.toLowerCase().includes(q);
        }
        return false;
      })
      .map((a) => {
        const commande = commandes.find((c) => c.id === a.commande_id);
        const team = teams.find((t) => t.id === a.team_id);
        return {
          assignmentId: a.id,
          client: commande?.client ?? '—',
          chantier: commande?.chantier ?? '—',
          teamName: team?.name ?? '—',
          startDate: a.start_date,
          endDate: a.end_date,
          comment: a.comment,
        };
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [query, searchMode, assignments, commandes, teams]);

  const formatDate = (d: string) => {
    try {
      return format(new Date(d), 'dd MMM yyyy', { locale: fr });
    } catch {
      return d;
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-4 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Search className="h-5 w-5" />
            Recherche &amp; Filtres
          </DialogTitle>
        </DialogHeader>

        {/* Search controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="space-y-1 w-full sm:w-40 flex-shrink-0">
            <Label className="text-xs text-muted-foreground">Rechercher par</Label>
            <Select value={searchMode} onValueChange={(v) => { setSearchMode(v as SearchMode); setQuery(''); }}>
              <SelectTrigger className="bg-background h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="chantier">Chantier</SelectItem>
                <SelectItem value="team">Équipe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 flex-1">
            <Label className="text-xs text-muted-foreground">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder={
                  searchMode === 'client' ? 'Nom du client…'
                  : searchMode === 'chantier' ? 'Adresse / chantier…'
                  : 'Nom de l\'équipe…'
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 bg-background h-9"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7"
                  onClick={() => setQuery('')}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto border rounded-lg min-h-[200px]">
          {!query.trim() ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              Saisissez un terme de recherche…
            </div>
          ) : results.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              Aucun résultat pour « {query} »
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Client</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Chantier</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Équipe</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Période</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Commentaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((r) => (
                  <tr key={r.assignmentId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-medium truncate max-w-[120px]">{r.client}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[150px]">{r.chantier.split(',')[0]}</td>
                    <td className="px-3 py-2">{r.teamName}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(r.startDate)}
                      {r.endDate !== r.startDate && ` → ${formatDate(r.endDate)}`}
                    </td>
                    <td className="px-3 py-2 text-xs italic text-muted-foreground truncate max-w-[120px]">
                      {r.comment ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {results.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {results.length} affectation{results.length > 1 ? 's' : ''} trouvée{results.length > 1 ? 's' : ''}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
