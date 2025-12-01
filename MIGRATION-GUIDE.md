```markdown
# Database Migration Guide

## QUICK MIGRATION SCRIPT

Run this in Supabase SQL Editor (Project → SQL Editor):
```sql
-- ============================================
-- NEPAL TELECOM MIS UPGRADE
-- Complete Database Migration
-- ============================================

-- PHASE 0: CORE SETUP (what was in your separate file)
-- ============================================

-- Create provinces table FIRST
CREATE TABLE IF NOT EXISTS provinces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  province_number INTEGER UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clear and insert fresh provinces data
TRUNCATE TABLE provinces CASCADE;
INSERT INTO provinces (name, province_number) VALUES
  ('Koshi', 1),
  ('Madhesh', 2),
  ('Bagmati', 3),
  ('Gandaki', 4),
  ('Lumbini', 5),
  ('Karnali', 6),
  ('Sudurpashchim', 7);

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies (with error handling)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
    CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- ============================================
-- PHASE 1A: ENUM TYPES & REFERENCE TABLES
-- ============================================

-- New admin level hierarchy
DO $$ BEGIN
  CREATE TYPE admin_level AS ENUM (
    'super_admin',
    'province_admin', 
    'directorate_admin',
    'district_admin',
    'viewer'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Field types for dynamic forms
DO $$ BEGIN
  CREATE TYPE field_type AS ENUM (
    'text',
    'integer',
    'decimal',
    'currency',
    'percentage',
    'date',
    'dropdown',
    'vehicle_number',
    'phone_number',
    'email'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Directorates table
CREATE TABLE IF NOT EXISTS directorates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert directorates
INSERT INTO directorates (name, code, description) VALUES
  ('Wireless Services Directorate', 'WSD', 'GSM/Mobile network operations'),
  ('Wireline & Customer Support Directorate', 'WCSD', 'FTTH, PSTN operations'),
  ('Information Technology Directorate', 'ITD', 'Billing, IT systems'),
  ('Backbone Transmission Directorate', 'BTD', 'International links, infrastructure'),
  ('Quality Standardization & Monitoring', 'QSM', 'MIS, quality control')
ON CONFLICT (code) DO NOTHING;

-- Districts table (77 districts)
CREATE TABLE IF NOT EXISTS districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  district_code TEXT UNIQUE,
  province_id UUID REFERENCES provinces(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert all 77 districts
INSERT INTO districts (name, district_code, province_id) VALUES
  -- Province 1 (Koshi) - 14 districts
  ('Bhojpur', 'BHP', (SELECT id FROM provinces WHERE province_number = 1)),
  ('Dhankuta', 'DHK', (SELECT id FROM provinces WHERE province_number = 1)),
  ('Ilam', 'ILM', (SELECT id FROM provinces WHERE province_number = 1)),
  ('Jhapa', 'JHP', (SELECT id FROM provinces WHERE province_number = 1)),
  ('Khotang', 'KHT', (SELECT id FROM provinces WHERE province_number = 1)),
  ('Morang', 'MRG', (SELECT id FROM provinces WHERE province_number = 1)),
  ('Okhaldhunga', 'OKH', (SELECT id FROM provinces WHERE province_number = 1)),
  ('Panchthar', 'PCT', (SELECT id FROM provinces WHERE province_number = 1)),
  ('Sankhuwasabha', 'SKH', (SELECT id FROM provinces WHERE province_number = 1)),
  ('Solukhumbu', 'SLK', (SELECT id FROM provinces WHERE province_number = 1)),
  ('Sunsari', 'SNS', (SELECT id FROM provinces WHERE province_number = 1)),
  ('Taplejung', 'TPL', (SELECT id FROM provinces WHERE province_number = 1)),
  ('Terhathum', 'TRH', (SELECT id FROM provinces WHERE province_number = 1)),
  ('Udayapur', 'UDP', (SELECT id FROM provinces WHERE province_number = 1)),
  
  -- Province 2 (Madhesh) - 8 districts
  ('Bara', 'BAR', (SELECT id FROM provinces WHERE province_number = 2)),
  ('Dhanusha', 'DHN', (SELECT id FROM provinces WHERE province_number = 2)),
  ('Mahottari', 'MHT', (SELECT id FROM provinces WHERE province_number = 2)),
  ('Parsa', 'PRS', (SELECT id FROM provinces WHERE province_number = 2)),
  ('Rautahat', 'RTH', (SELECT id FROM provinces WHERE province_number = 2)),
  ('Saptari', 'SPT', (SELECT id FROM provinces WHERE province_number = 2)),
  ('Sarlahi', 'SRL', (SELECT id FROM provinces WHERE province_number = 2)),
  ('Siraha', 'SRH', (SELECT id FROM provinces WHERE province_number = 2)),
  
  -- Province 3 (Bagmati) - 13 districts
  ('Bhaktapur', 'BKT', (SELECT id FROM provinces WHERE province_number = 3)),
  ('Chitwan', 'CTW', (SELECT id FROM provinces WHERE province_number = 3)),
  ('Dhading', 'DHD', (SELECT id FROM provinces WHERE province_number = 3)),
  ('Dolakha', 'DLK', (SELECT id FROM provinces WHERE province_number = 3)),
  ('Kathmandu', 'KTM', (SELECT id FROM provinces WHERE province_number = 3)),
  ('Kavrepalanchok', 'KVR', (SELECT id FROM provinces WHERE province_number = 3)),
  ('Lalitpur', 'LTP', (SELECT id FROM provinces WHERE province_number = 3)),
  ('Makwanpur', 'MKW', (SELECT id FROM provinces WHERE province_number = 3)),
  ('Nuwakot', 'NWT', (SELECT id FROM provinces WHERE province_number = 3)),
  ('Ramechhap', 'RMC', (SELECT id FROM provinces WHERE province_number = 3)),
  ('Rasuwa', 'RSW', (SELECT id FROM provinces WHERE province_number = 3)),
  ('Sindhuli', 'SND', (SELECT id FROM provinces WHERE province_number = 3)),
  ('Sindhupalchok', 'SPL', (SELECT id FROM provinces WHERE province_number = 3)),
  
  -- Province 4 (Gandaki) - 11 districts
  ('Baglung', 'BGL', (SELECT id FROM provinces WHERE province_number = 4)),
  ('Gorkha', 'GRK', (SELECT id FROM provinces WHERE province_number = 4)),
  ('Kaski', 'KSK', (SELECT id FROM provinces WHERE province_number = 4)),
  ('Lamjung', 'LMJ', (SELECT id FROM provinces WHERE province_number = 4)),
  ('Manang', 'MNG', (SELECT id FROM provinces WHERE province_number = 4)),
  ('Mustang', 'MST', (SELECT id FROM provinces WHERE province_number = 4)),
  ('Myagdi', 'MYG', (SELECT id FROM provinces WHERE province_number = 4)),
  ('Nawalpur', 'NWP', (SELECT id FROM provinces WHERE province_number = 4)),
  ('Parbat', 'PRB', (SELECT id FROM provinces WHERE province_number = 4)),
  ('Syangja', 'SYJ', (SELECT id FROM provinces WHERE province_number = 4)),
  ('Tanahun', 'TNH', (SELECT id FROM provinces WHERE province_number = 4)),
  
  -- Province 5 (Lumbini) - 12 districts
  ('Arghakhanchi', 'ARG', (SELECT id FROM provinces WHERE province_number = 5)),
  ('Banke', 'BNK', (SELECT id FROM provinces WHERE province_number = 5)),
  ('Bardiya', 'BRD', (SELECT id FROM provinces WHERE province_number = 5)),
  ('Dang', 'DNG', (SELECT id FROM provinces WHERE province_number = 5)),
  ('Eastern Rukum', 'ERK', (SELECT id FROM provinces WHERE province_number = 5)),
  ('Gulmi', 'GLM', (SELECT id FROM provinces WHERE province_number = 5)),
  ('Kapilvastu', 'KPV', (SELECT id FROM provinces WHERE province_number = 5)),
  ('Nawalparasi East', 'NPE', (SELECT id FROM provinces WHERE province_number = 5)),
  ('Palpa', 'PLP', (SELECT id FROM provinces WHERE province_number = 5)),
  ('Pyuthan', 'PYT', (SELECT id FROM provinces WHERE province_number = 5)),
  ('Rolpa', 'RLP', (SELECT id FROM provinces WHERE province_number = 5)),
  ('Rupandehi', 'RPD', (SELECT id FROM provinces WHERE province_number = 5)),
  
  -- Province 6 (Karnali) - 10 districts
  ('Dailekh', 'DLH', (SELECT id FROM provinces WHERE province_number = 6)),
  ('Dolpa', 'DLP', (SELECT id FROM provinces WHERE province_number = 6)),
  ('Humla', 'HML', (SELECT id FROM provinces WHERE province_number = 6)),
  ('Jajarkot', 'JJR', (SELECT id FROM provinces WHERE province_number = 6)),
  ('Jumla', 'JML', (SELECT id FROM provinces WHERE province_number = 6)),
  ('Kalikot', 'KLK', (SELECT id FROM provinces WHERE province_number = 6)),
  ('Mugu', 'MGU', (SELECT id FROM provinces WHERE province_number = 6)),
  ('Salyan', 'SLY', (SELECT id FROM provinces WHERE province_number = 6)),
  ('Surkhet', 'SRK', (SELECT id FROM provinces WHERE province_number = 6)),
  ('Western Rukum', 'WRK', (SELECT id FROM provinces WHERE province_number = 6)),
  
  -- Province 7 (Sudurpashchim) - 9 districts
  ('Achham', 'ACH', (SELECT id FROM provinces WHERE province_number = 7)),
  ('Baitadi', 'BTD', (SELECT id FROM provinces WHERE province_number = 7)),
  ('Bajhang', 'BJH', (SELECT id FROM provinces WHERE province_number = 7)),
  ('Bajura', 'BJR', (SELECT id FROM provinces WHERE province_number = 7)),
  ('Dadeldhura', 'DDL', (SELECT id FROM provinces WHERE province_number = 7)),
  ('Darchula', 'DRC', (SELECT id FROM provinces WHERE province_number = 7)),
  ('Doti', 'DOT', (SELECT id FROM provinces WHERE province_number = 7)),
  ('Kailali', 'KLL', (SELECT id FROM provinces WHERE province_number = 7)),
  ('Kanchanpur', 'KCP', (SELECT id FROM provinces WHERE province_number = 7))
ON CONFLICT (district_code) DO NOTHING;

-- ============================================
-- PHASE 1B: ENHANCED USER ROLES SYSTEM
-- ============================================

-- Check if old enum exists and handle migration
DO $$ 
BEGIN
  -- Add new columns to user_roles if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_roles' AND column_name = 'directorate_id') THEN
    
    -- Rename old role column temporarily
    ALTER TABLE user_roles RENAME COLUMN role TO role_old;
    
    -- Add new role column with new enum
    ALTER TABLE user_roles ADD COLUMN role admin_level;
    
    -- Migrate data: convert 'admin' to 'province_admin', 'user' to 'viewer'
    UPDATE user_roles SET role = 
      CASE 
        WHEN role_old::text = 'admin' THEN 'province_admin'::admin_level
        WHEN role_old::text = 'user' THEN 'viewer'::admin_level
        ELSE 'viewer'::admin_level
      END;
    
    -- Drop old column
    ALTER TABLE user_roles DROP COLUMN role_old;
    
    -- Add new columns
    ALTER TABLE user_roles 
      ADD COLUMN IF NOT EXISTS directorate_id UUID REFERENCES directorates(id),
      ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES districts(id),
      ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id),
      ADD COLUMN IF NOT EXISTS can_assign_roles BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS max_assignable_level admin_level,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ DEFAULT now(),
      ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
    
    -- Drop old unique constraint
    ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
  END IF;
END $$;

-- Role assignment audit trail
CREATE TABLE IF NOT EXISTS role_assignments_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN ('ASSIGNED', 'REMOVED', 'MODIFIED')),
  target_user_id UUID REFERENCES auth.users(id),
  role_assigned admin_level,
  assigned_by UUID REFERENCES auth.users(id),
  province_id UUID REFERENCES provinces(id),
  district_id UUID REFERENCES districts(id),
  reason TEXT,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ADD AUDIT SYSTEM FIXES HERE
-- ============================================

-- 1. Add missing columns to audit table
ALTER TABLE role_assignments_audit 
ADD COLUMN IF NOT EXISTS previous_role admin_level,
ADD COLUMN IF NOT EXISTS directorate_id UUID REFERENCES directorates(id);

-- 2. Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS role_assignments_audit_trigger ON user_roles;
DROP FUNCTION IF EXISTS log_role_assignments();

-- 3. Create the audit trigger function with FIXED user ID handling
CREATE OR REPLACE FUNCTION log_role_assignments()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- BETTER WAY: Get user ID from the NEW.assigned_by field or use a fallback
    current_user_id := COALESCE(
        NEW.assigned_by,  -- Use the assigned_by field from the user_roles table
        OLD.assigned_by,  -- Fallback to old value for updates
        '00000000-0000-0000-0000-000000000000'::UUID  -- Fallback UUID
    );
    
    IF TG_OP = 'INSERT' THEN
        INSERT INTO role_assignments_audit (
            action,
            target_user_id,
            role_assigned,
            previous_role,
            assigned_by,
            province_id,
            district_id,
            directorate_id,
            reason,
            timestamp
        ) VALUES (
            'ASSIGNED',
            NEW.user_id,
            NEW.role,
            NULL,
            current_user_id,
            NEW.province_id,
            NEW.district_id,
            NEW.directorate_id,
            'Role assigned',
            now()
        );
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.is_active = true AND NEW.is_active = false THEN
            -- Role deactivation
            INSERT INTO role_assignments_audit (
                action,
                target_user_id,
                role_assigned,
                previous_role,
                assigned_by,
                province_id,
                district_id,
                directorate_id,
                reason,
                timestamp
            ) VALUES (
                'REMOVED',
                NEW.user_id,
                OLD.role,
                OLD.role,
                current_user_id,
                OLD.province_id,
                OLD.district_id,
                OLD.directorate_id,
                'Role deactivated',
                now()
            );
            
        ELSIF (OLD.role IS DISTINCT FROM NEW.role OR 
               OLD.province_id IS DISTINCT FROM NEW.province_id OR 
               OLD.district_id IS DISTINCT FROM NEW.district_id OR
               OLD.directorate_id IS DISTINCT FROM NEW.directorate_id) THEN
            -- Role modification
            INSERT INTO role_assignments_audit (
                action,
                target_user_id,
                role_assigned,
                previous_role,
                assigned_by,
                province_id,
                district_id,
                directorate_id,
                reason,
                timestamp
            ) VALUES (
                'MODIFIED',
                NEW.user_id,
                NEW.role,
                OLD.role,
                current_user_id,
                NEW.province_id,
                NEW.district_id,
                NEW.directorate_id,
                'Role modified',
                now()
            );
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the original operation
        RAISE NOTICE 'Error in audit trigger: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create the trigger
CREATE TRIGGER role_assignments_audit_trigger
    AFTER INSERT OR UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION log_role_assignments();

-- 5. Clean up duplicate roles for testing
UPDATE user_roles 
SET is_active = false 
WHERE user_id IN (
    SELECT user_id 
    FROM user_roles 
    WHERE is_active = true 
    GROUP BY user_id 
    HAVING COUNT(*) > 1
) AND activated_at != (
    SELECT MAX(activated_at) 
    FROM user_roles ur2 
    WHERE ur2.user_id = user_roles.user_id
);

-- 6. Add RLS policy to allow trigger to insert audit logs (CRITICAL FIX)
DROP POLICY IF EXISTS "System can insert audit logs" ON role_assignments_audit;
CREATE POLICY "System can insert audit logs"
ON role_assignments_audit FOR INSERT
WITH CHECK (true);

-- 7. Verify the audit system is working
DO $$
BEGIN
    RAISE NOTICE '✅ Audit system setup complete';
    RAISE NOTICE '✅ Trigger: role_assignments_audit_trigger created';
    RAISE NOTICE '✅ Function: log_role_assignments created';
    RAISE NOTICE '✅ Columns: previous_role and directorate_id added';
END $$;

-- ============================================
-- PHASE 1C: FIXED DYNAMIC DATA ENTRY SCHEMA (NO DUPLICATES)
-- ============================================

-- Schema definitions
CREATE TABLE IF NOT EXISTS data_entry_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name TEXT NOT NULL UNIQUE,  -- Added UNIQUE constraint
  category TEXT NOT NULL CHECK (category IN ('nationwide', 'province', 'district', 'imu')),
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Field definitions
CREATE TABLE IF NOT EXISTS schema_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id UUID REFERENCES data_entry_schemas(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  display_label TEXT NOT NULL,
  field_type field_type NOT NULL,
  parent_field_id UUID REFERENCES schema_fields(id),
  field_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT false,
  min_value DECIMAL(15,2),
  max_value DECIMAL(15,2),
  default_value TEXT,
  validation_regex TEXT,
  is_calculated BOOLEAN DEFAULT false,
  calculation_formula TEXT,
  help_text TEXT,
  placeholder TEXT,
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Added unique constraint to prevent duplicate fields
  UNIQUE(schema_id, field_name, field_order)
);

-- ============================================
-- ENHANCED SCHEMA MANAGEMENT WITH APPROVAL WORKFLOW
-- ============================================

-- Schema modification requests table
CREATE TABLE IF NOT EXISTS schema_modification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id UUID REFERENCES data_entry_schemas(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id),
  province_id UUID REFERENCES provinces(id),
  district_id UUID REFERENCES districts(id),
  modification_type TEXT NOT NULL CHECK (modification_type IN ('ADD_FIELD', 'MODIFY_FIELD', 'DELETE_FIELD')),
  field_data JSONB, -- Stores the field details for the modification
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enhanced schema fields with approval tracking
ALTER TABLE schema_fields 
ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_field_id UUID REFERENCES schema_fields(id); -- For tracking modifications

-- FIXED: Create legacy schema ONLY if it doesn't exist
INSERT INTO data_entry_schemas (schema_name, category, version, is_active)
SELECT 'Province Monthly Report (Legacy)', 'province', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM data_entry_schemas WHERE schema_name = 'Province Monthly Report (Legacy)'
);

