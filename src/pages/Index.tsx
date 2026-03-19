import { useState, useEffect } from 'react';
import { EditAssignmentDialog } from '@/components/EditAssignmentDialog';
import { EditNoteDialog } from '@/components/EditNoteDialog';
import { EditGeneralNoteDialog } from '@/components/EditGeneralNoteDialog';
import { EditTechnicianWeekNoteDialog } from '@/components/EditTechnicianWeekNoteDialog';
import { TeamManagementDialog } from '@/components/TeamManagementDialog';
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
  const { data: chantiers = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*');
      if (error) throw error;
      return data;
    }
  });
  
  const weekDates = weekConfig ? getWeekDates(weekConfig.week_number, weekConfig.year) : [];
  const weekStart = weekDates[0]?.fullDate;
  const weekEnd = weekDates[4]?.fullDate;
  
  const { data: assignments = [] } = useAssignments(weekStart, weekEnd);
  const { data: notes = [] } = useNotes(weekStart, weekEnd);
  const { data: absences = [] } = useAbsences(weekStart, weekEnd);
  const { data: savRecords = [] } = useSAV(weekStart, weekEnd);
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

  const handleUpdateTechnicianName = (id: string, name?: string, is_interim?: boolean, skills?: string) => {
    updateTechnician.mutate({ id, name, is_interim, skills }, {
      onSuccess: () => {
        toast.success(is_interim !== undefined ? 'Statut intérim mis à jour' : 'Nom mis à jour');
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
      chantierId: null,
      commandeId: commandes[0]?.id || null,
      name: commandes[0] ? `${commandes[0].client} - ${commandes[0].chantier}` : '',
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
      chantierId: null,
      commandeId: commandes[0]?.id || null,
      name: commandes[0] ? `${commandes[0].client} - ${commandes[0].chantier}` : '',
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
    const commande = updatedAssignment.commandeId ? commandes.find(c => c.id === updatedAssignment.commandeId) : null;
    const assignmentName = updatedAssignment.isAbsent ? 'Absent' : (commande ? `${commande.client} - ${commande.chantier}` : updatedAssignment.name);

    if (updatedAssignment.id && !updatedAssignment.id.startsWith('new-')) {
      const originalAssignment = assignments.find(a => a.id === updatedAssignment.id);
      const dbAssignment = {
        id: updatedAssignment.id,
        team_id: updatedAssignment.teamId,
        technician_id: originalAssignment?.technician_id ?? updatedAssignment.technicianId,
        chantier_id: null,
        commande_id: updatedAssignment.commandeId,
        name: assignmentName,
        start_date: updatedAssignment.startDate,
        end_date: updatedAssignment.endDate,
        is_fixed: updatedAssignment.isFixed,
        comment: updatedAssignment.comment,
        is_absent: updatedAssignment.isAbsent || false,
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
              chantier_id: null,
              commande_id: updatedAssignment.commandeId,
              name: assignmentName,
              is_fixed: updatedAssignment.isFixed,
              comment: updatedAssignment.comment,
              is_absent: updatedAssignment.isAbsent || false,
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
          onError: () => {
            toast.error("Erreur lors de l'enregistrement");
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
        technician_id: updatedAssignment.technicianId || null,
        chantier_id: null,
        commande_id: updatedAssignment.commandeId,
        name: assignmentName,
        start_date: currentDate.toISOString().split('T')[0],
        end_date: currentDate.toISOString().split('T')[0],
        is_fixed: updatedAssignment.isFixed,
        comment: updatedAssignment.comment,
        is_absent: updatedAssignment.isAbsent || false,
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
    } catch {
      toast.error("Erreur lors de l'enregistrement");
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

  const handleToggleNoteConfirm = (noteId: string, isConfirmed: boolean) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    saveNote.mutate({
      id: noteId,
      text: note.text,
      technician_id: note.technician_id,
      start_date: note.start_date,
      end_date: note.end_date || note.start_date,
      is_sav: note.is_sav,
      is_confirmed: isConfirmed,
    }, {
      onSuccess: () => toast.success(isConfirmed ? 'Note confirmée' : 'Note non confirmée'),
      onError: () => toast.error('Erreur lors de la mise à jour'),
    });
  };

  const handleToggleNoteDisplayBelow = (noteId: string, displayBelow: boolean) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    saveNote.mutate({
      id: noteId,
      text: note.text,
      technician_id: note.technician_id,
      start_date: note.start_date,
      end_date: note.end_date || note.start_date,
      is_sav: note.is_sav,
      is_confirmed: note.is_confirmed,
      display_below: displayBelow,
    }, {
      onSuccess: () => toast.success(displayBelow ? 'Note déplacée en bas' : 'Note déplacée en haut'),
      onError: () => toast.error('Erreur lors de la mise à jour'),
    });
  };

  // Handler for bulk toggling notes display_below
  const handleBulkToggleNotesDisplayBelow = (noteIds: string[], displayBelow: boolean) => {
    noteIds.forEach(noteId => {
      handleToggleNoteDisplayBelow(noteId, displayBelow);
    });
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
      team_id: dbAssignment1.team_id,
      technician_id: dbAssignment1.technician_id,
      commande_id: dbAssignment1.commande_id,
      name: dbAssignment1.name,
      start_date: dbAssignment1.start_date,
      end_date: dbAssignment1.end_date,
      is_fixed: dbAssignment1.is_fixed,
      comment: dbAssignment1.comment,
      is_absent: dbAssignment1.is_absent,
      absence_reason: dbAssignment1.absence_reason,
      is_confirmed: dbAssignment1.is_confirmed,
      assignment_group_id: dbAssignment1.assignment_group_id,
      updated_at: now.toISOString(),
    });
    saveAssignment.mutate({
      id: dbAssignment2.id,
      team_id: dbAssignment2.team_id,
      technician_id: dbAssignment2.technician_id,
      commande_id: dbAssignment2.commande_id,
      name: dbAssignment2.name,
      start_date: dbAssignment2.start_date,
      end_date: dbAssignment2.end_date,
      is_fixed: dbAssignment2.is_fixed,
      comment: dbAssignment2.comment,
      is_absent: dbAssignment2.is_absent,
      absence_reason: dbAssignment2.absence_reason,
      is_confirmed: dbAssignment2.is_confirmed,
      assignment_group_id: dbAssignment2.assignment_group_id,
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
      is_sav: false,
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
      is_sav: note.is_sav,
      is_confirmed: note.is_confirmed,
      is_invoiced: note.is_invoiced,
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

  // Handler for adding day notes for a specific technician (per day, not week)
  const handleAddTechDayNote = (technicianId: string, technicianName: string, date: string) => {
    setSelectedTechWeekNote({
      id: '',
      text: '',
      technician_id: technicianId,
      technician_name: technicianName,
      date: date,
      is_sav: false,
    });
    setTechWeekNoteDialogOpen(true);
  };

  // Handler for clicking on an existing technician day note
  const handleTechDayNoteClick = (note: any, technicianId: string, technicianName: string, date: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    setSelectedTechWeekNote({
      id: note.id,
      text: note.text,
      technician_id: technicianId,
      technician_name: technicianName,
      date: date,
      is_sav: note.is_sav,
      is_confirmed: note.is_confirmed,
      is_invoiced: note.is_invoiced,
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

  // Get general notes for a specific date (notes without technician_id)
  const getGeneralNotesForDate = (date: string) => {
    return notes.filter((n) => {
      if (n.technician_id !== null) return false;
      const noteEndDate = n.end_date || n.start_date;
      return date >= n.start_date && date <= noteEndDate;
    });
  };

  const getDayNotesForTechnician = (technicianId: string, date: string) => {
    return notes.filter((n) => {
      if (n.technician_id !== technicianId) return false;
      const noteEndDate = n.end_date || n.start_date;
      return n.start_date === date && noteEndDate === date;
    });
  };

  // Returns assignments for a given team + date (full-day model, no period filter)
  const getAssignmentsForCell = (teamId: string, date: string): Assignment[] => {
    const dbAssignments = assignments.filter(
      (a) => (a.team_id === teamId || a.technician_id === teamId) &&
              date >= a.start_date && date <= a.end_date
    );
    return dbAssignments.map(dbAssignment => ({
      id: dbAssignment.id,
      teamId: dbAssignment.team_id ?? dbAssignment.technician_id,
      technicianId: dbAssignment.technician_id,
      chantierId: dbAssignment.chantier_id,
      commandeId: dbAssignment.commande_id,
      name: dbAssignment.name,
      startDate: dbAssignment.start_date,
      endDate: dbAssignment.end_date,
      isFixed: dbAssignment.is_fixed || false,
      isValid: true,
      comment: dbAssignment.comment || undefined,
      isAbsent: dbAssignment.is_absent || false,
      isConfirmed: dbAssignment.is_confirmed || false,
      assignment_group_id: dbAssignment.assignment_group_id,
      absence_reason: dbAssignment.absence_reason,
    }));
  };

  const allAssignmentsFormatted: Assignment[] = assignments.map(dbAssignment => ({
    id: dbAssignment.id,
    teamId: dbAssignment.team_id ?? dbAssignment.technician_id,
    technicianId: dbAssignment.technician_id,
    chantierId: dbAssignment.chantier_id,
    commandeId: dbAssignment.commande_id,
    name: dbAssignment.name,
    startDate: dbAssignment.start_date,
    endDate: dbAssignment.end_date,
    isFixed: dbAssignment.is_fixed || false,
    isValid: true,
    comment: dbAssignment.comment || undefined,
    isAbsent: dbAssignment.is_absent || false,
    isConfirmed: dbAssignment.is_confirmed || false,
    assignment_group_id: dbAssignment.assignment_group_id,
    absence_reason: dbAssignment.absence_reason,
  }));

  // Filter assignments by search term (client name or chantier/address)
  const filteredAssignmentsFormatted = searchTerm.trim()
    ? allAssignmentsFormatted.filter(a => {
        if (a.isAbsent) return false;
        const commande = commandes.find(c => c.id === a.commandeId);
        if (!commande) return false;
        const q = searchTerm.toLowerCase();
        return (
          commande.client?.toLowerCase().includes(q) ||
          commande.chantier?.toLowerCase().includes(q)
        );
      })
    : allAssignmentsFormatted;

  const getNotesForCell = (technicianId: string, date: string) => {
    return notes.filter((n) => {
      if (n.technician_id !== technicianId) return false;
      
      const cellDate = date;
      const noteStartDate = n.start_date;
      const noteEndDate = n.end_date || n.start_date;
      
      // If cell date falls within the note's date range, return true
      return cellDate >= noteStartDate && cellDate <= noteEndDate;
    });
  };

  const visibleCommandeIds = new Set(
    assignments
      .filter((a) => {
        // Check if assignment is active during any day of the displayed week
        return weekDates.some((d) => {
          const dayDate = d.fullDate;
          return dayDate >= a.start_date && dayDate <= a.end_date;
        });
      })
      .map((a) => a.commande_id)
      .filter(Boolean) // Remove null values
  );
  
  const projectMargins = commandes
    .filter((c) => visibleCommandeIds.has(c.id))
    .map((c) => {
      const margin = (c.montant_ht || 0) - (c.achats || 0);
      return {
        name: `${c.client} - ${c.chantier}`,
        amount: `${margin.toFixed(2)} €`,
      };
    });

  // Use teams as the display rows — ordered by position (from DB)
  const displayTeams = teams;

  // Calculate invoiced counts for the summary
  const invoicedAssignments = assignments.filter(a => 
    weekDates.some(d => d.fullDate >= a.start_date && d.fullDate <= a.end_date) && 
    (a.commande_id && commandes.find(c => c.id === a.commande_id)?.is_invoiced)
  ).length;
  const totalAssignments = assignments.filter(a =>
    weekDates.some(d => d.fullDate >= a.start_date && d.fullDate <= a.end_date)
  ).length;
  const invoicedNotes = notes.filter(n => 
    weekDates.some(d => {
      const noteEndDate = n.end_date || n.start_date;
      return d.fullDate >= n.start_date && d.fullDate <= noteEndDate;
    }) && 
    n.is_invoiced
  ).length;
  const totalNotes = notes.filter(n =>
    weekDates.some(d => {
      const noteEndDate = n.end_date || n.start_date;
      return d.fullDate >= n.start_date && d.fullDate <= noteEndDate;
    })
  ).length;

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
                invoicedAssignments={invoicedAssignments}
                totalAssignments={totalAssignments}
                invoicedNotes={invoicedNotes}
                totalNotes={totalNotes}
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
              <CardContent className="p-0 max-h-[calc(100vh-12rem)] overflow-y-auto">
                <WeeklyGrid
                  displayTeams={displayTeams}
                  activeTechnicians={activeTechnicians}
                  weekDates={weekDates}
                  notes={notes}
                  absences={absences}
                  commandes={commandes}
                  chantiers={chantiers}
                  isAdmin={isAdmin}
                  maxAssignments={maxAssignments}
                  allAssignmentsFormatted={allAssignmentsFormatted}
                  getGeneralNotesForDate={getGeneralNotesForDate}
                  getAssignmentsForCell={getAssignmentsForCell}
                  handleAddGeneralNote={(date) => handleAddGeneralNote(date, 'Journée')}
                  handleGeneralNoteClick={handleGeneralNoteClick}
                  saveNote={saveNote}
                  handleDeleteNote={handleDeleteNote}
                  handleToggleNoteConfirm={handleToggleNoteConfirm}
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
                />
              </CardContent>
            </Card>
        </div>
        
        {/* SAV Table */}
        {savVisible && savRecords.length > 0 && (
          <SAVTable
            savRecords={savRecords}
            weekStart={weekStart}
            isAdmin={isAdmin}
            onClose={() => setSavVisible(false)}
          />
        )}

        <EditAssignmentDialog
          open={assignmentDialogOpen}
          onOpenChange={setAssignmentDialogOpen}
          assignment={selectedAssignment}
          chantiers={commandes
            .filter((c) => !c.is_invoiced || c.id === selectedAssignment?.commandeId)
            .map((c) => ({ 
              id: c.id, 
              name: `${c.client} - ${c.chantier}`, 
              color: '#dbeafe',
              facture: c.facture 
            }))}
          commandes={commandes}
          teams={teams}
          assignments={assignments.map(a => ({
            id: a.id,
            teamId: a.team_id,
            chantierId: a.chantier_id,
            commandeId: a.commande_id,
            name: a.name,
            startDate: a.start_date,
            endDate: a.end_date,
            isFixed: a.is_fixed || false,
            isValid: true,
            comment: a.comment,
            isAbsent: a.is_absent || false,
            isConfirmed: a.is_confirmed || false,
            assignment_group_id: a.assignment_group_id,
          }))}
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
          technicians={activeTechnicians.map((t) => ({ id: t.id, name: t.name }))}
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
            position: t.position ?? 0,
            team_id: t.team_id,
            is_temp: t.is_temp,
            short_id: t.short_id,
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
          assignments={assignments.map(a => ({
            id: a.id,
            team_id: a.team_id,
            commande_id: a.commande_id,
            start_date: a.start_date,
            end_date: a.end_date,
            comment: a.comment,
          }))}
          teams={teams.map(t => ({ id: t.id, name: t.name, color: t.color }))}
        />

        <SendScheduleDialog
          open={sendScheduleOpen}
          onOpenChange={setSendScheduleOpen}
          weekNumber={weekConfig.week_number}
          year={weekConfig.year}
          technicians={activeTechnicians.map((t) => ({ id: t.id, name: t.name }))}
          assignments={assignments}
          notes={notes}
          weekDates={weekDates}
          chantiers={commandes.map((c) => ({ 
            id: c.id, 
            name: `${c.client} - ${c.chantier}`,
            client: c.client,
            invoice: c.numero
          }))}
          commandes={commandes}
          savRecords={savRecords}
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
