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
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, getWeek, getYear } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Assignment } from '@/types/planning';

// Local types for rows returned by hooks whose tables may not be in auto-generated types.ts
type AbsenceRow = {
  id: string;
  technician_id: string;
  start_date: string;
  end_date: string;
  motive_id?: string | null;
  absence_motives?: { name: string } | null;
};

type TechnicianRow = {
  id: string;
  name: string;
  team_id: string | null;
  is_archived: boolean;
  color?: string | null;
  is_temp?: boolean;
  position?: number;
};

const DEFAULT_TIMEOUT_MINUTES = 30;

const Presentation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const timeoutMinutes = parseInt(searchParams.get('timeout') || '0', 10) || DEFAULT_TIMEOUT_MINUTES;
  const timeoutMs = timeoutMinutes * 60 * 1000;

  const dateParam = searchParams.get('date');
  const customDate = dateParam ? new Date(dateParam) : null;
  const customWeekNumber = customDate ? getWeek(customDate, { weekStartsOn: 1 }) : null;
  const customYear = customDate ? getYear(customDate) : null;

  // Validation & Timeout states
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timeoutMs);
  const [timedOut, setTimedOut] = useState(false);
  const [isHalted, setIsHalted] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        navigate('/auth');
        return;
      }

      try {
        // Ask Supabase if this token exists and is active
        const { data, error } = await supabase
          .from('presentation_tokens')
          .select('id')
          .eq('token', token)
          .eq('is_active', true)
          .maybeSingle();

        if (error || !data) {
          console.error("Lien invalide ou expiré.");
          navigate('/auth');
          return;
        }

        // Token is good! Let them in.
        setIsTokenValid(true);
      } catch (err) {
        console.error("Erreur de validation du token", err);
        navigate('/auth');
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token, navigate]);

  useEffect(() => {
    if (!isTokenValid) return; // Don't start timers until validated

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          clearInterval(timer);
          setTimedOut(true); // Show blank screen
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    // Listen for admin remote stop command
    const channel = supabase.channel('presentation_controls')
      .on('broadcast', { event: 'stop_timer' }, () => {
        clearInterval(timer);
        setTimeLeft(0);
        setTimedOut(true);
        setIsHalted(true);
      })
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [isTokenValid]);

  const formatTimeLeft = (ms: number) => {
    if (isHalted) return "Arrêté";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Data fetching
  const { data: dbWeekConfig, isLoading: isConfigLoading } = useWeekConfig();

  const weekConfig = customDate && customWeekNumber && customYear
    ? { week_number: customWeekNumber, year: customYear }
    : dbWeekConfig;
  const { data: techniciansRaw = [], isLoading: isTechLoading } = useTechnicians(true);
  const technicians = techniciansRaw as unknown as TechnicianRow[];
  const { data: teams = [], isLoading: isTeamsLoading } = useTeams();
  const { data: commandes = [], isLoading: isCommandesLoading } = useCommandes();

  const weekDates = weekConfig ? getWeekDates(weekConfig.week_number, weekConfig.year) : [];
  const weekStartStr = weekDates[0]?.fullDate;
  const weekEndStr = weekDates[4]?.fullDate;

  const { data: assignments = [], isLoading: isAssignmentsLoading } = useAssignments(weekStartStr, weekEndStr);
  const { data: notes = [], isLoading: isNotesLoading } = useNotes(weekStartStr, weekEndStr);

  const isPlanningLoading = isConfigLoading || isTechLoading || isTeamsLoading || isCommandesLoading || isAssignmentsLoading || isNotesLoading;

  const { data: absencesRaw = [], isLoading: isAbsencesLoading } = useAbsences(weekStartStr, weekEndStr);
  const absences = absencesRaw as AbsenceRow[];

  // If we are currently checking the database, show a loader
  if (isValidating) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Vérification du lien sécurisé...</span>
      </div>
    );
  }

  // After timeout — show a completely blank screen
  if (timedOut) {
    return <div className="fixed inset-0 bg-black" />;
  }

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
    commandeId: null,
    name: 'Absent',
    startDate: absence.start_date,
    endDate: absence.end_date,
    isFixed: true,
    isValid: true,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAssignmentsFormatted: Assignment[] = assignments.map((dbAssignment: any) => ({
    id: dbAssignment.id,
    teamId: dbAssignment.team_id,
    commandeId: dbAssignment.commande_id,
    name: dbAssignment.name,
    startDate: dbAssignment.start_date,
    endDate: dbAssignment.end_date,
    isFixed: dbAssignment.is_fixed ?? false,
    isValid: true,
    comment: dbAssignment.comment || undefined,
    isConfirmed: dbAssignment.is_confirmed ?? false,
    assignment_group_id: dbAssignment.assignment_group_id,
  }));

  const allAssignmentsFormatted = [...dbAssignmentsFormatted, ...absenceAssignments];

  const activeTechnicians = technicians.filter(t => !t.is_archived);

  const displayTeams = teams;

  const getGeneralNotesForDate = (date: string) => {
    return notes.filter(n => {
      if (n.team_id !== null) return false;
      return date >= n.start_date && date <= (n.end_date || n.start_date);
    });
  };

  const getAssignmentsForCell = (teamId: string, date: string) => {
    return allAssignmentsFormatted.filter(a => {
      if (a.teamId !== teamId) return false;
      return date >= a.startDate && date <= a.endDate;
    });
  };

  const weekStart = startOfWeek(new Date(weekConfig.year, 0, 1 + (weekConfig.week_number - 1) * 7), { weekStartsOn: 1 });
  const month = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][weekStart.getMonth()];

  return (
    <div className="h-screen bg-background p-4 flex flex-col relative overflow-hidden">
      {/* Floating Header */}
      <div className="flex items-center justify-between mb-4 px-2 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight text-primary/80">
          Planning des équipes • Semaine {weekConfig.week_number} • {month} {weekConfig.year}
        </h1>
        <div className="flex items-center gap-4">
          <div className="text-xl font-mono text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg border">
            {formatTimeLeft(timeLeft)}
          </div>
        </div>
      </div>

      <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardContent className="p-0 flex-1 flex flex-col relative overflow-hidden pointer-events-none">
          {/* pointer-events-none disables all clicking, dragging, and hover effects entirely */}
          <WeeklyGrid
            displayTeams={displayTeams}
            activeTechnicians={activeTechnicians}
            weekDates={weekDates}
            notes={notes}
            absences={absences}
            commandes={commandes}

            isAdmin={false} // Disable admin features
            maxAssignments={3}
            allAssignmentsFormatted={allAssignmentsFormatted}

            // Empty handers since pointer events are none anyway, but required by typescript
            getGeneralNotesForDate={getGeneralNotesForDate}
            getAssignmentsForCell={getAssignmentsForCell}
            handleAddGeneralNote={() => { }}
            handleGeneralNoteClick={() => { }}
            saveNote={() => { }}
            handleDeleteNote={() => { }}
            handleCellClick={() => { }}
            handleAddAssignment={() => { }}
            handleAssignmentClick={() => { }}
            handleDuplicateAssignment={() => { }}
            handleDeleteAssignment={() => { }}
            isDraggable={() => false}
            handleDragStart={() => { }}
            handleDragOver={() => { }}
            handleDragLeave={() => { }}
            handleDrop={() => { }}
            handleDragEnd={() => { }}
            dropTarget={null}
            previewCells={[]}
            draggedItem={null}
            highlightedGroupId={null}
            setHighlightedGroupId={() => { }}
          />
        </CardContent>
      </Card>

      {/* Overlay to catch any stray clicks if pointer-events-none fails on certain child elements */}
      <div className="absolute inset-0 z-50 pointer-events-auto" style={{ top: '80px' }}></div>
    </div>
  );
};

export default Presentation;