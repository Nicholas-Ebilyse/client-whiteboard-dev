import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getWeek, getYear, startOfWeek, addDays, format } from 'date-fns';
import { scheduleDebouncedCalendarSync } from '@/hooks/useGoogleCalendarSync';
import { fr } from 'date-fns/locale';

export const useWeekConfig = () => {
  return useQuery({
    queryKey: ['week-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('week_config')
        .select('*')
        .eq('is_current', true)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      // If no config exists, create one with current week
      if (!data) {
        const currentDate = new Date();
        const weekNumber = getWeek(currentDate, { weekStartsOn: 1 });
        const year = getYear(currentDate);
        
        const { data: newData, error: insertError } = await supabase
          .from('week_config')
          .insert({ week_number: weekNumber, year, is_current: true })
          .select()
          .single();
        
        if (insertError) throw insertError;
        return newData;
      }
      
      return data;
    },
  });
};

export const useUpdateWeekConfig = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ week_number, year }: { week_number: number; year: number }) => {
      const { data, error } = await supabase
        .from('week_config')
        .update({ week_number, year })
        .eq('is_current', true)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['week-config'] });
    },
  });
};

export const useTechnicians = (includeArchived = false) => {
  return useQuery({
    queryKey: ['technicians', includeArchived],
    queryFn: async () => {
      let query = supabase
        .from('technicians')
        .select('*')
        .order('position');
      
      if (!includeArchived) {
        query = query.eq('is_archived', false);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateTechnician = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ name, isTemp, skills }: { name: string; isTemp?: boolean; skills?: string }) => {
      const { data: existingTechs } = await supabase
        .from('technicians')
        .select('position')
        .order('position', { ascending: false })
        .limit(1);
      
      const maxPosition = existingTechs?.[0]?.position ?? -1;
      
      const { data, error } = await supabase
        .from('technicians')
        .insert({ name, position: maxPosition + 1, is_temp: isTemp || false, skills })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
    },
  });
};

export const useUpdateTechnician = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, name, is_temp, team_id, skills }: { id: string; name?: string; is_temp?: boolean; team_id?: string | null; skills?: string }) => {
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (is_temp !== undefined) updates.is_temp = is_temp;
      if (team_id !== undefined) updates.team_id = team_id;
      if (skills !== undefined) updates.skills = skills;

      const { data, error } = await supabase
        .from('technicians')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
    },
  });
};

export const useUpdateTechnicianPositions = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (positions: { id: string; position: number }[]) => {
      const updates = positions.map(({ id, position }) =>
        supabase.from('technicians').update({ position }).eq('id', id)
      );
      const results = await Promise.all(updates);
      const error = results.find((r) => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
    },
  });
};



export const useCommandes = () => {
  return useQuery({
    queryKey: ['commandes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commandes')
        .select('*')
        .order('client, chantier');
      
      if (error) throw error;
      return data;
    },
  });
};

// removed useBulkUpdateAssignmentName

export const useUpdateCommande = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, displayName }: { id: string; displayName: string }) => {
      const { data, error } = await supabase
        .from('commandes')
        .update({ display_name: displayName })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandes'] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
};
export const useAssignments = (weekStart: string, weekEnd: string) => {
  return useQuery({
    queryKey: ['assignments', weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select('*, commandes(display_name)')
        .lte('start_date', weekEnd)
        .gte('end_date', weekStart);
      
      if (error) throw error;
      return data;
    },
    enabled: !!weekStart && !!weekEnd,
  });
};


export const useNotes = (weekStart: string, weekEnd: string) => {
  return useQuery({
    queryKey: ['notes', weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .or(`and(start_date.lte.${weekEnd},end_date.gte.${weekStart})`);
      
      if (error) throw error;
      return data;
    },
    enabled: !!weekStart && !!weekEnd,
  });
};

