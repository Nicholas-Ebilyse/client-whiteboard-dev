export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      absences: {
        Row: {
          created_at: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
          technician_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          technician_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      assignments: {
        Row: {
          absence_reason: string | null
          assignment_group_id: string | null
          chantier_id: string | null
          commande_id: string | null
          comment: string | null
          created_at: string | null
          end_date: string
          external_id: string | null
          id: string
          is_absent: boolean | null
          is_confirmed: boolean | null
          is_fixed: boolean | null
          name: string
          start_date: string
          team_id: string | null
          technician_id: string
          updated_at: string | null
        }
        Insert: {
          absence_reason?: string | null
          assignment_group_id?: string | null
          chantier_id?: string | null
          commande_id?: string | null
          comment?: string | null
          created_at?: string | null
          end_date: string
          external_id?: string | null
          id?: string
          is_absent?: boolean | null
          is_confirmed?: boolean | null
          is_fixed?: boolean | null
          name: string
          start_date: string
          team_id?: string | null
          technician_id: string
          updated_at?: string | null
        }
        Update: {
          absence_reason?: string | null
          assignment_group_id?: string | null
          chantier_id?: string | null
          commande_id?: string | null
          comment?: string | null
          created_at?: string | null
          end_date?: string
          external_id?: string | null
          id?: string
          is_absent?: boolean | null
          is_confirmed?: boolean | null
          is_fixed?: boolean | null
          name?: string
          start_date?: string
          team_id?: string | null
          technician_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      commandes: {
        Row: {
          achats: number | null
          chantier: string
          client: string
          created_at: string | null
          date: string | null
          external_id: string | null
          facture: string | null
          id: string
          is_invoiced: boolean
          montant_ht: number | null
          numero: string | null
          updated_at: string | null
        }
        Insert: {
          achats?: number | null
          chantier: string
          client: string
          created_at?: string | null
          date?: string | null
          external_id?: string | null
          facture?: string | null
          id?: string
          is_invoiced?: boolean
          montant_ht?: number | null
          numero?: string | null
          updated_at?: string | null
        }
        Update: {
          achats?: number | null
          chantier?: string
          client?: string
          created_at?: string | null
          date?: string | null
          external_id?: string | null
          facture?: string | null
          id?: string
          is_invoiced?: boolean
          montant_ht?: number | null
          numero?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      global_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          address: string | null
          attachments: string[] | null
          color: string
          created_at: string | null
          external_id: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          attachments?: string[] | null
          color?: string
          created_at?: string | null
          external_id?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          attachments?: string[] | null
          color?: string
          created_at?: string | null
          external_id?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          chantier_id: string | null
          created_at: string | null
          display_below: boolean
          end_date: string | null
          external_id: string | null
          id: string
          is_billed: boolean | null
          is_confirmed: boolean
          is_invoiced: boolean
          is_sav: boolean
          start_date: string
          technician_id: string | null
          text: string
          updated_at: string | null
        }
        Insert: {
          chantier_id?: string | null
          created_at?: string | null
          display_below?: boolean
          end_date?: string | null
          external_id?: string | null
          id?: string
          is_billed?: boolean | null
          is_confirmed?: boolean
          is_invoiced?: boolean
          is_sav?: boolean
          start_date: string
          technician_id?: string | null
          text: string
          updated_at?: string | null
        }
        Update: {
          chantier_id?: string | null
          created_at?: string | null
          display_below?: boolean
          end_date?: string | null
          external_id?: string | null
          id?: string
          is_billed?: boolean | null
          is_confirmed?: boolean
          is_invoiced?: boolean
          is_sav?: boolean
          start_date?: string
          technician_id?: string | null
          text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      sav: {
        Row: {
          adresse: string
          created_at: string
          date: string
          est_resolu: boolean
          external_id: string | null
          id: string
          nom_client: string
          numero: number
          probleme: string
          resolved_at: string | null
          resolved_week_start: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          adresse: string
          created_at?: string
          date: string
          est_resolu?: boolean
          external_id?: string | null
          id?: string
          nom_client: string
          numero: number
          probleme: string
          resolved_at?: string | null
          resolved_week_start?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string
          created_at?: string
          date?: string
          est_resolu?: boolean
          external_id?: string | null
          id?: string
          nom_client?: string
          numero?: number
          probleme?: string
          resolved_at?: string | null
          resolved_week_start?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_status: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_details: Json | null
          error_message: string | null
          id: string
          records_synced: number | null
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          records_synced?: number | null
          started_at?: string
          status?: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          records_synced?: number | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      technicians: {
        Row: {
          color: string
          created_at: string | null
          external_id: string | null
          id: string
          is_archived: boolean
          is_interim: boolean | null
          is_temp: boolean
          members: string | null
          name: string
          position: number
          skills: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          external_id?: string | null
          id?: string
          is_archived?: boolean
          is_interim?: boolean | null
          is_temp?: boolean
          members?: string | null
          name: string
          position?: number
          skills?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          external_id?: string | null
          id?: string
          is_archived?: boolean
          is_interim?: boolean | null
          is_temp?: boolean
          members?: string | null
          name?: string
          position?: number
          skills?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technicians_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          is_suspended: boolean
          role: Database["public"]["Enums"]["app_role"]
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_suspended?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_suspended?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      week_config: {
        Row: {
          created_at: string | null
          id: string
          is_current: boolean | null
          updated_at: string | null
          week_number: number
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_current?: boolean | null
          updated_at?: string | null
          week_number: number
          year: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_current?: boolean | null
          updated_at?: string | null
          week_number?: number
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
