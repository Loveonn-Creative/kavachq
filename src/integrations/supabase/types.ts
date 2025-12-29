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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      emergency_contacts: {
        Row: {
          created_at: string
          device_id: string
          id: string
          is_primary: boolean | null
          name: string
          phone: string
          relationship: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          is_primary?: boolean | null
          name: string
          phone: string
          relationship?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          is_primary?: boolean | null
          name?: string
          phone?: string
          relationship?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      emergency_events: {
        Row: {
          created_at: string
          device_id: string
          id: string
          location: Json | null
          notes: string | null
          resolved_at: string | null
          ride_session_id: string | null
          status: string
          trigger_type: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          location?: Json | null
          notes?: string | null
          resolved_at?: string | null
          ride_session_id?: string | null
          status?: string
          trigger_type: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          location?: Json | null
          notes?: string | null
          resolved_at?: string | null
          ride_session_id?: string | null
          status?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_events_ride_session_id_fkey"
            columns: ["ride_session_id"]
            isOneToOne: false
            referencedRelation: "ride_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      rest_stops: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          location: Json
          name: string | null
          stop_type: string
          verified: boolean | null
          visits_count: number | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          location: Json
          name?: string | null
          stop_type: string
          verified?: boolean | null
          visits_count?: number | null
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          location?: Json
          name?: string | null
          stop_type?: string
          verified?: boolean | null
          visits_count?: number | null
        }
        Relationships: []
      }
      ride_sessions: {
        Row: {
          created_at: string
          device_id: string
          duration_seconds: number | null
          end_location: Json | null
          ended_at: string | null
          id: string
          start_location: Json | null
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          device_id: string
          duration_seconds?: number | null
          end_location?: Json | null
          ended_at?: string | null
          id?: string
          start_location?: Json | null
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          device_id?: string
          duration_seconds?: number | null
          end_location?: Json | null
          ended_at?: string | null
          id?: string
          start_location?: Json | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      risk_events: {
        Row: {
          acknowledged: boolean | null
          created_at: string
          device_id: string
          event_type: string
          id: string
          location: Json | null
          message: string | null
          ride_session_id: string | null
          severity: string
          weather_data: Json | null
        }
        Insert: {
          acknowledged?: boolean | null
          created_at?: string
          device_id: string
          event_type: string
          id?: string
          location?: Json | null
          message?: string | null
          ride_session_id?: string | null
          severity?: string
          weather_data?: Json | null
        }
        Update: {
          acknowledged?: boolean | null
          created_at?: string
          device_id?: string
          event_type?: string
          id?: string
          location?: Json | null
          message?: string | null
          ride_session_id?: string | null
          severity?: string
          weather_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_events_ride_session_id_fkey"
            columns: ["ride_session_id"]
            isOneToOne: false
            referencedRelation: "ride_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      unsafe_zones: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          location: Json
          radius_meters: number
          reports_count: number | null
          risk_type: string
          severity: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          location: Json
          radius_meters?: number
          reports_count?: number | null
          risk_type: string
          severity?: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          location?: Json
          radius_meters?: number
          reports_count?: number | null
          risk_type?: string
          severity?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