export const useSaveAssignment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (assignment: any) => {
      const { id, teamId, commandeId, startDate, endDate, isFixed, comment, isConfirmed, assignment_group_id, ...rest } = assignment;
      
      const dbAssignment = {
        team_id: teamId ?? assignment.team_id,
        commande_id: commandeId ?? assignment.commande_id,
        start_date: startDate ?? assignment.start_date,
        end_date: endDate ?? assignment.end_date,
        is_fixed: isFixed ?? assignment.is_fixed,
        comment: comment ?? assignment.comment,
        is_confirmed: isConfirmed ?? assignment.is_confirmed ?? false,
        assignment_group_id: assignment_group_id
      };

      if (id && !id.startsWith('new-')) {
        const { data, error } = await supabase
          .from('assignments')
          .update(dbAssignment)
          .eq('id', id)
          .select()
          .single();
        
        if (error) {
          console.error('[useSaveAssignment] UPDATE error:', error);
          throw error;
        }
        return data;
      } else {
        console.log('[useSaveAssignment] INSERT payload:', JSON.stringify(dbAssignment, null, 2));
        const { data, error } = await supabase
          .from('assignments')
          .insert(dbAssignment)
          .select()
          .single();
        
        if (error) {
          console.error('[useSaveAssignment] INSERT error:', JSON.stringify(error, null, 2));
          console.error('[useSaveAssignment] INSERT payload was:', JSON.stringify(dbAssignment, null, 2));
          throw error;
        }
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      scheduleDebouncedCalendarSync();
    },
  });
};

export const useDeleteAssignment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      scheduleDebouncedCalendarSync();
    },
  });
};

export const useSaveNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (note: any) => {
      const dbNote: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
        team_id: note.team_id || note.teamId || note.technician_id || note.technicianId || null,
        start_date: note.start_date || note.startDate,
        end_date: note.end_date || note.endDate || note.start_date || note.startDate,
        text: note.text,
      };
      
      const id = note.id;
      if (id && !id.startsWith('new-')) {
        const { data, error } = await supabase
          .from('notes')
          .update(dbNote)
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('notes')
          .insert(dbNote)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      scheduleDebouncedCalendarSync();
    },
  });
};

export const useDeleteNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      scheduleDebouncedCalendarSync();
    },
  });
};

export const useAbsences = (weekStart?: string, weekEnd?: string) => {
  return useQuery({
    queryKey: ['absences', weekStart, weekEnd],
    queryFn: async () => {
      let query = supabase.from('absences').select('*, absence_motives(name)');
      if (weekStart && weekEnd) {
        query = query.lte('start_date', weekEnd).gte('end_date', weekStart);
      }
      const { data, error } = await query.order('start_date');
      if (error) throw error;
      return data;
    },
    enabled: true,
  });
};

export const useSaveAbsence = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (absence: { id?: string; technician_id: string; start_date: string; end_date: string; motive_id?: string | null }) => {
      const { id, ...rest } = absence;
      if (id) {
        const { data, error } = await supabase.from('absences').update(rest).eq('id', id).select().single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from('absences').insert(rest).select().single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absences'] }),
  });
};

export const useDeleteAbsence = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('absences').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absences'] }),
  });
};

// ─── Teams ───────────────────────────────────────────────────────────────────

export const useTeams = () => {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase.from('teams').select('*').order('position');
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }) => {
      const { data: existing } = await supabase.from('teams').select('position').order('position', { ascending: false }).limit(1);
      const maxPosition = existing?.[0]?.position ?? -1;
      const { data, error } = await supabase
        .from('teams')
        .insert({ name, color: color || '#EFF6FF', position: maxPosition + 1 })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });
};

export const useUpdateTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (color !== undefined) updates.color = color;
      const { data, error } = await supabase.from('teams').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });
};

export const useDeleteTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });
};

export const useUpdateTeamPositions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (positions: { id: string; position: number }[]) => {
      const results = await Promise.all(
        positions.map(({ id, position }) => supabase.from('teams').update({ position }).eq('id', id))
      );
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });
};



export const getWeekDates = (weekNumber: number, year: number) => {
  // Find the first Thursday of the year (ISO week definition)
  const jan4 = new Date(year, 0, 4);
  const firstMonday = startOfWeek(jan4, { weekStartsOn: 1 });
  
  // Add the appropriate number of weeks
  const weekStart = addDays(firstMonday, (weekNumber - 1) * 7);
  
  const dates = [];
  for (let i = 0; i < 5; i++) {
    const date = addDays(weekStart, i);
    dates.push({
      fullDate: format(date, 'yyyy-MM-dd'),
      date: format(date, 'EEEE d', { locale: fr }),
      dayName: format(date, 'EEEE', { locale: fr }),
    });
  }
  
  return dates;
};

export const useAbsenceMotives = () => {
  return useQuery({
    queryKey: ['absence_motives'],
    queryFn: async () => {
      const { data, error } = await supabase.from('absence_motives').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateAbsenceMotive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const { data, error } = await supabase.from('absence_motives').insert({ name }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence_motives'] }),
  });
};

export const useUpdateAbsenceMotive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase.from('absence_motives').update({ name }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence_motives'] }),
  });
};

export const useDeleteAbsenceMotive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('absence_motives').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence_motives'] }),
  });
};
