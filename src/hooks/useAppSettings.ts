import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AppSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const useAppSettings = () => {
  return useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');
      
      if (error) throw error;
      
      // Convert array to object for easy access
      const settings: Record<string, any> = {};
      (data || []).forEach((setting: AppSetting) => {
        settings[setting.setting_key] = setting.setting_value;
      });
      
      return settings;
    },
  });
};

export const useMaxAssignmentsPerPeriod = () => {
  const { data: settings, isLoading } = useAppSettings();
  
  // Default to 3 if not configured
  const maxAssignments = settings?.max_assignments_per_period ?? 3;
  
  return {
    maxAssignments: typeof maxAssignments === 'number' ? maxAssignments : parseInt(maxAssignments) || 3,
    isLoading,
  };
};

export const useUpdateAppSetting = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { data, error } = await supabase
        .from('app_settings')
        .update({ setting_value: value, updated_at: new Date().toISOString() })
        .eq('setting_key', key)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
    },
  });
};