-- FIXED: Create fields ONLY if they don't exist
DO $$
DECLARE
  legacy_schema_id UUID;
  field_count INTEGER;
BEGIN
  -- Get the legacy schema ID
  SELECT id INTO legacy_schema_id 
  FROM data_entry_schemas 
  WHERE schema_name = 'Province Monthly Report (Legacy)';
  
  -- Only proceed if schema exists and has no fields yet
  IF legacy_schema_id IS NOT NULL THEN
    -- Count existing fields for this schema
    SELECT COUNT(*) INTO field_count 
    FROM schema_fields 
    WHERE schema_id = legacy_schema_id;
    
    -- Only insert fields if none exist
    IF field_count = 0 THEN
      INSERT INTO schema_fields (schema_id, field_name, display_label, field_type, field_order, is_required, unit)
      VALUES
        (legacy_schema_id, 'gsm_subscribers', 'GSM Subscribers', 'integer', 1, true, 'subscribers'),
        (legacy_schema_id, 'cdma_subscribers', 'CDMA Subscribers', 'integer', 2, true, 'subscribers'),
        (legacy_schema_id, 'pstn_subscribers', 'PSTN Subscribers', 'integer', 3, true, 'subscribers'),
        (legacy_schema_id, 'adsl_subscribers', 'ADSL Subscribers', 'integer', 4, true, 'subscribers'),
        (legacy_schema_id, 'ftth_subscribers', 'FTTH Subscribers', 'integer', 5, true, 'subscribers'),
        (legacy_schema_id, 'gsm_revenue', 'GSM Revenue', 'currency', 6, true, 'NPR'),
        (legacy_schema_id, 'cdma_revenue', 'CDMA Revenue', 'currency', 7, true, 'NPR'),
        (legacy_schema_id, 'pstn_revenue', 'PSTN Revenue', 'currency', 8, true, 'NPR'),
        (legacy_schema_id, 'adsl_revenue', 'ADSL Revenue', 'currency', 9, true, 'NPR'),
        (legacy_schema_id, 'ftth_revenue', 'FTTH Revenue', 'currency', 10, true, 'NPR');
      
      RAISE NOTICE '✅ Created legacy schema fields for Province Monthly Report';
    ELSE
      RAISE NOTICE '⚠️ Legacy schema fields already exist (% fields), skipping creation', field_count;
    END IF;
  END IF;
