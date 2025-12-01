export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: string
          province_id: string | null
          district_id: string | null
          directorate_id: string | null
          assigned_by: string | null
          can_assign_roles: boolean
          max_assignable_level: string | null
          is_active: boolean
          activated_at: string
          deactivated_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: string
          province_id?: string | null
          district_id?: string | null
          directorate_id?: string | null
          assigned_by?: string | null
          can_assign_roles?: boolean
          max_assignable_level?: string | null
          is_active?: boolean
          activated_at?: string
          deactivated_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: string
          province_id?: string | null
          district_id?: string | null
          directorate_id?: string | null
          assigned_by?: string | null
          can_assign_roles?: boolean
          max_assignable_level?: string | null
          is_active?: boolean
          activated_at?: string
          deactivated_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      provinces: {
        Row: {
          id: string
          name: string
          province_number: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          province_number: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          province_number?: number
          created_at?: string
        }
        Relationships: []
      }
      districts: {
        Row: {
          id: string
          name: string
          district_code: string
          province_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          district_code: string
          province_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          district_code?: string
          province_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "districts_province_id_fkey"
            columns: ["province_id"]
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          }
        ]
      }
      directorates: {
        Row: {
          id: string
          name: string
          code: string
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          description: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          description?: string
          created_at?: string
        }
        Relationships: []
      }
      data_entry_schemas: {
        Row: {
          id: string
          schema_name: string
          category: string
          version: number
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          schema_name: string
          category: string
          version?: number
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          schema_name?: string
          category?: string
          version?: number
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_entry_schemas_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      schema_fields: {
        Row: {
          id: string
          schema_id: string
          field_name: string
          display_label: string
          field_type: string
          parent_field_id: string | null
          field_order: number
          is_required: boolean
          min_value: number | null
          max_value: number | null
          default_value: string | null
          validation_regex: string | null
          is_calculated: boolean
          calculation_formula: string | null
          help_text: string | null
          placeholder: string | null
          unit: string | null
          created_at: string
        }
        Insert: {
          id?: string
          schema_id: string
          field_name: string
          display_label: string
          field_type: string
          parent_field_id?: string | null
          field_order?: number
          is_required?: boolean
          min_value?: number | null
          max_value?: number | null
          default_value?: string | null
          validation_regex?: string | null
          is_calculated?: boolean
          calculation_formula?: string | null
          help_text?: string | null
          placeholder?: string | null
          unit?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          schema_id?: string
          field_name?: string
          display_label?: string
          field_type?: string
          parent_field_id?: string | null
          field_order?: number
          is_required?: boolean
          min_value?: number | null
          max_value?: number | null
          default_value?: string | null
          validation_regex?: string | null
          is_calculated?: boolean
          calculation_formula?: string | null
          help_text?: string | null
          placeholder?: string | null
          unit?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schema_fields_schema_id_fkey"
            columns: ["schema_id"]
            referencedRelation: "data_entry_schemas"
            referencedColumns: ["id"]
          }
        ]
      }
      dynamic_data_entries: {
        Row: {
          id: string
          schema_id: string
          province_id: string | null
          district_id: string | null
          month: number
          year: number
          data: Json
          status: string
          entered_by: string | null
          submitted_at: string | null
          approved_by: string | null
          approved_at: string | null
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          schema_id: string
          province_id?: string | null
          district_id?: string | null
          month: number
          year: number
          data?: Json
          status?: string
          entered_by?: string | null
          submitted_at?: string | null
          approved_by?: string | null
          approved_at?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          schema_id?: string
          province_id?: string | null
          district_id?: string | null
          month?: number
          year?: number
          data?: Json
          status?: string
          entered_by?: string | null
          submitted_at?: string | null
          approved_by?: string | null
          approved_at?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dynamic_data_entries_entered_by_fkey"
            columns: ["entered_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dynamic_data_entries_schema_id_fkey"
            columns: ["schema_id"]
            referencedRelation: "data_entry_schemas"
            referencedColumns: ["id"]
          }
        ]
      }
      // Add other tables as needed...
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      admin_level: "super_admin" | "province_admin" | "directorate_admin" | "district_admin" | "viewer"
      field_type: "text" | "integer" | "decimal" | "currency" | "percentage" | "date" | "dropdown" | "vehicle_number" | "phone_number" | "email"
    }
  }
}