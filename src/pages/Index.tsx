import { useState, useEffect } from 'react';
import { cn, getShortChantierName } from '@/lib/utils';
import { Commande } from '@/types/planning';
import { EditAssignmentDialog } from '@/components/EditAssignmentDialog';
import { EditNoteDialog } from '@/components/EditNoteDialog';
import { EditGeneralNoteDialog } from '@/components/EditGeneralNoteDialog';
import { EditTechnicianWeekNoteDialog } from '@/components/EditTechnicianWeekNoteDialog';
import { TeamManagementDialog } from '@/components/TeamManagementDialog';
import { DailyTeamManagementDialog } from '@/components/DailyTeamManagementDialog';
import { SendScheduleDialog } from '@/components/SendScheduleDialog';
import { DragIndicator } from '@/components/DragIndicator';
import { SAVTable } from '@/components/SAVTable';
import { PlanningToolbar } from '@/components/planning/PlanningToolbar';
import { WeeklyGrid } from '@/components/planning/WeeklyGrid';
import { SessionExpiryWarning } from '@/components/SessionExpiryWarning';
import { useSAV } from '@/hooks/useSAV';
import { useSessionManager } from '@/hooks/useSessionManager';

import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { User, Session } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Assignment } from '@/types/planning';
import { toast } from 'sonner';
import {
  useWeekConfig,
  useUpdateWeekConfig,
  useTechnicians,
  useTeams,
  useDailyTeamRosters,
  useUpdateDailyTeamRosters, // <--- Add this
  useCreateTechnician,
  useUpdateTechnician,
  useUpdateTechnicianPositions,
  useCommandes,
  useAssignments,
  useNotes,
  useAbsences,
  useSaveAssignment,
  useDeleteAssignment,
  useSaveNote,
  useDeleteNote,
  getWeekDates,
} from '@/hooks/usePlanning';
import { AbsenceManagementDialog } from '@/components/AbsenceManagementDialog';
import { SearchFilterModal } from '@/components/SearchFilterModal';
import { useDuplicateAssignment } from '@/hooks/useDuplicateAssignment';
import { useArchiveTechnician } from '@/hooks/useArchiveTechnician';
import { useUpdateRelatedAssignments } from '@/hooks/useUpdateRelatedAssignments';
import { useDeleteRelatedAssignments } from '@/hooks/useDeleteRelatedAssignments';
import { useDragAndDropAssignment } from '@/hooks/useDragAndDropAssignment';
import { useDragAndDropNote } from '@/hooks/useDragAndDropNote';
import { useMaxAssignmentsPerPeriod } from '@/hooks/useAppSettings';

