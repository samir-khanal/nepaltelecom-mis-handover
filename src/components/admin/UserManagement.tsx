import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Search, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AssignRoleDialog from "./AssignRoleDialog";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  province_name: string;
  district_name: string;
  is_active: boolean;
}

interface UserManagementProps {
  adminRole: string;
}

export default function UserManagement({ adminRole }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      
      console.log("Fetching ALL users and roles...");
      
      // Parallel data fetching for performance
      const [profilesResponse, rolesResponse, provincesResponse, districtsResponse] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role, is_active, province_id, district_id"), // REMOVED .eq("is_active", true)
        supabase.from("provinces").select("id, name"),
        supabase.from("districts").select("id, name, province_id")
      ]);

      // Handle errors
      if (profilesResponse.error) throw new Error(`Profiles: ${profilesResponse.error.message}`);
      if (rolesResponse.error) throw new Error(`Roles: ${rolesResponse.error.message}`);

      const profiles = profilesResponse.data || [];
      const roles = rolesResponse.data || [];
      const provinces = provincesResponse.data || [];
      const districts = districtsResponse.data || [];

      console.log("Profiles found:", profiles);
      console.log("Roles found:", roles);

      // Create lookup maps for performance
      const provinceMap = new Map(provinces.map(p => [p.id, p.name]));
      const districtMap = new Map(districts.map(d => [d.id, d.name]));

      // Combine data efficiently - get the most recent role for each user
      const formattedUsers: User[] = profiles.map(profile => {
        // Get all roles for this user and find the most recent active one, or any role if none active
        const userRoles = roles.filter(role => role.user_id === profile.id);
        const activeRole = userRoles.find(role => role.is_active);
        const anyRole = userRoles[0]; // Get first role if no active one
        
        const userRole = activeRole || anyRole;
        
        return {
          id: profile.id,
          email: profile.email || 'No email',
          full_name: profile.full_name || 'No name',
          role: userRole?.role || 'no_role',
          province_name: userRole?.province_id ? provinceMap.get(userRole.province_id) || 'N/A' : 'N/A',
          district_name: userRole?.district_id ? districtMap.get(userRole.district_id) || 'N/A' : 'N/A',
          is_active: userRole?.is_active ?? false
        };
      });

      console.log("Formatted users:", formattedUsers);
      setUsers(formattedUsers);
      setFilteredUsers(formattedUsers);
    } catch (error: any) {
      console.error('User management error:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const filtered = users.filter(u =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const handleAssignRole = (user: User) => {
    setSelectedUser(user);
    setShowAssignDialog(true);
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    if (userId === currentUserId) {
      toast.error("You cannot deactivate your own account");
      return;
    }

    if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this user?`)) return;
    
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ 
          is_active: !currentStatus,
          deactivated_at: !currentStatus ? null : new Date().toISOString()
        })
        .eq("user_id", userId);

      if (error) throw error;
      
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (error: any) {
      toast.error("Failed to update user status");
    }
  };

  const formatRole = (role: string) => {
    if (role === 'no_role') return 'No Role';
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-red-500',
      province_admin: 'bg-blue-500',
      district_user: 'bg-green-500',
      imu_user: 'bg-purple-500',
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
          <div>Loading all users...</div>
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
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage all users in the system
                <div className="text-sm text-muted-foreground mt-1">
                  Super Admin can see and manage all users
                </div>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-[300px]"
                />
              </div>
              <Button variant="outline" onClick={fetchUsers}>
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Province/District</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map(user => (
                  <TableRow key={user.id} className={user.id === currentUserId ? 'bg-muted/30' : ''}>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {user.email}
                          {user.id === currentUserId && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {user.full_name || 'No name'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleColor(user.role)}>
                        {formatRole(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {user.province_name}
                      {user.district_name !== 'N/A' && ` / ${user.district_name}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleAssignRole(user)}>
                            <UserPlus className="h-4 w-4 mr-2" />
                            {user.role === 'no_role' ? 'Assign Role' : 'Change Role'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(user.id, user.is_active)}
                            disabled={user.id === currentUserId}
                          >
                            {user.is_active ? 'Deactivate User' : 'Activate User'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showAssignDialog && (
        <AssignRoleDialog
          user={selectedUser}
          adminRole={adminRole}
          onClose={() => {
            setShowAssignDialog(false);
            setSelectedUser(null);
            fetchUsers();
          }}
        />
      )}
    </>
  );
}