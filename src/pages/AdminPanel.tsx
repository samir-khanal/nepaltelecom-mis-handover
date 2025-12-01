import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, FileEdit, CheckCircle, History, Database, Loader2 } from "lucide-react";
import UserManagement from "@/components/admin/UserManagement";
import RoleAssignment from "@/components/admin/RoleAssignment";
import SchemaEditor from "@/components/admin/SchemaEditor";
import PublicationReview from "@/components/admin/PublicationReview";
import AuditLogs from "@/components/admin/AuditLogs";
import DataManagement from "@/components/admin/DataManagement";

export default function AdminPanel() {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userProvinceId, setUserProvinceId] = useState<string | null>(null);
  const [userDistrictId, setUserDistrictId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error("Auth error or no user:", authError);
        navigate("/auth");
        return;
      }

      setUserEmail(user.email);

      // Get user roles with location data
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role, province_id, district_id, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      console.log("User roles data:", rolesData);
      console.log("User email:", user.email);

      if (rolesError) {
        console.error("Roles error:", rolesError);
        navigate("/dashboard");
        return;
      }

      if (!rolesData || rolesData.length === 0) {
        console.log("No active roles found for user");
        navigate("/dashboard");
        return;
      }

      const userRoleData = rolesData[0];
      
      // Check if user has any admin role
      const isAdmin = ['super_admin', 'province_admin', 'district_admin', 'directorate_admin', 'viewer'].includes(userRoleData.role);
      
      if (!isAdmin) {
        console.log("User does not have admin role:", userRoleData.role);
        navigate("/dashboard");
        return;
      }

      console.log("User has admin role:", userRoleData.role);
      setUserRole(userRoleData.role);
      setUserProvinceId(userRoleData.province_id);
      setUserDistrictId(userRoleData.district_id);
      
    } catch (error: any) {
      console.error("Error checking admin access:", error);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <div>Checking admin access...</div>
          {userEmail && (
            <div className="text-sm text-muted-foreground mt-2">
              Logged in as: {userEmail}
            </div>
          )}
        </div>
      </div>
    );
  }

  const isSuperAdmin = userRole === 'super_admin';
  const isProvinceAdmin = userRole === 'province_admin';
  const isDistrictAdmin = userRole === 'district_admin';
  const isDirectorateAdmin = userRole === 'directorate_admin';
  
  // Calculate grid columns based on user role
  let gridColsClass = 'grid-cols-4'; // Default for province/district admins
  if (isSuperAdmin) gridColsClass = 'grid-cols-6';
  if (isDirectorateAdmin) gridColsClass = 'grid-cols-3';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Admin Panel</h1>
                <p className="text-sm text-muted-foreground">
                  System Administration - {userRole?.replace('_', ' ').toUpperCase()}
                </p>
              </div>
            </div>
            {userEmail && (
              <div className="text-sm text-muted-foreground">
                Logged in as: {userEmail}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="data" className="space-y-6">
          <TabsList className={`grid w-full ${gridColsClass}`}>
            {isSuperAdmin && (
              <TabsTrigger value="users">
                <Users className="h-4 w-4 mr-2" />
                Users
              </TabsTrigger>
            )}
            
            {(isSuperAdmin || isProvinceAdmin || isDistrictAdmin) && (
              <TabsTrigger value="roles">
                <Shield className="h-4 w-4 mr-2" />
                Roles
              </TabsTrigger>
            )}

            {(isSuperAdmin || isProvinceAdmin || isDistrictAdmin) && (
              <TabsTrigger value="schemas">
                <FileEdit className="h-4 w-4 mr-2" />
                Forms
              </TabsTrigger>
            )}

            {isSuperAdmin && (
              <TabsTrigger value="publication">
                <CheckCircle className="h-4 w-4 mr-2" />
                Publish
              </TabsTrigger>
            )}

            {(isSuperAdmin || isProvinceAdmin) && (
              <TabsTrigger value="audit">
                <History className="h-4 w-4 mr-2" />
                Audit
              </TabsTrigger>
            )}

            <TabsTrigger value="data">
              <Database className="h-4 w-4 mr-2" />
              Data
            </TabsTrigger>
          </TabsList>

          {isSuperAdmin && (
            <TabsContent value="users">
              <UserManagement adminRole={userRole} />
            </TabsContent>
          )}

          {(isSuperAdmin || isProvinceAdmin || isDistrictAdmin) && (
            <TabsContent value="roles">
              <RoleAssignment 
                adminRole={userRole} 
                provinceId={isProvinceAdmin ? userProvinceId : undefined}
                districtId={isDistrictAdmin ? userDistrictId : undefined}
              />
            </TabsContent>
          )}

          {(isSuperAdmin || isProvinceAdmin || isDistrictAdmin) && (
            <TabsContent value="schemas">
              <SchemaEditor 
                adminRole={userRole} 
                provinceId={isProvinceAdmin ? userProvinceId : undefined}
                districtId={isDistrictAdmin ? userDistrictId : undefined}
              />
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="publication">
              <PublicationReview />
            </TabsContent>
          )}

          {(isSuperAdmin || isProvinceAdmin) && (
            <TabsContent value="audit">
              <AuditLogs adminRole={userRole} />
            </TabsContent>
          )}

          <TabsContent value="data">
            <DataManagement 
              adminRole={userRole} 
              provinceId={isProvinceAdmin ? userProvinceId : undefined}
              districtId={isDistrictAdmin ? userDistrictId : undefined}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}