const Index = () => {
  const navigate = useNavigate();
  const { user: authUser, session: authSession, isAdmin } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshingSession, setIsRefreshingSession] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedGeneralNote, setSelectedGeneralNote] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [generalNoteDialogOpen, setGeneralNoteDialogOpen] = useState(false);
  const [selectedTechWeekNote, setSelectedTechWeekNote] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [techWeekNoteDialogOpen, setTechWeekNoteDialogOpen] = useState(false);
  const [manageTechsDialogOpen, setManageTechsDialogOpen] = useState(false);
  const [absenceManagementOpen, setAbsenceManagementOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [sendScheduleOpen, setSendScheduleOpen] = useState(false);
  const [savVisible, setSavVisible] = useState(false);
  const [groupEditAlert, setGroupEditAlert] = useState<{
    open: boolean;
    assignment: Assignment | null;
  }>({
    open: false,
    assignment: null,
  });
  const [editSingleMode, setEditSingleMode] = useState(false);
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDailyTeamDialogOpen, setIsDailyTeamDialogOpen] = useState(false);
  const [dailyTeamDialogInfo, setDailyTeamDialogInfo] = useState({ teamName: '', date: '' });
  const updateDailyRosters = useUpdateDailyTeamRosters();
  const queryClient = useQueryClient();

  // Session management - automatic refresh and expiry warning
  const { sessionExpiringSoon, timeUntilExpiry, refreshSession } = useSessionManager(session);

  const handleRefreshSession = async () => {
    setIsRefreshingSession(true);
    const success = await refreshSession();
    setIsRefreshingSession(false);
    if (success) {
      toast.success('Session prolongée');
    } else {
      toast.error('Erreur lors du renouvellement de la session');
    }
    return success;
  };

  // Check authentication
  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !session) {
      navigate("/auth");
    }
  }, [loading, session, navigate]);

  // Fetch data
  const { data: weekConfig } = useWeekConfig();
  const { data: technicians = [] } = useTechnicians(true);
  const { data: teams = [] } = useTeams();
  const activeTechnicians = technicians.filter(t => !t.is_archived);
  const { data: commandes = [] } = useCommandes();

  const weekDates = weekConfig ? getWeekDates(weekConfig.week_number, weekConfig.year) : [];
  const weekStart = weekDates[0]?.fullDate;
  const weekEnd = weekDates[4]?.fullDate;

  const { data: assignments = [] } = useAssignments(weekStart, weekEnd);
  const { data: notes = [] } = useNotes(weekStart, weekEnd);
  const { data: absences = [] } = useAbsences(weekStart, weekEnd);
  const { data: savRecords = [] } = useSAV(weekStart, weekEnd);
  const { data: dailyTeamRosters = [] } = useDailyTeamRosters(weekStart || '', weekEnd || '');
  const { maxAssignments } = useMaxAssignmentsPerPeriod();

  // Mutations
  const updateWeekConfig = useUpdateWeekConfig();
  const createTechnician = useCreateTechnician();
  const updateTechnician = useUpdateTechnician();
  const updateTechnicianPositions = useUpdateTechnicianPositions();
  const archiveTechnician = useArchiveTechnician();
  const saveAssignment = useSaveAssignment();
  const deleteAssignment = useDeleteAssignment();
  const duplicateAssignment = useDuplicateAssignment();
  const updateRelatedAssignments = useUpdateRelatedAssignments();
  const deleteRelatedAssignments = useDeleteRelatedAssignments();
  const saveNote = useSaveNote();
  const deleteNote = useDeleteNote();

  // Drag and drop for assignments
  const {
    draggedItem,
    dropTarget,
    previewCells,
    isDraggable,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    canUndo,
    handleUndo,
    isCopyMode,
    copyModeEnabled,
    toggleCopyMode,
    pendingDrop,
    confirmPendingDrop,
    cancelPendingDrop,
    linkedGroupPendingDrop,
    confirmLinkedDropSingle,
    confirmLinkedDropAll,
    cancelLinkedGroupPendingDrop,
    handleWeekNavDragOver,
    handleWeekNavDrop,
    isDragging,
  } = useDragAndDropAssignment(
    assignments,
    commandes,
    teams,
    technicians,
    absences,
    weekStart,
    weekEnd,
    (week, year) => updateWeekConfig.mutate({ week_number: week, year }),
    weekConfig?.week_number,
    weekConfig?.year
  );

  // Drag and drop for notes
  const {
    draggedNote,
    noteDropTarget,
    isNoteDragging,
    handleNoteDragStart,
    handleNoteDragOver,
    handleNoteDragLeave,
    handleNoteDrop,
    handleNoteDragEnd,
    canUndoNote,
    handleNoteUndo,
  } = useDragAndDropNote();

  // Get team name for confirmation dialog
  const getTargetTeamName = () => {
    if (!pendingDrop) return '';
    const team = teams.find(t => t.id === pendingDrop.targetTeamId);
    return team?.name || 'une autre équipe';
  };

  const handleWeekChange = (week_number: number, year: number) => {
    updateWeekConfig.mutate({ week_number, year }, {
      onSuccess: () => {
        toast.success('Semaine mise à jour');
      },
      onError: () => {
        toast.error('Erreur lors de la mise à jour de la semaine');
      },
    });
  };

  const handleAddTechnician = (name: string, isTemp: boolean, skills?: string) => {
    createTechnician.mutate({ name, isTemp, skills }, {
      onSuccess: () => {
        toast.success(`Technicien ${name} ajouté`);
      },
      onError: () => {
        toast.error("Erreur lors de l'ajout du technicien");
      },
    });
  };

  const handleUpdateTechnicianName = (id: string, name?: string, is_temp?: boolean, skills?: string) => {
    updateTechnician.mutate({ id, name, is_temp, skills }, {
      onSuccess: () => {
        toast.success(is_temp !== undefined ? 'Statut intérim mis à jour' : 'Nom mis à jour');
      },
      onError: () => {
        toast.error('Erreur lors de la mise à jour');
      },
    });
  };

  const handleArchiveTechnician = (id: string, isArchived: boolean) => {
    archiveTechnician.mutate({ id, isArchived }, {
      onSuccess: () => {
        toast.success(isArchived ? 'Technicien archivé' : 'Technicien désarchivé');
      },
      onError: () => {
        toast.error('Erreur lors de la modification');
      },
    });
  };

  const handleCellClick = (teamId: string, date: string) => {
    const newAssignment: Assignment = {
      id: `new-${Date.now()}`,
      teamId,

      commandeId: commandes[0]?.id || null,
      startDate: date,
      endDate: date,
      isFixed: false,
      isValid: true,
    };
    setSelectedAssignment(newAssignment);
    setAssignmentDialogOpen(true);
  };

  const handleAddAssignment = (teamId: string, date: string) => {
    const newAssignment: Assignment = {
      id: `new-${Date.now()}`,
      teamId,

      commandeId: commandes[0]?.id || null,
      startDate: date,
      endDate: date,
      isFixed: false,
      isValid: true,
    };
    setSelectedAssignment(newAssignment);
    setAssignmentDialogOpen(true);
  };

  const handleAssignmentClick = (assignment: Assignment) => {
    // Check if this assignment is part of a group with multiple members
    if (assignment.assignment_group_id) {
      const groupMembers = assignments.filter(
        a => a.assignment_group_id === assignment.assignment_group_id
      );
      // Only show group edit dialog if there are actually multiple members in the group
      if (groupMembers.length > 1) {
        setGroupEditAlert({
          open: true,
          assignment,
        });
      } else {
        // Orphaned group with only one member - treat as single assignment
        setSelectedAssignment(assignment);
        setAssignmentDialogOpen(true);
      }
    } else {
      setSelectedAssignment(assignment);
      setAssignmentDialogOpen(true);
    }
  };

  const handleNoteClick = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (note) {
      setSelectedNote(note);
      setNoteDialogOpen(true);
    }
  };

  const handleSaveAssignment = async (updatedAssignment: Assignment) => {
    if (updatedAssignment.id && !updatedAssignment.id.startsWith('new-')) {
      const originalAssignment = assignments.find(a => a.id === updatedAssignment.id);
      const dbAssignment = {
        id: updatedAssignment.id,
        team_id: updatedAssignment.teamId,
        commande_id: updatedAssignment.commandeId,
        start_date: updatedAssignment.startDate,
        end_date: updatedAssignment.endDate,
        is_fixed: updatedAssignment.isFixed,
        comment: updatedAssignment.comment,
        is_confirmed: updatedAssignment.isConfirmed || false,
      };

      if (originalAssignment?.assignment_group_id && !editSingleMode) {
        await new Promise((resolve, reject) => {
          saveAssignment.mutate(dbAssignment, { onSuccess: resolve, onError: reject });
        });
        updateRelatedAssignments.mutate(
          {
            groupId: originalAssignment.assignment_group_id,
            updates: {

              commande_id: updatedAssignment.commandeId,
              is_fixed: updatedAssignment.isFixed,
              comment: updatedAssignment.comment,
              is_confirmed: updatedAssignment.isConfirmed || false,
            },
          },
          {
            onSuccess: () => {
              toast.success('Affectation et groupe mis à jour');
              setAssignmentDialogOpen(false);
              setEditSingleMode(false);
            },
            onError: () => {
              toast.error('Erreur lors de la mise à jour du groupe');
              setEditSingleMode(false);
            },
          }
        );
      } else {
        const groupId = originalAssignment?.assignment_group_id;
        const finalDbAssignment = editSingleMode && groupId
          ? { ...dbAssignment, assignment_group_id: null }
          : dbAssignment;
        saveAssignment.mutate(finalDbAssignment, {
          onSuccess: async () => {
            if (editSingleMode && groupId) {
              const remaining = assignments.filter(
                a => a.assignment_group_id === groupId && a.id !== updatedAssignment.id
              );
              if (remaining.length === 1) {
                await supabase.from('assignments').update({ assignment_group_id: null }).eq('id', remaining[0].id);
                queryClient.invalidateQueries({ queryKey: ['assignments'] });
              }
            }
            toast.success(editSingleMode ? 'Affectation modifiée (détachée du groupe)' : 'Affectation enregistrée');
            setAssignmentDialogOpen(false);
            setEditSingleMode(false);
          },
          onError: (err: any) => {
            toast.error(`Erreur: ${err?.message || "Erreur lors de l'enregistrement"}`);
            setEditSingleMode(false);
          },
        });
      }
      return;
    }

    // New assignment — single full-day or multi-day block
    const startDate = new Date(updatedAssignment.startDate);
    const endDate = new Date(updatedAssignment.endDate);
    const isMultiDay = startDate < endDate;
    const groupId = isMultiDay ? crypto.randomUUID() : null;

    const assignmentsToCreate: object[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      assignmentsToCreate.push({
        team_id: updatedAssignment.teamId,
        commande_id: updatedAssignment.commandeId,
        start_date: currentDate.toISOString().split('T')[0],
        end_date: currentDate.toISOString().split('T')[0],
        is_fixed: updatedAssignment.isFixed,
        comment: updatedAssignment.comment,
        is_confirmed: updatedAssignment.isConfirmed || false,
        assignment_group_id: groupId,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    try {
      for (const a of assignmentsToCreate) {
        await new Promise((resolve, reject) => {
          saveAssignment.mutate(a, { onSuccess: resolve, onError: reject });
        });
      }
      toast.success(`${assignmentsToCreate.length} affectation(s) créée(s)`);
      setAssignmentDialogOpen(false);
    } catch (err: any) {
      toast.error(`Erreur: ${err?.message || "Erreur lors de l'enregistrement"}`);
    }
  };

  const handleDeleteAssignment = (id: string) => {
    if (id && !id.startsWith('new-')) {
      deleteAssignment.mutate(id, {
        onSuccess: () => {
          toast.success('Affectation supprimée');
          setAssignmentDialogOpen(false);
        },
        onError: () => {
          toast.error('Erreur lors de la suppression');
        },
      });
    }
  };

  const handleDeleteAssignmentGroup = (groupId: string) => {
    deleteRelatedAssignments.mutate(groupId, {
      onSuccess: () => {
        toast.success('Groupe d\'affectations supprimé');
        setAssignmentDialogOpen(false);
      },
      onError: () => {
        toast.error('Erreur lors de la suppression du groupe');
      },
    });
  };

  const handleDuplicateAssignment = (id: string) => {
    if (id && !id.startsWith('new-')) {
      duplicateAssignment.mutate(id, {
        onSuccess: () => {
          toast.success('Affectation dupliquée');
        },
        onError: () => {
          toast.error('Erreur lors de la duplication');
        },
      });
    }
  };

  const handleSaveNote = (note: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    saveNote.mutate(note, {
      onSuccess: () => {
        toast.success('Note enregistrée');
        setNoteDialogOpen(false);
        setSelectedNote(null);
      },
      onError: () => {
        toast.error("Erreur lors de l'enregistrement de la note");
      },
    });
  };

  const handleDeleteNote = (id: string) => {
    deleteNote.mutate(id, {
      onSuccess: () => {
        toast.success('Note supprimée');
        setNoteDialogOpen(false);
        setGeneralNoteDialogOpen(false);
        setSelectedNote(null);
        setSelectedGeneralNote(null);
      },
      onError: () => {
        toast.error('Erreur lors de la suppression de la note');
      },
    });
  };



  const handleToggleNoteDisplayBelow = (_noteId: string, _displayBelow: boolean) => {
    // display_below removed
  };

  // Handler for bulk toggling notes display_below
  const handleBulkToggleNotesDisplayBelow = (_noteIds: string[], _displayBelow: boolean) => {
    // display_below removed
  };

  // Handler for swapping assignment positions (reordering within a cell)
  // Note: This is a visual reorder within the UI - we swap the assignments' positions
  const handleAssignmentSwap = (assignment1: Assignment, assignment2: Assignment) => {
    const dbAssignment1 = assignments.find(a => a.id === assignment1.id);
    const dbAssignment2 = assignments.find(a => a.id === assignment2.id);
    if (!dbAssignment1 || !dbAssignment2) return;
    const now = new Date();
    saveAssignment.mutate({
      id: dbAssignment1.id,
      team_id: (dbAssignment1 as any).team_id || (dbAssignment1 as any).teamId,
      commande_id: (dbAssignment1 as any).commande_id || (dbAssignment1 as any).commandeId,
      start_date: (dbAssignment1 as any).start_date || (dbAssignment1 as any).startDate,
      end_date: (dbAssignment1 as any).end_date || (dbAssignment1 as any).endDate,
      is_fixed: (dbAssignment1 as any).is_fixed ?? (dbAssignment1 as any).isFixed,
      comment: (dbAssignment1 as any).comment ?? (dbAssignment1 as any).comment,
      is_confirmed: (dbAssignment1 as any).is_confirmed ?? (dbAssignment1 as any).isConfirmed,
      assignment_group_id: (dbAssignment1 as any).assignment_group_id,
      updated_at: now.toISOString(),
    });
    saveAssignment.mutate({
      id: dbAssignment2.id,
      team_id: (dbAssignment2 as any).team_id || (dbAssignment2 as any).teamId,
      commande_id: (dbAssignment2 as any).commande_id || (dbAssignment2 as any).commandeId,
      start_date: (dbAssignment2 as any).start_date || (dbAssignment2 as any).startDate,
      end_date: (dbAssignment2 as any).end_date || (dbAssignment2 as any).endDate,
      is_fixed: (dbAssignment2 as any).is_fixed ?? (dbAssignment2 as any).isFixed,
      comment: (dbAssignment2 as any).comment ?? (dbAssignment2 as any).comment,
      is_confirmed: (dbAssignment2 as any).is_confirmed ?? (dbAssignment2 as any).isConfirmed,
      assignment_group_id: (dbAssignment2 as any).assignment_group_id,
      updated_at: new Date(now.getTime() - 1000).toISOString(),
    });
    toast.success('Ordre modifié');
  };

  const handleAssignmentMoveUp = (assignment: Assignment, teamId: string, date: string) => {
    const cellAssignments = getAssignmentsForCell(teamId, date);
    const index = cellAssignments.findIndex(a => a.id === assignment.id);
    if (index > 0) handleAssignmentSwap(cellAssignments[index], cellAssignments[index - 1]);
  };

  const handleAssignmentMoveDown = (assignment: Assignment, teamId: string, date: string) => {
    const cellAssignments = getAssignmentsForCell(teamId, date);
    const index = cellAssignments.findIndex(a => a.id === assignment.id);
    if (index < cellAssignments.length - 1) handleAssignmentSwap(cellAssignments[index], cellAssignments[index + 1]);
  };

  const handleAddGeneralNote = (date: string, period: 'Matin' | 'Après-midi' | 'Journée') => {
    setSelectedGeneralNote({
      id: '',
      text: '',
      date,
      period,
    });
    setGeneralNoteDialogOpen(true);
  };

  // Handler for clicking on an existing general note
  const handleGeneralNoteClick = (note: any, date: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const period = note.start_period === note.end_period
      ? note.start_period
      : 'Journée';
    setSelectedGeneralNote({
      id: note.id,
      text: note.text,
      date: date,
      period: period,
    });
    setGeneralNoteDialogOpen(true);
  };

  // Handler for saving general notes
  const handleSaveGeneralNote = (note: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    saveNote.mutate(note, {
      onSuccess: () => {
        toast.success('Note générale enregistrée');
        setGeneralNoteDialogOpen(false);
        setSelectedGeneralNote(null);
      },
      onError: () => {
        toast.error("Erreur lors de l'enregistrement de la note générale");
      },
    });
  };

  // Handler for adding day notes for a specific team (per day)
  const handleAddTechDayNote = (teamId: string, teamName: string, date: string) => {
    setSelectedTechWeekNote({
      id: '',
      text: '',
      technician_id: '',
      technician_name: teamName,
      team_id: teamId,
      date: date,
    });
    setTechWeekNoteDialogOpen(true);
  };

  // Handler for clicking on an existing team day note
  const handleTechDayNoteClick = (note: any, _technicianId: string, _technicianName: string, date: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    setSelectedTechWeekNote({
      id: note.id,
      text: note.text,
      technician_id: '',
      technician_name: '',
      team_id: note.team_id,
      date: date,
    });
    setTechWeekNoteDialogOpen(true);
  };

  // Handler for saving technician day notes
  const handleSaveTechDayNote = (note: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    saveNote.mutate(note, {
      onSuccess: () => {
        toast.success('Note enregistrée');
        setTechWeekNoteDialogOpen(false);
        setSelectedTechWeekNote(null);
      },
      onError: () => {
        toast.error("Erreur lors de l'enregistrement de la note");
      },
    });
  };

  // Get general notes for a specific date (notes without team_id)
  const getGeneralNotesForDate = (date: string) => {
    return notes.filter((n) => {
      if (n.team_id !== null) return false;
      const noteEndDate = n.end_date || n.start_date;
      return date >= n.start_date && date <= noteEndDate;
    });
  };

  const getDayNotesForTechnician = (teamId: string, date: string) => {
    return notes.filter((n) => {
      if (n.team_id !== teamId) return false;
      const noteEndDate = n.end_date || n.start_date;
      return n.start_date === date && noteEndDate === date;
    });
  };

  const allAssignmentsFormatted: Assignment[] = assignments.map(dbAssignment => {
    const a = dbAssignment as any;
    return {
      id: a.id,
      teamId: a.team_id || a.teamId,
      commandeId: a.commande_id || a.commandeId,
      startDate: a.start_date || a.startDate,
      endDate: a.end_date || a.endDate,
      isFixed: a.is_fixed ?? a.isFixed ?? false,
      isValid: true,
      comment: a.comment ?? undefined,
      isConfirmed: a.is_confirmed ?? a.isConfirmed ?? false,
      assignment_group_id: a.assignment_group_id,
      commandes: a.commandes
    };
  });

  // Filter assignments by search term (client name or chantier/address)
  const filteredAssignmentsFormatted = searchTerm.trim()
    ? allAssignmentsFormatted.filter(a => {
      const commande = a.commandes || commandes.find(c => c.id === a.commandeId);
      if (!commande) return false;
      const q = searchTerm.toLowerCase();
      return (
        (commande as any).client?.toLowerCase().includes(q) ||
        (commande as any).chantier?.toLowerCase().includes(q) ||
        (commande as any).display_name?.toLowerCase().includes(q)
      );
    })
    : allAssignmentsFormatted;

  // Returns assignments for a given team + date (full-day model, no period filter)
  const getAssignmentsForCell = (teamId: string, date: string): Assignment[] => {
    return filteredAssignmentsFormatted.filter(
      (a) => a.teamId === teamId && date >= a.startDate && date <= a.endDate
    );
  };

  const getNotesForCell = (teamId: string, date: string) => {
    return notes.filter((n) => {
      if (n.team_id !== teamId) return false;
      const noteStartDate = n.start_date;
      const noteEndDate = n.end_date || n.start_date;
      return date >= noteStartDate && date <= noteEndDate;
    });
  };

  const visibleCommandeIds = new Set(
    assignments
      .filter((a: any) => {
        // Check if assignment is active during any day of the displayed week
        const start = a.start_date || a.startDate;
        const end = a.end_date || a.endDate;

        return weekDates.some((d) => {
          const dayDate = d.fullDate;
          return dayDate >= start && dayDate <= end;
        });
      })
      .map((a: any) => a.commande_id || a.commandeId)
      .filter(Boolean) // Remove null values
  );
  // Use teams as the display rows — ordered by position (from DB)
  const displayTeams = teams;

  const handleSignOut = async () => {
    try {
      // Clear local state first
      setUser(null);
      setSession(null);

      // Sign out with global scope to invalidate all sessions
      await supabase.auth.signOut({ scope: 'global' }).catch(() => {
        // Session was already missing, this is fine
      });

      // Clear any cached data
      queryClient.clear();

      // Clear localStorage auth data
      localStorage.removeItem('sb-fguflyjgzzeiicefilmb-auth-token');

      // Force full page reload to clear all state
      window.location.replace("/auth");
    } catch (error) {
      console.error("Erreur de déconnexion:", error);
      // Clear localStorage and navigate anyway
      localStorage.removeItem('sb-fguflyjgzzeiicefilmb-auth-token');
      window.location.replace("/auth");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!weekConfig || !session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Session expiry warning */}
      {sessionExpiringSoon && (
        <SessionExpiryWarning
          timeUntilExpiry={timeUntilExpiry}
          onRefresh={handleRefreshSession}
          isRefreshing={isRefreshingSession}
        />
      )}
      {/* Drag mode indicator */}
      <DragIndicator isDragging={isDragging} isCopyMode={isCopyMode} />
      {/* Issue #10: Mobile responsive layout */}
      <div className="w-full p-2 sm:p-4 lg:p-8">
        <div className="max-w-[2000px] mx-auto">
          {/* SAV Table is now at the bottom only */}
          <div className="grid grid-cols-1 gap-4 lg:gap-6">
            <Card className="overflow-hidden shadow-lg" data-schedule-container>
              <PlanningToolbar
                weekConfig={weekConfig}
                handleWeekChange={handleWeekChange}
                handleWeekNavDragOver={handleWeekNavDragOver}
                handleWeekNavDrop={handleWeekNavDrop}
                isDragging={isDragging}

                isAdmin={isAdmin}
                copyModeEnabled={copyModeEnabled}
                toggleCopyMode={toggleCopyMode}
                canUndo={canUndo}
                canUndoNote={canUndoNote}
                handleUndo={handleUndo}
                handleNoteUndo={handleNoteUndo}
                setSendScheduleOpen={setSendScheduleOpen}
                savRecordsLength={savRecords.length}
                savVisible={savVisible}
                setSavVisible={setSavVisible}
                handleSignOut={handleSignOut}
                setManageTechsDialogOpen={setManageTechsDialogOpen}
                setAbsenceManagementOpen={setAbsenceManagementOpen}
                onOpenSearchModal={() => setSearchModalOpen(true)}
              />
              <CardContent className="p-0 h-[calc(100vh-12rem)] flex flex-col relative overflow-hidden">
                <WeeklyGrid
                  displayTeams={displayTeams}
                  activeTechnicians={activeTechnicians}
                  dailyTeamRosters={dailyTeamRosters}
                  onManageDailyTeam={(teamName, date) => {
                    setDailyTeamDialogInfo({ teamName, date });
                    setIsDailyTeamDialogOpen(true);
                  }}
                  weekDates={weekDates}
                  notes={notes}
                  absences={absences}
                  commandes={commandes}

                  isAdmin={isAdmin}
                  maxAssignments={maxAssignments}
                  allAssignmentsFormatted={allAssignmentsFormatted}
                  getGeneralNotesForDate={getGeneralNotesForDate}
                  getAssignmentsForCell={getAssignmentsForCell}
                  handleAddGeneralNote={(date) => handleAddGeneralNote(date, 'Journée')}
                  handleGeneralNoteClick={handleGeneralNoteClick}
                  saveNote={saveNote}
                  handleDeleteNote={handleDeleteNote}
                  handleCellClick={handleCellClick}
                  handleAddAssignment={handleAddAssignment}
                  handleAssignmentClick={handleAssignmentClick}
                  handleDuplicateAssignment={handleDuplicateAssignment}
                  handleDeleteAssignment={handleDeleteAssignment}
                  isDraggable={isDraggable}
                  handleDragStart={handleDragStart}
                  handleDragOver={handleDragOver}
                  handleDragLeave={handleDragLeave}
                  handleDrop={handleDrop}
                  handleDragEnd={handleDragEnd}
                  dropTarget={dropTarget}
                  previewCells={previewCells}
                  draggedItem={draggedItem}
                  highlightedGroupId={highlightedGroupId}
                  setHighlightedGroupId={setHighlightedGroupId}
                  handleTechDayNoteClick={handleTechDayNoteClick}
                  handleAddTechDayNote={handleAddTechDayNote}
                />
              </CardContent>
            </Card>
          </div>

          {/* SAV Table */}
          {/* SAV Table temporarily hidden by user request
        {savVisible && savRecords.length > 0 && (
          <SAVTable
            savRecords={savRecords}
            weekStart={weekStart}
            isAdmin={isAdmin}
            onClose={() => setSavVisible(false)}
          />
        )}
        */}

          <EditAssignmentDialog
            open={assignmentDialogOpen}
            onOpenChange={setAssignmentDialogOpen}
            assignment={selectedAssignment}

            commandes={commandes}
            teams={teams}
            assignments={allAssignmentsFormatted}
            allDbAssignments={assignments}
            onSave={handleSaveAssignment}
            onDelete={handleDeleteAssignment}
            onDeleteGroup={handleDeleteAssignmentGroup}
            onDuplicate={handleDuplicateAssignment}
          />

          <EditNoteDialog
            open={noteDialogOpen}
            onOpenChange={setNoteDialogOpen}
            note={selectedNote}
            technicians={activeTechnicians.map((t) => ({ id: t.id, name: t.name }))}
            weekDates={weekDates}
            onSave={handleSaveNote}
            onDelete={handleDeleteNote}
          />

          <EditGeneralNoteDialog
            open={generalNoteDialogOpen}
            onOpenChange={setGeneralNoteDialogOpen}
            note={selectedGeneralNote}
            onSave={handleSaveGeneralNote}
            onDelete={handleDeleteNote}
          />

          <EditTechnicianWeekNoteDialog
            open={techWeekNoteDialogOpen}
            onOpenChange={setTechWeekNoteDialogOpen}
            note={selectedTechWeekNote}
            onSave={handleSaveTechDayNote}
            onDelete={handleDeleteNote}
            onDuplicate={(notes) => {
              notes.forEach(n => {
                saveNote.mutate(n, {
                  onError: () => toast.error("Erreur lors de la duplication"),
                });
              });
              toast.success(`${notes.length} note(s) créée(s)`);
            }}
            technicians={teams.map((t) => ({ id: t.id, name: t.name }))}
            weekDates={weekDates.map(d => d.fullDate)}
          />

          <TeamManagementDialog
            open={manageTechsDialogOpen}
            onOpenChange={setManageTechsDialogOpen}
            teams={teams}
            technicians={technicians.map((t) => ({
              id: t.id,
              name: t.name,
              is_archived: t.is_archived || false,
              position: (t as any).position ?? 0,
              team_id: t.team_id,
              is_temp: t.is_temp,
              skills: t.skills
            }))}
            onArchive={handleArchiveTechnician}
            onNameChange={handleUpdateTechnicianName}
            onAdd={handleAddTechnician}
            onAssignTeam={(techId, teamId) => updateTechnician.mutate({ id: techId, team_id: teamId })}
          />

          <AbsenceManagementDialog
            open={absenceManagementOpen}
            onOpenChange={setAbsenceManagementOpen}
          />

          <SearchFilterModal
            open={searchModalOpen}
            onOpenChange={setSearchModalOpen}
            commandes={commandes.map(c => ({ id: c.id, client: c.client, chantier: c.chantier }))}
            assignments={assignments.map((a: any) => ({
              id: a.id,
              team_id: a.team_id || (a as any).teamId,
              commande_id: a.commande_id || (a as any).commandeId,
              start_date: a.start_date || (a as any).startDate,
              end_date: a.end_date || (a as any).endDate,
              comment: a.comment || (a as any).comment,
            }))}
            teams={teams.map(t => ({ id: t.id, name: t.name, color: t.color }))}
            notes={notes}
          />

          <SendScheduleDialog
            open={sendScheduleOpen}
            onOpenChange={setSendScheduleOpen}
            weekNumber={weekConfig.week_number}
            year={weekConfig.year}
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
            technicians={activeTechnicians.map((t) => ({ id: t.id, name: t.name, team_id: t.team_id }))}
            assignments={assignments.map((a: any) => ({
              id: a.id,
              team_id: a.team_id || a.teamId,
              commande_id: a.commande_id || a.commandeId,
              start_date: a.start_date || a.startDate,
              end_date: a.end_date || a.endDate,
              comment: a.comment,
            }))}
            notes={notes}
            absences={absences}
            weekDates={weekDates}

            commandes={commandes}
            savRecords={savRecords}
          />

          <DailyTeamManagementDialog
            isOpen={isDailyTeamDialogOpen}
            onClose={() => setIsDailyTeamDialogOpen(false)}
            teamName={dailyTeamDialogInfo.teamName}
            date={dailyTeamDialogInfo.date}
            activeTechnicians={activeTechnicians}
            currentRosters={dailyTeamRosters.filter((r: any) =>
              r.team_name === dailyTeamDialogInfo.teamName &&
              r.date === dailyTeamDialogInfo.date
            )}
            onSave={(rosters) => {
              updateDailyRosters.mutate({
                date: dailyTeamDialogInfo.date,
                teamName: dailyTeamDialogInfo.teamName,
                rosters
              });
            }}
          />

          <AlertDialog open={groupEditAlert.open} onOpenChange={(open) => !open && setGroupEditAlert({ open: false, assignment: null })}>
            <AlertDialogContent className="bg-card sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Modifier l'affectation groupée</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span>Cette affectation fait partie d'un groupe (indiqué par l'icône 🔗).</span>
                  <br />
                  <span className="font-medium">« Celle-ci uniquement »</span> détachera l'affectation du groupe et elle deviendra indépendante.
                  <br />
                  <span className="font-medium">« Tout le groupe »</span> appliquera les modifications à toutes les affectations liées.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (groupEditAlert.assignment) {
                      setEditSingleMode(true);
                      setSelectedAssignment(groupEditAlert.assignment);
                      setAssignmentDialogOpen(true);
                      setGroupEditAlert({ open: false, assignment: null });
                    }
                  }}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  Celle-ci uniquement
                </AlertDialogAction>
                <AlertDialogAction onClick={() => {
                  if (groupEditAlert.assignment) {
                    setEditSingleMode(false);
                    setSelectedAssignment(groupEditAlert.assignment);
                    setAssignmentDialogOpen(true);
                    setGroupEditAlert({ open: false, assignment: null });
                  }
                }}>
                  Tout le groupe
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Cross-technician drop confirmation dialog */}
          <AlertDialog open={!!pendingDrop} onOpenChange={(open) => !open && cancelPendingDrop()}>
            <AlertDialogContent className="bg-card">
              <AlertDialogHeader>
                <AlertDialogTitle>Déplacer vers une autre équipe</AlertDialogTitle>
                <AlertDialogDescription>
                  Voulez-vous vraiment déplacer cette affectation vers {getTargetTeamName()} ?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={cancelPendingDrop}>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={confirmPendingDrop}>
                  Confirmer le déplacement
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={!!linkedGroupPendingDrop} onOpenChange={(open) => !open && cancelLinkedGroupPendingDrop()}>
            <AlertDialogContent className="bg-card sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Affectation liée à d'autres techniciens</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span>Cette affectation est liée à un groupe de {linkedGroupPendingDrop?.linkedGroupSize} affectation(s).</span>
                  <br />
                  <span className="font-medium">« Celle-ci uniquement »</span> détachera l'affectation du groupe et la déplacera indépendamment.
                  <br />
                  <span className="font-medium">« Toutes les liées »</span> déplacera toutes les affectations vers la même date/période.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                <AlertDialogCancel onClick={cancelLinkedGroupPendingDrop} className="w-full sm:w-auto">
                  Annuler
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmLinkedDropSingle}
                  className="w-full sm:w-auto bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  Celle-ci uniquement
                </AlertDialogAction>
                <AlertDialogAction onClick={confirmLinkedDropAll} className="w-full sm:w-auto">
                  Toutes les liées
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default Index;