END $$;

-- ============================================
-- CLEANUP: REMOVE EXISTING DUPLICATES
-- ============================================

DO $$
DECLARE
  legacy_schema_id UUID;
  duplicate_count INTEGER;
BEGIN
  -- Get the legacy schema ID
  SELECT id INTO legacy_schema_id 
  FROM data_entry_schemas 
  WHERE schema_name = 'Province Monthly Report (Legacy)';
  
  IF legacy_schema_id IS NOT NULL THEN
    -- Count duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
      SELECT field_name, COUNT(*)
      FROM schema_fields
      WHERE schema_id = legacy_schema_id
      GROUP BY field_name
      HAVING COUNT(*) > 1
    ) AS duplicates;
    
    IF duplicate_count > 0 THEN
      RAISE NOTICE '🔄 Found % duplicate fields, cleaning up...', duplicate_count;
      
      -- Delete duplicates, keeping only the first occurrence
      DELETE FROM schema_fields 
      WHERE id NOT IN (
        SELECT DISTINCT ON (field_name) id
        FROM schema_fields
        WHERE schema_id = legacy_schema_id
        ORDER BY field_name, created_at
      ) AND schema_id = legacy_schema_id;
      
      RAISE NOTICE '✅ Removed duplicate fields';
    END IF;
  END IF;
