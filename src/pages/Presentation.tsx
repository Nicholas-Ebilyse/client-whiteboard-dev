import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { WeeklyGrid } from '@/components/planning/WeeklyGrid';
import { 
  useWeekConfig, 
  useTechnicians, 
  useTeams, 
  useCommandes, 
  useAssignments, 
  useNotes, 
  useAbsences,
  getWeekDates
} from '@/hooks/usePlanning';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { startOfWeek, format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Assignment } from '@/types/planning';

const DEFAULT_TIMEOUT_MINUTES = 30;

const Presentation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, loading } = useAuth();
  
  const timeoutMinutes = parseInt(searchParams.get('timeout') || '0', 10) || DEFAULT_TIMEOUT_MINUTES;
  const timeoutMs = timeoutMinutes * 60 * 1000;

  // Auto-redirect back to index after timeout
  const [timeLeft, setTimeLeft] = useState(timeoutMs);

  useEffect(() => {
    // Wait until auth check is complete before redirecting
    if (loading) return;
    if (!session) {
      navigate('/auth');
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          clearInterval(timer);
          navigate('/');
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, session, loading]);

  const formatTimeLeft = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Data fetching
  const { data: weekConfig, isLoading: isConfigLoading } = useWeekConfig();
  const { data: technicians = [], isLoading: isTechLoading } = useTechnicians(true);
  const { data: teams = [], isLoading: isTeamsLoading } = useTeams();
  const { data: commandes = [], isLoading: isCommandesLoading } = useCommandes();
  const { data: chantiers = [], isLoading: isChantiersLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*');
      if (error) throw error;
      return data;
    }
  });

  const weekDates = weekConfig ? getWeekDates(weekConfig.week_number, weekConfig.year) : [];
  const weekStartStr = weekDates[0]?.fullDate;
  const weekEndStr = weekDates[4]?.fullDate;

  const { data: assignments = [], isLoading: isAssignmentsLoading } = useAssignments(weekStartStr, weekEndStr);
  const { data: notes = [], isLoading: isNotesLoading } = useNotes(weekStartStr, weekEndStr);
  
  const isPlanningLoading = isConfigLoading || isTechLoading || isTeamsLoading || isCommandesLoading || isChantiersLoading || isAssignmentsLoading || isNotesLoading;

  const { data: absences = [], isLoading: isAbsencesLoading } = useAbsences(weekStartStr, weekEndStr);

  if (isPlanningLoading || isAbsencesLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Format absences into assignments so they show up on the grid
  const absenceAssignments: Assignment[] = absences.map(absence => ({
    id: `absence-${absence.id}`,
    teamId: absence.technician_id,
    technicianId: absence.technician_id,
    chantierId: null,
    commandeId: null,
    name: 'Absent',
    startDate: absence.start_date,
    endDate: absence.end_date,
    isFixed: true, // Fixed so they can't be moved (even if we had drag enabled)
    isValid: true,
    isAbsent: true,
    absence_reason: absence.reason
  }));

  const allDisplayedAssignments = [...assignments, ...absenceAssignments];
  
  const allAssignmentsFormatted: Assignment[] = allDisplayedAssignments.map(dbAssignment => ({
    id: dbAssignment.id,
    teamId: dbAssignment.team_id ?? dbAssignment.technician_id,
    technicianId: dbAssignment.technician_id,
    chantierId: dbAssignment.chantier_id,
    commandeId: dbAssignment.commande_id,
    name: dbAssignment.name,
    startDate: dbAssignment.startDate || dbAssignment.start_date,
    endDate: dbAssignment.endDate || dbAssignment.end_date,
    isFixed: dbAssignment.isFixed ?? dbAssignment.is_fixed ?? false,
    isValid: true,
    comment: dbAssignment.comment || undefined,
    isAbsent: dbAssignment.isAbsent || dbAssignment.is_absent || false,
    isConfirmed: dbAssignment.isConfirmed ?? dbAssignment.is_confirmed ?? false,
    assignment_group_id: dbAssignment.assignment_group_id,
    absence_reason: dbAssignment.absence_reason,
  }));

  const activeTechnicians = technicians.filter(t => !t.is_archived);
  
  // For the grid view, we loop over Teams. If a team has techs, they display underneath.
  const displayTeams = teams.filter(t => activeTechnicians.some(tech => tech.team_id === t.id));

  const getGeneralNotesForDate = (date: string) => {
    return notes.filter(n => {
      if (n.technician_id !== null) return false;
      return date >= n.start_date && date <= (n.end_date || n.start_date);
    });
  };

  const getAssignmentsForCell = (teamId: string, date: string) => {
    return allAssignmentsFormatted.filter(a => {
      // Find actual technicians that belong to this team
      const techIdsInTeam = activeTechnicians.filter(t => t.team_id === teamId).map(t => t.id);
      if (!techIdsInTeam.includes(a.teamId)) return false;
      return date >= a.startDate && date <= a.endDate;
    });
  };

  const weekStart = startOfWeek(new Date(weekConfig.year, 0, 1 + (weekConfig.week_number - 1) * 7), { weekStartsOn: 1 });
  const month = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][weekStart.getMonth()];

  return (
    <div className="min-h-screen bg-background p-4 relative">
      {/* Floating Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary/80">
          Planning des équipes • Semaine {weekConfig.week_number} • {month} {weekConfig.year}
        </h1>
        <div className="flex items-center gap-4">
          <div className="text-xl font-mono text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg border">
            {formatTimeLeft(timeLeft)}
          </div>
          <button 
            onClick={() => navigate('/')} 
            className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            Quitter
          </button>
        </div>
      </div>

      <Card className="border-2 shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardContent className="p-0 max-h-[calc(100vh-8rem)] overflow-y-auto pointer-events-none">
          {/* pointer-events-none disables all clicking, dragging, and hover effects entirely */}
          <WeeklyGrid
            displayTeams={displayTeams}
            activeTechnicians={activeTechnicians}
            weekDates={weekDates}
            notes={notes}
            absences={absences}
            commandes={commandes}
            chantiers={chantiers}
            isAdmin={false} // Disable admin features
            maxAssignments={3}
            allAssignmentsFormatted={allAssignmentsFormatted}
            
            // Empty handers since pointer events are none anyway, but required by typescript
            getGeneralNotesForDate={getGeneralNotesForDate}
            getAssignmentsForCell={getAssignmentsForCell}
            handleAddGeneralNote={() => {}}
            handleGeneralNoteClick={() => {}}
            saveNote={() => {}}
            handleDeleteNote={() => {}}
            handleToggleNoteConfirm={() => {}}
            handleCellClick={() => {}}
            handleAddAssignment={() => {}}
            handleAssignmentClick={() => {}}
            handleDuplicateAssignment={() => {}}
            handleDeleteAssignment={() => {}}
            isDraggable={() => false}
            handleDragStart={() => {}}
            handleDragOver={() => {}}
            handleDragLeave={() => {}}
            handleDrop={() => {}}
            handleDragEnd={() => {}}
            dropTarget={null}
            previewCells={[]}
            draggedItem={null}
            highlightedGroupId={null}
            setHighlightedGroupId={() => {}}
          />
        </CardContent>
      </Card>
      
      {/* Overlay to catch any stray clicks if pointer-events-none fails on certain child elements */}
      <div className="absolute inset-0 z-50 pointer-events-auto" style={{ top: '80px' }}></div>
    </div>
  );
};

export default Presentation;
