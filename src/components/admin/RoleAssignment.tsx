import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserPlus, History, Loader2, AlertCircle, Mail, Shield, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import AssignRoleDialog from "./AssignRoleDialog";
import RoleHistoryDialog from "./RoleHistoryDialog";

interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  role: string;
  province_name: string;
  district_name: string;
  is_active: boolean;
  activated_at: string;
}

interface RoleAssignmentProps {
  adminRole: string;
  provinceId?: string;
  districtId?: string;
}

export default function RoleAssignment({ adminRole, provinceId, districtId }: RoleAssignmentProps) {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
  const initializeData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
    await fetchUsersWithRoles();
  };
  
  initializeData();
}, []);

  const fetchUsersWithRoles = async () => {
  try {
    setLoading(true);
    console.log("🔄 Fetching users with roles... Admin role:", adminRole);
    
    // Get current user's role details to determine scope
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    let currentUserProvinceId: string | null = null;
    let currentUserDistrictId: string | null = null;

    if (currentUser) {
      const { data: currentUserRole } = await supabase
        .from("user_roles")
        .select("province_id, district_id")
        .eq("user_id", currentUser.id)
        .eq("is_active", true)
        .single();
      
      currentUserProvinceId = currentUserRole?.province_id || null;
      currentUserDistrictId = currentUserRole?.district_id || null;
    }

    console.log("Current admin scope:", { currentUserProvinceId, currentUserDistrictId });

    // Get ALL profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .order("created_at", { ascending: false });

    if (profilesError) throw profilesError;

    // Get ALL user roles
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select(`
        user_id,
        role,
        is_active,
        activated_at,
        province_id,
        district_id
      `);

    if (rolesError) throw rolesError;

    // Get provinces and districts for mapping
    const [provincesResult, districtsResult] = await Promise.all([
      supabase.from("provinces").select("id, name"),
      supabase.from("districts").select("id, name")
    ]);

    const provinceMap = new Map(provincesResult.data?.map(p => [p.id, p.name]) || []);
    const districtMap = new Map(districtsResult.data?.map(d => [d.id, d.name]) || []);

    // Define role hierarchy (higher number = higher privilege)
    const roleHierarchy: Record<string, number> = {
      'super_admin': 5,
      'province_admin': 4,
      'directorate_admin': 3,
      'district_admin': 2,
      'viewer': 1,
      'no_role': 0
    };

    const currentAdminLevel = roleHierarchy[adminRole] || 0;

    // Combine data with proper filtering
    const formattedUsers: UserWithRole[] = (profiles || []).map(profile => {
      // Find the CURRENT ACTIVE role for this user
      const activeRole = rolesData?.find(role => 
        role.user_id === profile.id && role.is_active === true
      );

      // Skip if no active role and admin can't see role-less users
      if (!activeRole && adminRole !== 'super_admin') {
        return null;
      }

      const userRoleLevel = roleHierarchy[activeRole?.role || 'no_role'] || 0;

      // SUPER ADMIN: Can see everyone
      if (adminRole === 'super_admin') {
        // No filtering for super admin
      }
      // PROVINCE ADMIN: Can only see users in same province AND roles at/below province_admin level
      else if (adminRole === 'province_admin') {
        // Skip if user has higher role (super_admin)
        if (userRoleLevel > roleHierarchy['province_admin']) {
          return null;
        }
        // Skip if user is in different province
        if (activeRole?.province_id !== currentUserProvinceId) {
          return null;
        }
      }
      // DISTRICT ADMIN: Can only see users in same district AND roles at/below district_admin level
      else if (adminRole === 'district_admin') {
        // Skip if user has higher role (super_admin, province_admin, directorate_admin)
        if (userRoleLevel > roleHierarchy['district_admin']) {
          return null;
        }
        // Skip if user is in different district
        if (activeRole?.district_id !== currentUserDistrictId) {
          return null;
        }
      }
      // DIRECTORATE ADMIN: Can only see users in their scope AND roles at/below directorate_admin level
      else if (adminRole === 'directorate_admin') {
        // Skip if user has higher role (super_admin, province_admin)
        if (userRoleLevel > roleHierarchy['directorate_admin']) {
          return null;
        }
        // Directorate admin scope logic would go here
        // For now, use province-based filtering as placeholder
        if (activeRole?.province_id !== currentUserProvinceId) {
          return null;
        }
      }
      // OTHER ADMINS: Very restricted view
      else {
        // Only show viewers in the same location
        if (activeRole?.role !== 'viewer') {
          return null;
        }
        if (activeRole?.province_id !== currentUserProvinceId) {
          return null;
        }
      }

      // Use the active role data with proper location names
      const userData = {
        id: profile.id,
        email: profile.email || 'No email',
        full_name: profile.full_name || 'No name',
        role: activeRole?.role || 'no_role',
        province_name: activeRole?.province_id ? provinceMap.get(activeRole.province_id) || '' : '',
        district_name: activeRole?.district_id ? districtMap.get(activeRole.district_id) || '' : '',
        is_active: activeRole?.is_active ?? false,
        activated_at: activeRole?.activated_at || ''
      };

      return userData;
    }).filter(user => user !== null) as UserWithRole[];

    console.log(`✅ ${formattedUsers.length} users visible to ${adminRole}`);
    setUsers(formattedUsers);

  } catch (error: any) {
    console.error('❌ Error in fetchUsersWithRoles:', error);
    toast.error("Failed to load users");
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsersWithRoles();
    toast.success("Users list refreshed");
  };

  const handleToggleActive = async (user: UserWithRole) => {
    try {
      // Prevent deactivating yourself
      if (user.id === currentUserId) {
        toast.error("You cannot deactivate your own account");
        return;
      }

      console.log("Toggling active status for user:", user.email, "Current:", user.is_active);

      const { error } = await supabase
        .from("user_roles")
        .update({
          is_active: !user.is_active,
          deactivated_at: !user.is_active ? null : new Date().toISOString()
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success(`User ${!user.is_active ? 'activated' : 'deactivated'}`);
      
      // Refresh the data immediately
      await fetchUsersWithRoles();
      
    } catch (error: any) {
      console.error("Error toggling user active status:", error);
      toast.error("Failed to update user status");
    }
  };

  const formatRole = (role: string) => {
    if (role === 'no_role') return 'No Role Assigned';
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getInitials = (name: string, email: string) => {
    if (name && name !== 'No name') {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-red-500',
      province_admin: 'bg-blue-500',
      directorate_admin: 'bg-purple-500',  // ✅ Correct
      district_admin: 'bg-green-500',
      viewer: 'bg-gray-500',
      no_role: 'bg-orange-500'
    };
    return colors[role] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <div>Loading users...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Role Assignment</CardTitle>
              <CardDescription>
                Manage roles for all users in the system
                <div className="text-sm text-muted-foreground mt-1">
                  You can manage other users' roles but cannot deactivate your own account
                </div>
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <div>No users found</div>
              <div className="text-sm mt-2">
                Users will appear here once they register.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map(user => (
                <Card 
                  key={user.id} 
                  className={`
                    ${!user.is_active ? 'opacity-60 border-dashed bg-muted/30' : 'bg-card'}
                    ${user.id === currentUserId ? 'border-2 border-primary' : ''}
                    transition-all duration-200
                  `}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className={getRoleColor(user.role)}>
                            {getInitials(user.full_name, user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">
                            {user.full_name}
                            {user.id === currentUserId && (
                              <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-1 rounded">You</span>
                            )}
                            {!user.is_active && (
                              <span className="ml-2 text-xs bg-yellow-500 text-white px-2 py-1 rounded">Inactive</span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground truncate flex items-center gap-1">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={user.is_active}
                        onCheckedChange={() => handleToggleActive(user)}
                        disabled={user.role === 'no_role' || user.id === currentUserId}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Role:</span>
                        <div className="flex items-center gap-2">
                          <Shield className="h-3 w-3 text-muted-foreground" />
                          <Badge className={getRoleColor(user.role)}>
                            {formatRole(user.role)}
                          </Badge>
                        </div>
                      </div>

                      {user.province_name && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Province:</span>
                          <span className="text-sm font-medium">{user.province_name}</span>
                        </div>
                      )}

                      {user.district_name && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">District:</span>
                          <span className="text-sm font-medium">{user.district_name}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setSelectedUser(user);
                          setShowAssignDialog(true);
                        }}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        {user.role === 'no_role' ? 'Assign Role' : 'Change Role'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(user);
                          setShowHistoryDialog(true);
                        }}
                        disabled={user.role === 'no_role'}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </div>

                    {user.id === currentUserId && (
                      <div className="text-xs text-blue-500 mt-2 text-center">
                        This is your account - you cannot deactivate it
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showAssignDialog && (
        <AssignRoleDialog
          user={selectedUser}
          adminRole={adminRole}
          onClose={() => {
            setShowAssignDialog(false);
            setSelectedUser(null);
            // Force refresh the data
            fetchUsersWithRoles();
          }}
        />
      )}

      {showHistoryDialog && selectedUser && (
        <RoleHistoryDialog
          userId={selectedUser.id}
          userEmail={selectedUser.email}
          onClose={() => {
            setShowHistoryDialog(false);
            setSelectedUser(null);
          }}
        />
      )}
    </>
  );
}