import { useState, useEffect } from 'react';
import { EditAssignmentDialog } from '@/components/EditAssignmentDialog';
import { EditNoteDialog } from '@/components/EditNoteDialog';
import { EditGeneralNoteDialog } from '@/components/EditGeneralNoteDialog';
import { EditTechnicianWeekNoteDialog } from '@/components/EditTechnicianWeekNoteDialog';
import { TechnicianManagementDialog } from '@/components/TechnicianManagementDialog';
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
  useCreateTechnician,
  useUpdateTechnician,
  useUpdateTechnicianPositions,
  useCommandes,
  useAssignments,
  useNotes,
  useSaveAssignment,
  useDeleteAssignment,
  useSaveNote,
  useDeleteNote,
  getWeekDates,
} from '@/hooks/usePlanning';
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
  const [sendScheduleOpen, setSendScheduleOpen] = useState(false);
  const [savAbove, setSavAbove] = useState(false);
  const [groupEditAlert, setGroupEditAlert] = useState<{
    open: boolean;
    assignment: Assignment | null;
  }>({
    open: false,
    assignment: null,
  });
  const [editSingleMode, setEditSingleMode] = useState(false);
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null);
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
    linkedTechPendingDrop,
    confirmLinkedDropSingle,
    confirmLinkedDropAll,
    cancelLinkedTechPendingDrop,
    handleWeekNavDragOver,
    handleWeekNavDrop,
    isDragging,
  } = useDragAndDropAssignment(
    assignments, 
    commandes,
    technicians,
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

  // Get technician name for confirmation dialog
  const getTargetTechnicianName = () => {
    if (!pendingDrop) return '';
    const tech = technicians.find(t => t.id === pendingDrop.targetTechnicianId);
    return tech?.name || 'un autre technicien';
  };

  const periods = ['Matin', 'Après-midi'];

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

  const handleAddTechnician = (name: string, isTemp: boolean) => {
    createTechnician.mutate({ name, isTemp }, {
      onSuccess: () => {
        toast.success(`Technicien ${name} ajouté`);
      },
      onError: () => {
        toast.error("Erreur lors de l'ajout du technicien");
      },
    });
  };

  const handleUpdateTechnicianName = (id: string, name?: string, is_interim?: boolean) => {
    updateTechnician.mutate({ id, name, is_interim }, {
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

  const handleAddNote = (technicianId: string, date: string, period: string) => {
    setSelectedNote({
      id: '',
      text: '',
      technician_id: technicianId,
      start_date: date,
      end_date: date,
      start_period: period,
      end_period: period,
      period: period, // Keep for backward compatibility
      is_sav: false,
    });
    setNoteDialogOpen(true);
  };

  const handleCellClick = (technicianId: string, date: string, period: string) => {
    const existing = assignments.find(
      (a) => a.technician_id === technicianId && a.start_date === date && a.start_period === period
    );
    
    if (existing) {
      setSelectedAssignment({
        id: existing.id,
        teamId: existing.technician_id,
        chantierId: existing.chantier_id,
        commandeId: existing.commande_id,
        name: existing.name,
        startDate: existing.start_date,
        startPeriod: existing.start_period as 'Matin' | 'Après-midi',
        endDate: existing.end_date,
        endPeriod: existing.end_period as 'Matin' | 'Après-midi',
        isFixed: existing.is_fixed || false,
        isValid: true,
        comment: existing.comment || undefined,
        assignment_group_id: existing.assignment_group_id,
      });
      setAssignmentDialogOpen(true);
    } else {
      const firstCommande = commandes[0];
      const periodValue = period as 'Matin' | 'Après-midi';
      const newAssignment: Assignment = {
        id: `new-${Date.now()}`,
        teamId: technicianId,
        chantierId: null,
        commandeId: firstCommande?.id || null,
        name: firstCommande ? `${firstCommande.client} - ${firstCommande.chantier}` : '',
        startDate: date,
        startPeriod: periodValue,
        endDate: date,
        endPeriod: periodValue,
        isFixed: false,
        isValid: true,
      };
      setSelectedAssignment(newAssignment);
      setAssignmentDialogOpen(true);
    }
  };

  const handleAddAssignment = (technicianId: string, date: string, period: string) => {
    // Always create a new assignment, regardless of existing ones
    const firstCommande = commandes[0];
    // Use the clicked period as both start and end period (single half-day assignment by default)
    const periodValue = period as 'Matin' | 'Après-midi';
    const newAssignment: Assignment = {
      id: `new-${Date.now()}`,
      teamId: technicianId,
      chantierId: null,
      commandeId: firstCommande?.id || null,
      name: firstCommande ? `${firstCommande.client} - ${firstCommande.chantier}` : '',
      startDate: date,
      startPeriod: periodValue,
      endDate: date,
      endPeriod: periodValue,
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
    // Find the commande to get the current name
    const commande = updatedAssignment.commandeId ? commandes.find(c => c.id === updatedAssignment.commandeId) : null;
    const assignmentName = updatedAssignment.isAbsent ? 'Absent' : (commande ? `${commande.client} - ${commande.chantier}` : updatedAssignment.name);

    // If editing an existing assignment, update it and its related assignments if it's part of a group
    if (updatedAssignment.id && !updatedAssignment.id.startsWith('new-')) {
      // First, get the original assignment from database to check for group_id
      const originalAssignment = assignments.find(a => a.id === updatedAssignment.id);
      
      const dbAssignment = {
        id: updatedAssignment.id,
        technician_id: updatedAssignment.teamId,
        chantier_id: null,
        commande_id: updatedAssignment.commandeId,
        name: assignmentName,
        start_date: updatedAssignment.startDate,
        start_period: updatedAssignment.startPeriod,
        end_date: updatedAssignment.endDate,
        end_period: updatedAssignment.endPeriod,
        is_fixed: updatedAssignment.isFixed,
        comment: updatedAssignment.comment,
        is_absent: updatedAssignment.isAbsent || false,
        is_confirmed: updatedAssignment.isConfirmed || false,
      };

      // Check if this assignment is part of a group and we're NOT in single edit mode
      if (originalAssignment?.assignment_group_id && !editSingleMode) {
        // Update the primary assignment first
        await new Promise((resolve, reject) => {
          saveAssignment.mutate(dbAssignment, {
            onSuccess: resolve,
            onError: reject,
          });
        });

        // Then update all related assignments in the group with common fields
        // NOTE: Do NOT include technician_id - each assignment keeps its own technician
        // This allows linked assignments (e.g., two technicians on same job) to remain linked
        const groupUpdates = {
          chantier_id: null,
          commande_id: updatedAssignment.commandeId,
          name: assignmentName,
          is_fixed: updatedAssignment.isFixed,
          comment: updatedAssignment.comment,
          is_absent: updatedAssignment.isAbsent || false,
          is_confirmed: updatedAssignment.isConfirmed || false,
        };

        updateRelatedAssignments.mutate(
          {
            groupId: originalAssignment.assignment_group_id,
            updates: groupUpdates,
          },
          {
            onSuccess: () => {
              toast.success('Affectation et groupe mis à jour');
              setAssignmentDialogOpen(false);
              setEditSingleMode(false);
            },
            onError: () => {
              toast.error("Erreur lors de la mise à jour du groupe");
              setEditSingleMode(false);
            },
          }
        );
      } else {
        // Single assignment OR editing single mode - only update this assignment
        // If editing single and was part of group, remove from group
        const groupId = originalAssignment?.assignment_group_id;
        const finalDbAssignment = editSingleMode && groupId
          ? { ...dbAssignment, assignment_group_id: null }
          : dbAssignment;
        
        // Check if we need to add a second technician for an existing assignment
        if (updatedAssignment.secondTechnicianId && !groupId) {
          // Create a new assignment for the second technician
          const secondTechAssignment = {
            technician_id: updatedAssignment.secondTechnicianId,
            chantier_id: null,
            commande_id: updatedAssignment.commandeId,
            name: assignmentName,
            start_date: updatedAssignment.startDate,
            start_period: updatedAssignment.startPeriod,
            end_date: updatedAssignment.endDate,
            end_period: updatedAssignment.endPeriod,
            is_fixed: updatedAssignment.isFixed,
            comment: updatedAssignment.comment,
            is_absent: updatedAssignment.isAbsent || false,
            is_confirmed: updatedAssignment.isConfirmed || false,
            assignment_group_id: crypto.randomUUID(),
            second_technician_id: updatedAssignment.teamId,
          };
          
          // Update primary assignment with new group ID
          const primaryWithGroup = {
            ...finalDbAssignment,
            assignment_group_id: secondTechAssignment.assignment_group_id,
            second_technician_id: updatedAssignment.secondTechnicianId,
          };
          
          try {
            // Save primary assignment
            await new Promise((resolve, reject) => {
              saveAssignment.mutate(primaryWithGroup, {
                onSuccess: resolve,
                onError: reject,
              });
            });
            // Save second technician assignment
            await new Promise((resolve, reject) => {
              saveAssignment.mutate(secondTechAssignment, {
                onSuccess: resolve,
                onError: reject,
              });
            });
            toast.success('Affectation mise à jour avec deuxième technicien');
            setAssignmentDialogOpen(false);
            setEditSingleMode(false);
          } catch (error) {
            toast.error("Erreur lors de l'enregistrement");
            setEditSingleMode(false);
          }
          return;
        }
        
        // Regular save without second technician
        saveAssignment.mutate(finalDbAssignment, {
          onSuccess: async () => {
            // If we detached from a group, check if the remaining group has only one member
            if (editSingleMode && groupId) {
              const remainingInGroup = assignments.filter(
                a => a.assignment_group_id === groupId && a.id !== updatedAssignment.id
              );
              if (remainingInGroup.length === 1) {
                // Remove group_id from the last remaining member
                await supabase
                  .from('assignments')
                  .update({ assignment_group_id: null })
                  .eq('id', remainingInGroup[0].id);
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

    // For new assignments, split into multiple half-day assignments with a group ID
    const startDate = new Date(updatedAssignment.startDate);
    const endDate = new Date(updatedAssignment.endDate);
    const assignmentsToCreate = [];
    
    // Generate a group ID if we're creating multiple assignments OR if there's a second technician
    const isMultiPeriod = startDate < endDate || 
      (startDate.getTime() === endDate.getTime() && 
       updatedAssignment.startPeriod === 'Matin' && 
       updatedAssignment.endPeriod === 'Après-midi');
    
    const hasSecondTechnician = !!updatedAssignment.secondTechnicianId;
    const needsGroupId = isMultiPeriod || hasSecondTechnician;
    const groupId = needsGroupId ? crypto.randomUUID() : null;

    // Get list of technicians (primary + optional second)
    const technicianIds = [updatedAssignment.teamId];
    if (updatedAssignment.secondTechnicianId) {
      technicianIds.push(updatedAssignment.secondTechnicianId);
    }

    const currentDate = new Date(startDate);
    let currentPeriod = updatedAssignment.startPeriod;

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const isLastDay = currentDate.getTime() === endDate.getTime();
      
      // Determine if we should create this half-day assignment
      const isFirstDay = currentDate.getTime() === startDate.getTime();
      const shouldCreate = 
        (isFirstDay && isLastDay) || // Single day assignment
        (isFirstDay && (
          (updatedAssignment.startPeriod === 'Matin') || 
          (updatedAssignment.startPeriod === 'Après-midi' && currentPeriod === 'Après-midi')
        )) || // First day, from start period onwards
        (!isFirstDay && !isLastDay) || // Middle days, all periods
        (isLastDay && (currentPeriod === 'Matin' || updatedAssignment.endPeriod === 'Après-midi')); // Last day logic

      if (shouldCreate) {
        const isLast = isLastDay && (
          (updatedAssignment.endPeriod === 'Matin' && currentPeriod === 'Matin') ||
          (updatedAssignment.endPeriod === 'Après-midi' && currentPeriod === 'Après-midi')
        );

        // Create assignment for each technician in this period
        for (const techId of technicianIds) {
          assignmentsToCreate.push({
            technician_id: techId,
            chantier_id: null,
            commande_id: updatedAssignment.commandeId,
            name: assignmentName,
            start_date: dateStr,
            start_period: currentPeriod,
            end_date: dateStr,
            end_period: currentPeriod,
            is_fixed: updatedAssignment.isFixed,
            comment: updatedAssignment.comment,
            is_absent: updatedAssignment.isAbsent || false,
            is_confirmed: updatedAssignment.isConfirmed || false,
            assignment_group_id: groupId,
            second_technician_id: technicianIds.length > 1 ? technicianIds.find(id => id !== techId) : null,
          });
        }

        if (isLast) break;
      }

      // Move to next period
      if (currentPeriod === 'Matin') {
        currentPeriod = 'Après-midi';
      } else {
        currentPeriod = 'Matin';
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Save all assignments
    try {
      for (const assignment of assignmentsToCreate) {
        await new Promise((resolve, reject) => {
          saveAssignment.mutate(assignment, {
            onSuccess: resolve,
            onError: reject,
          });
        });
      }
      toast.success(`${assignmentsToCreate.length} affectation(s) créée(s)`);
      setAssignmentDialogOpen(false);
    } catch (error) {
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

  // Handler for toggling note confirmation status
  const handleToggleNoteConfirm = (noteId: string, isConfirmed: boolean) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    saveNote.mutate({
      id: noteId,
      text: note.text,
      technician_id: note.technician_id,
      start_date: note.start_date,
      end_date: note.end_date || note.start_date,
      period: note.period,
      start_period: note.start_period || note.period,
      end_period: note.end_period || note.period,
      is_sav: note.is_sav,
      is_confirmed: isConfirmed,
    }, {
      onSuccess: () => {
        toast.success(isConfirmed ? 'Note confirmée' : 'Note non confirmée');
      },
      onError: () => {
        toast.error('Erreur lors de la mise à jour');
      },
    });
  };

  // Handler for toggling note display_below status
  const handleToggleNoteDisplayBelow = (noteId: string, displayBelow: boolean) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    saveNote.mutate({
      id: noteId,
      text: note.text,
      technician_id: note.technician_id,
      start_date: note.start_date,
      end_date: note.end_date || note.start_date,
      period: note.period,
      start_period: note.start_period || note.period,
      end_period: note.end_period || note.period,
      is_sav: note.is_sav,
      is_confirmed: note.is_confirmed,
      display_below: displayBelow,
    }, {
      onSuccess: () => {
        toast.success(displayBelow ? 'Note déplacée en bas' : 'Note déplacée en haut');
      },
      onError: () => {
        toast.error('Erreur lors de la mise à jour');
      },
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
    // Swap by re-saving both assignments with swapped order
    // We'll use the order they appear in the cell - swap their IDs conceptually
    // For now, we can swap their start_date/start_period to change their order
    // But actually the simplest approach is to just swap them in the database
    // by updating one to have a temporary value, then updating both
    
    // Get full assignment data from database
    const dbAssignment1 = assignments.find(a => a.id === assignment1.id);
    const dbAssignment2 = assignments.find(a => a.id === assignment2.id);
    
    if (!dbAssignment1 || !dbAssignment2) return;
    
    // Swap the created_at timestamps to change their order
    // This is a simple way to reorder without adding a position column
    const now = new Date();
    const temp1CreatedAt = dbAssignment1.created_at;
    
    // Update first assignment with new timestamp
    saveAssignment.mutate({
      id: dbAssignment1.id,
      technician_id: dbAssignment1.technician_id,
      commande_id: dbAssignment1.commande_id,
      name: dbAssignment1.name,
      start_date: dbAssignment1.start_date,
      start_period: dbAssignment1.start_period,
      end_date: dbAssignment1.end_date,
      end_period: dbAssignment1.end_period,
      is_fixed: dbAssignment1.is_fixed,
      comment: dbAssignment1.comment,
      is_absent: dbAssignment1.is_absent,
      absence_reason: dbAssignment1.absence_reason,
      is_confirmed: dbAssignment1.is_confirmed,
      second_technician_id: dbAssignment1.second_technician_id,
      assignment_group_id: dbAssignment1.assignment_group_id,
      updated_at: now.toISOString(), // Force update to reorder
    });
    
    // Update second assignment with slightly earlier timestamp
    saveAssignment.mutate({
      id: dbAssignment2.id,
      technician_id: dbAssignment2.technician_id,
      commande_id: dbAssignment2.commande_id,
      name: dbAssignment2.name,
      start_date: dbAssignment2.start_date,
      start_period: dbAssignment2.start_period,
      end_date: dbAssignment2.end_date,
      end_period: dbAssignment2.end_period,
      is_fixed: dbAssignment2.is_fixed,
      comment: dbAssignment2.comment,
      is_absent: dbAssignment2.is_absent,
      absence_reason: dbAssignment2.absence_reason,
      is_confirmed: dbAssignment2.is_confirmed,
      second_technician_id: dbAssignment2.second_technician_id,
      assignment_group_id: dbAssignment2.assignment_group_id,
      updated_at: new Date(now.getTime() - 1000).toISOString(), // 1 second earlier
    });
    
    toast.success('Ordre modifié');
  };

  // Get assignments for a cell to find the one above/below
  const handleAssignmentMoveUp = (assignment: Assignment, technicianId: string, date: string, period: string) => {
    const cellAssignments = getAssignmentsForCell(technicianId, date, period);
    const index = cellAssignments.findIndex(a => a.id === assignment.id);
    if (index > 0) {
      handleAssignmentSwap(cellAssignments[index], cellAssignments[index - 1]);
    }
  };

  const handleAssignmentMoveDown = (assignment: Assignment, technicianId: string, date: string, period: string) => {
    const cellAssignments = getAssignmentsForCell(technicianId, date, period);
    const index = cellAssignments.findIndex(a => a.id === assignment.id);
    if (index < cellAssignments.length - 1) {
      handleAssignmentSwap(cellAssignments[index], cellAssignments[index + 1]);
    }
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

  // Get week notes for a specific technician (notes spanning the entire week)
  // Get day notes for a specific technician on a specific date (single-day notes)
  const getDayNotesForTechnician = (technicianId: string, date: string) => {
    return notes.filter((n) => {
      if (n.technician_id !== technicianId) return false;
      // Check if note is for this specific day (single day, full day)
      const noteEndDate = n.end_date || n.start_date;
      const noteStartPeriod = n.start_period || 'Matin';
      const noteEndPeriod = n.end_period || 'Après-midi';
      return n.start_date === date && 
             noteEndDate === date && 
             noteStartPeriod === 'Matin' && 
             noteEndPeriod === 'Après-midi';
    });
  };

  const getAssignmentsForCell = (technicianId: string, date: string, period: string): Assignment[] => {
    const dbAssignments = assignments.filter(
      (a) => a.technician_id === technicianId && a.start_date === date && a.start_period === period
    );
    
    return dbAssignments.map(dbAssignment => ({
      id: dbAssignment.id,
      teamId: dbAssignment.technician_id,
      chantierId: dbAssignment.chantier_id,
      commandeId: dbAssignment.commande_id,
      name: dbAssignment.name,
      startDate: dbAssignment.start_date,
      startPeriod: dbAssignment.start_period as 'Matin' | 'Après-midi',
      endDate: dbAssignment.end_date,
      endPeriod: dbAssignment.end_period as 'Matin' | 'Après-midi',
      isFixed: dbAssignment.is_fixed || false,
      isValid: true,
      comment: dbAssignment.comment || undefined,
      isAbsent: dbAssignment.is_absent || false,
      isConfirmed: dbAssignment.is_confirmed || false,
      assignment_group_id: dbAssignment.assignment_group_id,
      absence_reason: dbAssignment.absence_reason,
    }));
  };

  // Memoized list of all assignments in Assignment format for linked technician lookup
  const allAssignmentsFormatted: Assignment[] = assignments.map(dbAssignment => ({
    id: dbAssignment.id,
    teamId: dbAssignment.technician_id,
    chantierId: dbAssignment.chantier_id,
    commandeId: dbAssignment.commande_id,
    name: dbAssignment.name,
    startDate: dbAssignment.start_date,
    startPeriod: dbAssignment.start_period as 'Matin' | 'Après-midi',
    endDate: dbAssignment.end_date,
    endPeriod: dbAssignment.end_period as 'Matin' | 'Après-midi',
    isFixed: dbAssignment.is_fixed || false,
    isValid: true,
    comment: dbAssignment.comment || undefined,
    isAbsent: dbAssignment.is_absent || false,
    isConfirmed: dbAssignment.is_confirmed || false,
    assignment_group_id: dbAssignment.assignment_group_id,
    absence_reason: dbAssignment.absence_reason,
  }));

  const getNotesForCell = (technicianId: string, date: string, period: string) => {
    return notes.filter((n) => {
      if (n.technician_id !== technicianId) return false;
      
      // Check if the cell's date and period falls within the note's date and period range
      const cellDate = date;
      const cellPeriod = period;
      const noteStartDate = n.start_date;
      const noteEndDate = n.end_date || n.start_date;
      const noteStartPeriod = n.start_period || n.period || 'Matin';
      const noteEndPeriod = n.end_period || n.period || 'Après-midi';
      
      // Exclude day-level notes (single day, full day) - these are shown in TechnicianDayCell
      if (noteStartDate === noteEndDate && 
          noteStartPeriod === 'Matin' && 
          noteEndPeriod === 'Après-midi') {
        return false;
      }
      
      // If cell date is before note start or after note end, return false
      if (cellDate < noteStartDate || cellDate > noteEndDate) return false;
      
      // If same day range, check periods
      if (noteStartDate === noteEndDate) {
        // Single day note
        if (cellDate === noteStartDate) {
          // Both periods if start is Matin and end is Après-midi
          if (noteStartPeriod === 'Matin' && noteEndPeriod === 'Après-midi') {
            return true;
          }
          // Only matching period
          return cellPeriod === noteStartPeriod;
        }
        return false;
      }
      
      // Multi-day note
      if (cellDate === noteStartDate) {
        // First day: from start period onwards
        return noteStartPeriod === 'Matin' || cellPeriod === 'Après-midi';
      } else if (cellDate === noteEndDate) {
        // Last day: up to end period
        return noteEndPeriod === 'Après-midi' || cellPeriod === 'Matin';
      } else {
        // Middle days: all periods
        return cellDate > noteStartDate && cellDate < noteEndDate;
      }
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

  // Issue #1 & #6: Define core technicians that should ALWAYS be displayed (minimum 4 columns)
  const coreTechnicianNames = ['Ludo', 'Vincent', 'David', 'Yohann'];
  const coreTechnicians = coreTechnicianNames
    .map(name => technicians.find(tech => tech.name === name))
    .filter((tech): tech is (typeof technicians)[number] => !!tech)
    .sort((a, b) => coreTechnicianNames.indexOf(a.name) - coreTechnicianNames.indexOf(b.name));
  
  // Get other technicians with assignments or notes in this week
  const otherTechnicians = activeTechnicians.filter(tech => 
    !coreTechnicianNames.includes(tech.name) &&
    (
      assignments.some((a) => 
        a.technician_id === tech.id && 
        weekDates.some((d) => {
          const dayDate = d.fullDate;
          return dayDate >= a.start_date && dayDate <= a.end_date;
        })
      ) ||
      notes.some((n) => 
        n.technician_id === tech.id && 
        weekDates.some((d) => {
          const dayDate = d.fullDate;
          const noteEndDate = n.end_date || n.start_date;
          return dayDate >= n.start_date && dayDate <= noteEndDate;
        })
      )
    )
  );

  // Combine: always show core technicians first (4 columns), then add others with assignments
  const displayTechnicians = [...coreTechnicians, ...otherTechnicians];

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
          {/* SAV Table - Above position */}
          {savAbove && savRecords.length > 0 && (
            <SAVTable
              savRecords={savRecords}
              weekStart={weekStart}
              isAbove={savAbove}
              onTogglePosition={() => setSavAbove(false)}
              isAdmin={isAdmin}
            />
          )}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr,300px] gap-4 lg:gap-6">
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
                savAbove={savAbove}
                setSavAbove={setSavAbove}
                handleSignOut={handleSignOut}
              />
              <CardContent className="p-0 max-h-[calc(100vh-12rem)] overflow-y-auto">
                <WeeklyGrid
                  displayTechnicians={displayTechnicians}
                  activeTechnicians={activeTechnicians}
                  weekDates={weekDates}
                  periods={periods}
                  notes={notes}
                  commandes={commandes}
                  chantiers={chantiers}
                  isAdmin={isAdmin}
                  maxAssignments={maxAssignments}
                  allAssignmentsFormatted={allAssignmentsFormatted}
                  getGeneralNotesForDate={getGeneralNotesForDate}
                  getDayNotesForTechnician={getDayNotesForTechnician}
                  getAssignmentsForCell={getAssignmentsForCell}
                  getNotesForCell={getNotesForCell}
                  setManageTechsDialogOpen={setManageTechsDialogOpen}
                  handleAddGeneralNote={handleAddGeneralNote}
                  handleGeneralNoteClick={handleGeneralNoteClick}
                  handleAddTechDayNote={handleAddTechDayNote}
                  handleTechDayNoteClick={handleTechDayNoteClick}
                  saveNote={saveNote}
                  handleDeleteNote={handleDeleteNote}
                  handleToggleNoteConfirm={handleToggleNoteConfirm}
                  handleNoteDragStart={handleNoteDragStart}
                  handleNoteDragOver={handleNoteDragOver}
                  handleNoteDrop={handleNoteDrop}
                  handleNoteDragEnd={handleNoteDragEnd}
                  noteDropTarget={noteDropTarget}
                  isNoteDragging={isNoteDragging}
                  handleCellClick={handleCellClick}
                  handleNoteClick={handleNoteClick}
                  handleToggleNoteDisplayBelow={handleToggleNoteDisplayBelow}
                  handleBulkToggleNotesDisplayBelow={handleBulkToggleNotesDisplayBelow}
                  handleAddNote={handleAddNote}
                  handleAddAssignment={handleAddAssignment}
                  handleAssignmentClick={handleAssignmentClick}
                  handleDuplicateAssignment={handleDuplicateAssignment}
                  handleDeleteAssignment={handleDeleteAssignment}
                  handleAssignmentMoveUp={handleAssignmentMoveUp}
                  handleAssignmentMoveDown={handleAssignmentMoveDown}
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

          <Card className="shadow-lg h-fit">
            <CardHeader className="bg-accent/5 border-b">
              <CardTitle className="text-lg text-center flex items-center justify-center gap-2">
                Marges
                {projectMargins.length > 0 && (
                <span className="text-base font-bold text-primary">
                    ({projectMargins.reduce((sum, m) => {
                      const numericValue = parseFloat(m.amount.replace(/[^\d.,-]/g, '').replace(',', '.'));
                      return sum + (isNaN(numericValue) ? 0 : numericValue);
                    }, 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {projectMargins.length > 0 ? (
                projectMargins.map((margin, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg bg-muted/50 border border-border hover:shadow-md transition-shadow"
                  >
                    <div className="font-medium text-sm mb-1 text-foreground">
                      {margin.name.includes(' - F-') ? (
                        <>
                          <span className="break-words">{margin.name.split(' - F-')[0]}</span>
                          {' '}
                          <span className="whitespace-nowrap">F-{margin.name.split(' - F-')[1]}</span>
                        </>
                      ) : (
                        <span className="break-words">{margin.name}</span>
                      )}
                    </div>
                    <div className="text-lg font-bold text-primary">{margin.amount}</div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune affectation cette semaine
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* SAV Table - Below position */}
        {!savAbove && savRecords.length > 0 && (
          <SAVTable
            savRecords={savRecords}
            weekStart={weekStart}
            isAbove={savAbove}
            onTogglePosition={() => setSavAbove(true)}
            isAdmin={isAdmin}
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
          commandes={commandes} // Issue #3: Pass commandes for address lookup
          technicians={activeTechnicians.map((t) => ({ id: t.id, name: t.name }))}
          assignments={assignments.map(a => ({
            id: a.id,
            teamId: a.technician_id,
            chantierId: a.chantier_id,
            commandeId: a.commande_id,
            name: a.name,
            startDate: a.start_date,
            startPeriod: a.start_period as 'Matin' | 'Après-midi',
            endDate: a.end_date,
            endPeriod: a.end_period as 'Matin' | 'Après-midi',
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

        <TechnicianManagementDialog
          open={manageTechsDialogOpen}
          onOpenChange={setManageTechsDialogOpen}
          technicians={technicians.map((t) => ({ 
            id: t.id, 
            name: t.name, 
            is_archived: t.is_archived || false,
            position: t.position ?? 0,
          }))}
          onArchive={handleArchiveTechnician}
          onNameChange={handleUpdateTechnicianName}
          onAdd={handleAddTechnician}
          onReorder={(positions) => updateTechnicianPositions.mutate(positions)}
        />

        <SendScheduleDialog
          open={sendScheduleOpen}
          onOpenChange={setSendScheduleOpen}
          weekNumber={weekConfig.week_number}
          year={weekConfig.year}
          technicians={displayTechnicians}
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
              <AlertDialogTitle>Déplacer vers un autre technicien</AlertDialogTitle>
              <AlertDialogDescription>
                Voulez-vous vraiment déplacer cette affectation vers {getTargetTechnicianName()} ?
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

        {/* Linked technician drop confirmation dialog */}
        <AlertDialog open={!!linkedTechPendingDrop} onOpenChange={(open) => !open && cancelLinkedTechPendingDrop()}>
          <AlertDialogContent className="bg-card sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Affectation liée à d'autres techniciens</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span>Cette affectation est liée à : {linkedTechPendingDrop?.linkedTechnicianNames.join(', ')}.</span>
                <br />
                <span className="font-medium">« Celle-ci uniquement »</span> détachera l'affectation du groupe et la déplacera indépendamment.
                <br />
                <span className="font-medium">« Toutes les liées »</span> déplacera toutes les affectations vers la même date/période.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
              <AlertDialogCancel onClick={cancelLinkedTechPendingDrop} className="w-full sm:w-auto">
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
