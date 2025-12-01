export type AdminLevel = 
  | 'super_admin' 
  | 'province_admin' 
  | 'directorate_admin' 
  | 'district_admin' 
  | 'viewer';

export type FieldType = 
  | 'text' 
  | 'integer' 
  | 'decimal' 
  | 'currency' 
  | 'percentage' 
  | 'date' 
  | 'dropdown' 
  | 'vehicle_number' 
  | 'phone_number' 
  | 'email';

export type DataEntryStatus = 
  | 'draft' 
  | 'submitted' 
  | 'approved' 
  | 'published';

export interface SchemaField {
  id: string;
  schema_id: string;
  field_name: string;
  display_label: string;
  field_type: FieldType;
  parent_field_id?: string | null;
  field_order: number;
  is_required: boolean;
  min_value?: number | null;
  max_value?: number | null;
  default_value?: string | null;
  validation_regex?: string | null;
  is_calculated: boolean;
  calculation_formula?: string | null;
  help_text?: string | null;
  placeholder?: string | null;
  unit?: string | null;
}

export interface DataEntrySchema {
  id: string;
  schema_name: string;
  category: 'nationwide' | 'province' | 'district' | 'imu';
  version: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DynamicDataEntry {
  id: string;
  schema_id: string;
  province_id?: string | null;
  district_id?: string | null;
  month: number;
  year: number;
  data: Record<string, any>;
  status: DataEntryStatus;
  entered_by: string;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AdminLevel;
  province_id?: string | null;
  district_id?: string | null;
  directorate_id?: string | null;
  assigned_by?: string | null;
  can_assign_roles: boolean;
  max_assignable_level?: AdminLevel | null;
  is_active: boolean;
  activated_at: string;
  deactivated_at?: string | null;
  created_at: string;
}

export interface RoleAssignmentAudit {
  id: string;
  action: 'ASSIGNED' | 'REMOVED' | 'MODIFIED';
  target_user_id: string;
  role_assigned: AdminLevel;
  assigned_by: string;
  province_id?: string | null;
  district_id?: string | null;
  reason?: string | null;
  timestamp: string;
}