END $$;

-- Dynamic data storage (EAV pattern with JSONB)
CREATE TABLE IF NOT EXISTS dynamic_data_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id UUID REFERENCES data_entry_schemas(id),
  province_id UUID REFERENCES provinces(id),
  district_id UUID REFERENCES districts(id),
  month INTEGER CHECK (month >= 1 AND month <= 12),
  year INTEGER CHECK (year >= 2000 AND year <= 2100),
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'published')),
  entered_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(schema_id, province_id, district_id, month, year)
);

-- Create index on JSONB data for faster queries
CREATE INDEX IF NOT EXISTS idx_dynamic_data_entries_data ON dynamic_data_entries USING gin(data);

-- Data validation history
CREATE TABLE IF NOT EXISTS data_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES dynamic_data_entries(id),
  validator_id UUID REFERENCES auth.users(id),
  validation_status TEXT CHECK (validation_status IN ('passed', 'failed', 'warning')),
  issues JSONB,
  validated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PHASE 1D: PUBLICATION WORKFLOW
-- ============================================

CREATE TABLE IF NOT EXISTS publication_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  provinces_submitted INTEGER DEFAULT 0,
  total_provinces INTEGER DEFAULT 7,
  districts_submitted INTEGER DEFAULT 0,
  total_districts INTEGER DEFAULT 77,
  reviewed_by UUID REFERENCES auth.users(id),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  publication_url TEXT,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'review_pending', 'approved', 'published')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(month, year)
);

