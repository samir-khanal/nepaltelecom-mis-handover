import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface AssignRoleDialogProps {
  user: any;
  adminRole: string;
  onClose: () => void;
}

export default function AssignRoleDialog({ user, adminRole, onClose }: AssignRoleDialogProps) {
  const [role, setRole] = useState(user?.role || 'viewer');
  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProvinces();
    if (user?.province_name) {
      console.log("User has existing province:", user.province_name);
    }
  }, []);

  useEffect(() => {
    if (provinceId) {
      fetchDistricts(provinceId);
    } else {
      setDistricts([]);
      setDistrictId("");
    }
  }, [provinceId]);

  useEffect(() => {
    if (provinces.length > 0 && user?.province_name) {
      const userProvince = provinces.find(p => p.name === user.province_name);
      if (userProvince) {
        setProvinceId(userProvince.id);
        console.log("Auto-set province ID:", userProvince.id, userProvince.name);
      }
    }
  }, [provinces, user?.province_name]);

  const fetchProvinces = async () => {
    try {
      const { data, error } = await supabase
        .from("provinces")
        .select("*")
        .order("province_number");
      
      if (error) throw error;
      setProvinces(data || []);
    } catch (error: any) {
      console.error("Error fetching provinces:", error);
      toast.error("Failed to load provinces");
    }
  };

  const fetchDistricts = async (provinceId: string) => {
    try {
      const { data, error } = await supabase
        .from("districts")
        .select("*")
        .eq("province_id", provinceId)
        .order("name");
      
      if (error) throw error;
      setDistricts(data || []);
      
      // Auto-set district if user has existing district
      if (user?.district_name && data) {
        const userDistrict = data.find(d => d.name === user.district_name);
        if (userDistrict) {
          setDistrictId(userDistrict.id);
          console.log("Auto-set district ID:", userDistrict.id, userDistrict.name);
        }
      }
    } catch (error: any) {
      console.error("Error fetching districts:", error);
      toast.error("Failed to load districts");
    }
  };

  // IMPORTANT: This function was missing from my previous code
  const checkExistingRole = async (userId: string, role: string, provinceId?: string, districtId?: string) => {
    try {
      let query = supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", role)
        .eq("is_active", true);

      if (provinceId) {
        query = query.eq("province_id", provinceId);
      }
      if (districtId) {
        query = query.eq("district_id", districtId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data && data.length > 0;
    } catch (error) {
      console.error("Error checking existing role:", error);
      return false;
    }
  };

  const handleAssignRole = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log("🔄 Starting role assignment process...");

      // Get current user
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser) {
        throw new Error("Cannot authenticate current user");
      }

      const assignedById = currentUser.id;
      console.log("Current admin ID:", assignedById);

      // Get user's current active role for audit
      const { data: currentActiveRole, error: currentRoleError } = await supabase
        .from("user_roles")
        .select("role, province_id, district_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      console.log("Current active role found:", currentActiveRole);

      // IMPORTANT: Check if the same role already exists for this user
      const existingRole = await checkExistingRole(user.id, role, requiresProvince ? provinceId : null, requiresDistrict ? districtId : null);
      
      if (existingRole) {
        toast.error("This user already has this role assignment");
        return;
      }

      // STEP 1: Deactivate ALL existing active roles for this user
      console.log("Deactivating existing roles for user:", user.id);
      const { error: deactivateError } = await supabase
        .from("user_roles")
        .update({ 
          is_active: false,
          deactivated_at: new Date().toISOString()
        })
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (deactivateError) {
        console.error("❌ Deactivation error:", deactivateError);
        throw deactivateError;
      }
      console.log("✅ Existing roles deactivated");

      // STEP 2: Insert the new role
      const newRoleData = {
        user_id: user.id,
        role: role,
        province_id: requiresProvince ? provinceId : null,
        district_id: requiresDistrict ? districtId : null,
        is_active: true,
        activated_at: new Date().toISOString(),
        assigned_by: assignedById
      };

      console.log("Inserting new role:", newRoleData);

      const { data: newRole, error: insertError } = await supabase
        .from("user_roles")
        .insert(newRoleData)
        .select()
        .single();

      if (insertError) {
        console.error("❌ Role insertion error:", insertError);
        throw insertError;
      }
      console.log("✅ New role created:", newRole);

      // STEP 3: Manually create audit log (as backup to trigger)
      const auditData = {
        action: currentActiveRole ? "MODIFIED" : "ASSIGNED",
        target_user_id: user.id,
        role_assigned: role,
        previous_role: currentActiveRole?.role || null,
        province_id: requiresProvince ? provinceId : null,
        district_id: requiresDistrict ? districtId : null,
        assigned_by: assignedById,
        reason: reason || (currentActiveRole ? "Role modified" : "Role assigned")
      };

      console.log("Creating audit log:", auditData);

      const { error: auditError } = await supabase
        .from("role_assignments_audit")
        .insert(auditData);

      if (auditError) {
        console.error("⚠️ Audit log error (non-critical):", auditError);
        // Don't throw, just log the error
      } else {
        console.log("✅ Audit log created successfully");
      }

      // STEP 4: Verify the changes
      console.log("Verifying changes...");
      const { data: verifyData, error: verifyError } = await supabase
        .from("user_roles")
        .select("*, provinces(name), districts(name)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (verifyError) {
        console.error("❌ Verification error:", verifyError);
      } else {
        console.log("✅ Verification successful:", verifyData);
      }

      toast.success(`Role ${currentActiveRole ? 'modified' : 'assigned'} successfully`);
      onClose();

    } catch (error: any) {
      console.error("❌ Error in role assignment:", error);
      toast.error(`Failed to ${user?.role === 'no_role' ? 'assign' : 'modify'} role: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableRoles = () => {
  const allRoles = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'province_admin', label: 'Province Admin' },
    { value: 'directorate_admin', label: 'Directorate Admin' },
    { value: 'district_admin', label: 'District Admin' },
    { value: 'viewer', label: 'Viewer' }
  ];

  // Super admin can assign all roles
  if (adminRole === 'super_admin') {
    return allRoles;
  }

  // Province admin can assign directorate_admin, district_admin, and viewer
  if (adminRole === 'province_admin') {
    return allRoles.filter(role => 
      ['directorate_admin', 'district_admin', 'viewer'].includes(role.value)
    );
  }

  // Directorate admin can assign district_admin and viewer
  if (adminRole === 'directorate_admin') {
    return allRoles.filter(role => 
      ['district_admin', 'viewer'].includes(role.value)
    );
  }

  // District admin can only assign viewer
  if (adminRole === 'district_admin') {
    return allRoles.filter(role => role.value === 'viewer');
  }

  // Default: only viewer role for other types
  return allRoles.filter(role => role.value === 'viewer');
};

  const requiresProvince = ['province_admin', 'district_admin'].includes(role);
  const requiresDistrict = ['district_admin'].includes(role);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {user?.role === 'no_role' ? 'Assign Role' : 'Modify Role'}
          </DialogTitle>
          <DialogDescription>
            {user?.email} - {user?.role === 'no_role' ? 'No current role' : `Current: ${user.role}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Role *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getAvailableRoles().map(roleOption => (
                  <SelectItem key={roleOption.value} value={roleOption.value}>
                    {roleOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresProvince && (
            <div className="space-y-2">
              <Label>Province *</Label>
              <Select value={provinceId} onValueChange={setProvinceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select province" />
                </SelectTrigger>
                <SelectContent>
                  {provinces.map(province => (
                    <SelectItem key={province.id} value={province.id}>
                      {province.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {requiresDistrict && (
            <div className="space-y-2">
              <Label>District *</Label>
              <Select 
                value={districtId} 
                onValueChange={setDistrictId}
                disabled={!provinceId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={provinceId ? "Select district" : "Select province first"} />
                </SelectTrigger>
                <SelectContent>
                  {districts.map(district => (
                    <SelectItem key={district.id} value={district.id}>
                      {district.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              placeholder="Enter reason for this role change..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssignRole}
            disabled={loading || (requiresProvince && !provinceId) || (requiresDistrict && !districtId)}
          >
            {loading ? "Processing..." : user?.role === 'no_role' ? "Assign Role" : "Update Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
