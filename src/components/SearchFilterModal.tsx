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

interface Note {
  id: string;
  team_id: string | null;
  text: string;
  start_date: string;
  end_date?: string | null;
}

interface SearchFilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commandes: Commande[];
  assignments: Assignment[];
  teams: Team[];
  notes?: Note[];
}

type SearchMode = 'tous' | 'client' | 'chantier' | 'team' | 'note';

interface ResultRow {
  id: string;
  type: 'assignment' | 'note';
  client: string;
  chantier: string;
  teamName: string;
  startDate: string;
  endDate: string;
  comment?: string | null;
}

const normalizeSearch = (str: string | null | undefined) => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export const SearchFilterModal = ({
  open,
  onOpenChange,
  commandes,
  assignments,
  teams,
  notes = [],
}: SearchFilterModalProps) => {
  const [searchMode, setSearchMode] = useState<SearchMode>('tous');
  const [query, setQuery] = useState('');

  const results = useMemo<ResultRow[]>(() => {
    const q = normalizeSearch(query.trim());
    if (!q) return [];

    const assignmentResults: ResultRow[] = assignments
      .filter((a) => {
        const commande = commandes.find((c) => c.id === a.commande_id);
        const team = teams.find((t) => t.id === a.team_id);
        
        const normClient = normalizeSearch(commande?.client);
        const normChantier = normalizeSearch(commande?.chantier);
        const normTeam = normalizeSearch(team?.name);
        const normComment = normalizeSearch(a.comment);

        if (searchMode === 'client') return normClient.includes(q);
        if (searchMode === 'chantier') return normChantier.includes(q);
        if (searchMode === 'team') return normTeam.includes(q);
        if (searchMode === 'tous') {
          return normClient.includes(q) || normChantier.includes(q) || normTeam.includes(q) || normComment.includes(q);
        }
        return false;
      })
      .map((a) => {
        const commande = commandes.find((c) => c.id === a.commande_id);
        const team = teams.find((t) => t.id === a.team_id);
        return {
          id: a.id,
          type: 'assignment',
          client: commande?.client ?? '—',
          chantier: commande?.chantier ?? '—',
          teamName: team?.name ?? '—',
          startDate: a.start_date,
          endDate: a.end_date,
          comment: a.comment,
        };
      });

    const noteResults: ResultRow[] = (searchMode === 'tous' || searchMode === 'note')
      ? notes
        .filter((n) => {
          const normText = normalizeSearch(n.text);
          const team = n.team_id ? teams.find((t) => t.id === n.team_id) : null;
          const normTeam = normalizeSearch(team?.name);
          
          if (searchMode === 'note') return normText.includes(q);
          if (searchMode === 'tous') return normText.includes(q) || normTeam.includes(q);
          return false;
        })
        .map((n) => {
          const team = n.team_id ? teams.find((t) => t.id === n.team_id) : null;
          return {
            id: n.id,
            type: 'note',
            client: '— (Note)',
            chantier: '—',
            teamName: team?.name ?? 'Générale',
            startDate: n.start_date,
            endDate: n.end_date || n.start_date,
            comment: n.text,
          };
        })
      : [];

    return [...assignmentResults, ...noteResults]
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [query, searchMode, assignments, commandes, teams, notes]);

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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-4 bg-card">
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
                <SelectItem value="tous">Tous</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="chantier">Chantier</SelectItem>
                <SelectItem value="team">Équipe</SelectItem>
                <SelectItem value="note">Note</SelectItem>
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
                  searchMode === 'tous' ? 'Recherchez tout (clients, chantiers, notes)...'
                  : searchMode === 'client' ? 'Nom du client…'
                  : searchMode === 'chantier' ? 'Adresse / chantier…'
                  : searchMode === 'note' ? 'Contenu de la note…'
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
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Détail / Commentaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((r) => (
                  <tr key={`${r.type}-${r.id}`} className={`hover:bg-muted/30 transition-colors ${r.type === 'note' ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                    <td className="px-3 py-2 font-medium truncate max-w-[120px]">{r.client}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[150px]">{r.chantier.split(',')[0]}</td>
                    <td className="px-3 py-2">{r.teamName}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(r.startDate)}
                      {r.endDate !== r.startDate && ` → ${formatDate(r.endDate)}`}
                    </td>
                    <td className="px-3 py-2 text-xs italic text-muted-foreground truncate max-w-[200px]">
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
            {results.length} résultat{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