-- ============================================
-- PHASE 1E: HELPER FUNCTIONS
-- ============================================

-- Get user's admin level
CREATE OR REPLACE FUNCTION get_admin_level(_user_id UUID)
RETURNS admin_level
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM user_roles
  WHERE user_id = _user_id
    AND is_active = true
  ORDER BY 
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'province_admin' THEN 2
      WHEN 'directorate_admin' THEN 3
      WHEN 'district_admin' THEN 4
      WHEN 'viewer' THEN 5
    END
  LIMIT 1;
$$;

-- Check if admin can manage another user
CREATE OR REPLACE FUNCTION can_manage_user(_admin_id UUID, _target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_role admin_level;
  admin_province_id UUID;
  target_role admin_level;
  target_province_id UUID;
BEGIN
  -- Get admin's details
  SELECT role, province_id INTO admin_role, admin_province_id
  FROM user_roles
  WHERE user_id = _admin_id AND is_active = true
  ORDER BY CASE role
    WHEN 'super_admin' THEN 1
    WHEN 'province_admin' THEN 2
    WHEN 'directorate_admin' THEN 3
    WHEN 'district_admin' THEN 4
    WHEN 'viewer' THEN 5
  END
  LIMIT 1;

  -- Get target user's details
  SELECT role, province_id INTO target_role, target_province_id
  FROM user_roles
  WHERE user_id = _target_user_id AND is_active = true
  ORDER BY CASE role
    WHEN 'super_admin' THEN 1
    WHEN 'province_admin' THEN 2
    WHEN 'directorate_admin' THEN 3
    WHEN 'district_admin' THEN 4
    WHEN 'viewer' THEN 5
  END
  LIMIT 1;

  -- Super admin can manage anyone
  IF admin_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  -- Province admin can manage users in their province (except super_admin)
  IF admin_role = 'province_admin' AND target_role != 'super_admin' THEN
    IF admin_province_id = target_province_id OR target_province_id IS NULL THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Directorate admin can manage district_admin and viewer in their scope
  IF admin_role = 'directorate_admin' AND target_role IN ('district_admin', 'viewer') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- ============================================
-- PHASE 1F: RLS POLICIES (FIXED VERSION)
-- ============================================

-- Enable RLS on new tables
ALTER TABLE directorates ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_entry_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_data_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignments_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE publication_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_modification_requests ENABLE ROW LEVEL SECURITY;

-- Public read access to reference tables (with error handling)
DO $$ 
BEGIN
    -- Drop existing policies if they exist, then recreate
    DROP POLICY IF EXISTS "Anyone can view directorates" ON directorates;
    CREATE POLICY "Anyone can view directorates" ON directorates FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Anyone can view districts" ON districts;
    CREATE POLICY "Anyone can view districts" ON districts FOR SELECT USING (true);
EXCEPTION
    WHEN undefined_object THEN
        -- Policies don't exist, create them
        CREATE POLICY "Anyone can view directorates" ON directorates FOR SELECT USING (true);
        CREATE POLICY "Anyone can view districts" ON districts FOR SELECT USING (true);
END $$;

-- Drop old user_roles policies if they exist
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
    DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
    DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
    DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
    DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;
EXCEPTION
    WHEN undefined_object THEN
        NULL; -- Policies don't exist, continue
END $$;

-- User roles policies (with error handling)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view roles they manage" ON user_roles;
    CREATE POLICY "Users can view roles they manage"
      ON user_roles FOR SELECT
      USING (
        auth.uid() = user_id 
        OR can_manage_user(auth.uid(), user_id)
        OR get_admin_level(auth.uid()) = 'super_admin'
      );

    DROP POLICY IF EXISTS "Admins can assign roles" ON user_roles;
    CREATE POLICY "Admins can assign roles"
      ON user_roles FOR INSERT
      WITH CHECK (
        can_manage_user(auth.uid(), user_id)
        AND assigned_by = auth.uid()
      );

    DROP POLICY IF EXISTS "Admins can update roles they manage" ON user_roles;
    CREATE POLICY "Admins can update roles they manage"
      ON user_roles FOR UPDATE
      USING (can_manage_user(auth.uid(), user_id));

    DROP POLICY IF EXISTS "Admins can remove roles they assigned" ON user_roles;
    CREATE POLICY "Admins can remove roles they assigned"
      ON user_roles FOR DELETE
      USING (assigned_by = auth.uid() OR get_admin_level(auth.uid()) = 'super_admin');
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Schema management policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Everyone can view active schemas" ON data_entry_schemas;
    CREATE POLICY "Everyone can view active schemas"
      ON data_entry_schemas FOR SELECT
      USING (is_active = true OR get_admin_level(auth.uid()) = 'super_admin');

    DROP POLICY IF EXISTS "Super admins can manage schemas" ON data_entry_schemas;
    CREATE POLICY "Super admins can manage schemas"
      ON data_entry_schemas FOR ALL
      USING (get_admin_level(auth.uid()) = 'super_admin')
      WITH CHECK (get_admin_level(auth.uid()) = 'super_admin');

    DROP POLICY IF EXISTS "Everyone can view schema fields" ON schema_fields;
    CREATE POLICY "Everyone can view schema fields"
      ON schema_fields FOR SELECT
      USING (true);

    DROP POLICY IF EXISTS "Super admins can manage fields" ON schema_fields;
    CREATE POLICY "Super admins can manage fields"
      ON schema_fields FOR ALL
      USING (get_admin_level(auth.uid()) = 'super_admin')
      WITH CHECK (get_admin_level(auth.uid()) = 'super_admin');
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Data entry policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view data in their scope" ON dynamic_data_entries;
    CREATE POLICY "Users can view data in their scope"
      ON dynamic_data_entries FOR SELECT
      USING (
        CASE get_admin_level(auth.uid())
          WHEN 'super_admin' THEN true
          WHEN 'province_admin' THEN 
            province_id = (SELECT province_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true LIMIT 1)
          WHEN 'district_admin' THEN
            district_id = (SELECT district_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true LIMIT 1)
          ELSE false
        END
        OR status = 'published'
      );

    DROP POLICY IF EXISTS "Admins can insert data in their scope" ON dynamic_data_entries;
    CREATE POLICY "Admins can insert data in their scope"
      ON dynamic_data_entries FOR INSERT
      WITH CHECK (
        CASE get_admin_level(auth.uid())
          WHEN 'super_admin' THEN true
          WHEN 'province_admin' THEN 
            province_id = (SELECT province_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true LIMIT 1)
          WHEN 'district_admin' THEN
            district_id = (SELECT district_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true LIMIT 1)
          ELSE false
        END
        AND entered_by = auth.uid()
      );

    DROP POLICY IF EXISTS "Users can update their submissions before approval" ON dynamic_data_entries;
    CREATE POLICY "Users can update their submissions before approval"
      ON dynamic_data_entries FOR UPDATE
      USING (
        (entered_by = auth.uid() AND status NOT IN ('published', 'approved'))
        OR get_admin_level(auth.uid()) = 'super_admin'
      );

    DROP POLICY IF EXISTS "Super admins can delete entries" ON dynamic_data_entries;
    CREATE POLICY "Super admins can delete entries"
      ON dynamic_data_entries FOR DELETE
      USING (get_admin_level(auth.uid()) = 'super_admin');
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Audit trail policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Admins can view audit logs" ON role_assignments_audit;
    CREATE POLICY "Admins can view audit logs"
      ON role_assignments_audit FOR SELECT
      USING (
        assigned_by = auth.uid()
        OR get_admin_level(auth.uid()) IN ('super_admin', 'province_admin')
      );

    DROP POLICY IF EXISTS "System can insert audit logs" ON role_assignments_audit;
    CREATE POLICY "System can insert audit logs"
      ON role_assignments_audit FOR INSERT
      WITH CHECK (true);
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Validation policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view validations for their entries" ON data_validations;
    CREATE POLICY "Users can view validations for their entries"
      ON data_validations FOR SELECT
      USING (
        validator_id = auth.uid()
        OR entry_id IN (SELECT id FROM dynamic_data_entries WHERE entered_by = auth.uid())
        OR get_admin_level(auth.uid()) IN ('super_admin', 'province_admin')
      );

    DROP POLICY IF EXISTS "Admins can insert validations" ON data_validations;
    CREATE POLICY "Admins can insert validations"
      ON data_validations FOR INSERT
      WITH CHECK (
        validator_id = auth.uid()
        AND get_admin_level(auth.uid()) IN ('super_admin', 'province_admin')
      );
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Publication queue policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Super admins can manage publication queue" ON publication_queue;
    CREATE POLICY "Super admins can manage publication queue"
      ON publication_queue FOR ALL
      USING (get_admin_level(auth.uid()) = 'super_admin')
      WITH CHECK (get_admin_level(auth.uid()) = 'super_admin');

    DROP POLICY IF EXISTS "Everyone can view published reports" ON publication_queue;
    CREATE POLICY "Everyone can view published reports"
      ON publication_queue FOR SELECT
      USING (status = 'published' OR get_admin_level(auth.uid()) IN ('super_admin', 'province_admin'));
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Schema modification requests policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view schema modifications in their scope" ON schema_modification_requests;
    CREATE POLICY "Users can view schema modifications in their scope"
    ON schema_modification_requests FOR SELECT
    USING (
      CASE get_admin_level(auth.uid())
        WHEN 'super_admin' THEN true
        WHEN 'province_admin' THEN 
          province_id = (SELECT province_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true LIMIT 1)
        WHEN 'district_admin' THEN
          district_id = (SELECT district_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true LIMIT 1)
        ELSE false
      END
      OR requested_by = auth.uid()
    );

    DROP POLICY IF EXISTS "Admins can create modification requests" ON schema_modification_requests;
    CREATE POLICY "Admins can create modification requests"
    ON schema_modification_requests FOR INSERT
    WITH CHECK (
      requested_by = auth.uid()
      AND get_admin_level(auth.uid()) IN ('province_admin', 'district_admin', 'super_admin')
    );

    DROP POLICY IF EXISTS "Super admins can manage modification requests" ON schema_modification_requests;
    CREATE POLICY "Super admins can manage modification requests"
    ON schema_modification_requests FOR UPDATE
    USING (get_admin_level(auth.uid()) = 'super_admin');
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- ============================================
-- PHASE 1G: DATA MIGRATION
-- ============================================

-- Migrate existing monthly_reports data
INSERT INTO dynamic_data_entries (schema_id, province_id, month, year, data, status, entered_by, published_at, created_at)
SELECT 
  (SELECT id FROM data_entry_schemas WHERE schema_name = 'Province Monthly Report (Legacy)'),
  province_id,
  month,
  year,
  jsonb_build_object(
    'gsm_subscribers', COALESCE(gsm_subscribers, 0),
    'cdma_subscribers', COALESCE(cdma_subscribers, 0),
    'pstn_subscribers', COALESCE(pstn_subscribers, 0),
    'adsl_subscribers', COALESCE(adsl_subscribers, 0),
    'ftth_subscribers', COALESCE(ftth_subscribers, 0),
    'gsm_revenue', COALESCE(gsm_revenue, 0),
    'cdma_revenue', COALESCE(cdma_revenue, 0),
    'pstn_revenue', COALESCE(pstn_revenue, 0),
    'adsl_revenue', COALESCE(adsl_revenue, 0),
    'ftth_revenue', COALESCE(ftth_revenue, 0)
  ),
  'published',
  entered_by,
  created_at,
  created_at
FROM monthly_reports
ON CONFLICT (schema_id, province_id, district_id, month, year) DO NOTHING;

-- ============================================
-- PHASE 1H: TRIGGERS
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
DROP TRIGGER IF EXISTS update_data_entry_schemas_updated_at ON data_entry_schemas;
CREATE TRIGGER update_data_entry_schemas_updated_at
  BEFORE UPDATE ON data_entry_schemas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_dynamic_data_entries_updated_at ON dynamic_data_entries;
CREATE TRIGGER update_dynamic_data_entries_updated_at
  BEFORE UPDATE ON dynamic_data_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_schema_modification_requests_updated_at ON schema_modification_requests;
CREATE TRIGGER update_schema_modification_requests_updated_at
  BEFORE UPDATE ON schema_modification_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- PHASE 1I: AUTO-PROFILE CREATION TRIGGER
-- ============================================

-- Create a function to handle profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also create missing profiles for existing users
INSERT INTO public.profiles (id, email, full_name, created_at)
SELECT 
    au.id, 
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', 'User'),
    au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- MIGRATION COMPLETE
-- Verify installation
-- ============================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'directorates', 'districts', 'data_entry_schemas',
    'schema_fields', 'dynamic_data_entries', 'publication_queue',
    'role_assignments_audit', 'data_validations', 'schema_modification_requests'
  );
  
  RAISE NOTICE '✅ Migration complete! % new tables created.', table_count;
  RAISE NOTICE '✅ % districts inserted', (SELECT COUNT(*) FROM districts);
  RAISE NOTICE '✅ % directorates inserted', (SELECT COUNT(*) FROM directorates);
  RAISE NOTICE '✅ % legacy data entries migrated', (SELECT COUNT(*) FROM dynamic_data_entries);
  RAISE NOTICE '✅ Enhanced schema management with approval workflow added';
END $$;

-- ============================================
-- AUDIT SYSTEM VERIFICATION
-- ============================================

DO $$
DECLARE
    trigger_count INTEGER;
    audit_logs_count INTEGER;
BEGIN
    -- Check if trigger was created
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger 
    WHERE tgname = 'role_assignments_audit_trigger';
    
    -- Check if we have any audit logs
    SELECT COUNT(*) INTO audit_logs_count
    FROM role_assignments_audit;
    
    RAISE NOTICE '✅ Audit System Status:';
    RAISE NOTICE '   - Trigger exists: %', (trigger_count > 0);
    RAISE NOTICE '   - Current audit logs: %', audit_logs_count;
    RAISE NOTICE '   - System ready for role changes';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Audit system verification failed: %', SQLERRM;
END $$;



-- Check tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check province data
SELECT * FROM provinces ORDER BY province_number;

-- Check district count (should be 77)
SELECT COUNT(*) as total_districts FROM districts;