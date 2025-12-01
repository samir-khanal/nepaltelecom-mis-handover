import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, AlertCircle, Database, User, Shield } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  action: string;
  target_user_id: string;
  role_assigned: string;
  previous_role: string | null;
  assigned_by: string;
  province_id: string | null;
  district_id: string | null;
  reason: string | null;
  timestamp: string;
  target_user_email?: string;
  target_user_name?: string;
  assigner_email?: string;
  assigner_name?: string;
  province_name?: string;
  district_name?: string;
}

interface AuditLogsProps {
  adminRole: string;
}

export default function AuditLogs({ adminRole }: AuditLogsProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [searchTerm, actionFilter, logs]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("📋 Fetching audit logs...");

      // Step 1: Get audit logs without relationships
      const { data: auditLogs, error: auditError } = await supabase
        .from("role_assignments_audit")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(100);

      if (auditError) {
        console.error("❌ Audit logs error:", auditError);
        throw auditError;
      }

      console.log("✅ Raw audit logs fetched:", auditLogs?.length);

      if (!auditLogs || auditLogs.length === 0) {
        setLogs([]);
        setFilteredLogs([]);
        setError("No audit logs found in the database.");
        return;
      }

      // Step 2: Get all user profiles for mapping
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name");

      if (profilesError) {
        console.error("❌ Profiles error:", profilesError);
        throw profilesError;
      }

      // Step 3: Get provinces and districts for mapping
      const [provincesResult, districtsResult] = await Promise.all([
        supabase.from("provinces").select("id, name"),
        supabase.from("districts").select("id, name")
      ]);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const provinceMap = new Map(provincesResult.data?.map(p => [p.id, p.name]) || []);
      const districtMap = new Map(districtsResult.data?.map(d => [d.id, d.name]) || []);

      // Step 4: Combine all data manually
      const enrichedLogs: AuditLog[] = auditLogs.map(log => {
        const targetUser = profileMap.get(log.target_user_id);
        const assigner = profileMap.get(log.assigned_by);
        
        return {
          ...log,
          target_user_email: targetUser?.email || 'Unknown',
          target_user_name: targetUser?.full_name || 'Unknown',
          assigner_email: assigner?.email || 'Unknown',
          assigner_name: assigner?.full_name || 'Unknown',
          province_name: log.province_id ? provinceMap.get(log.province_id) : undefined,
          district_name: log.district_id ? districtMap.get(log.district_id) : undefined
        };
      });

      console.log("✅ Enriched audit logs:", enrichedLogs.length);
      console.log("Sample enriched log:", enrichedLogs[0]);

      setLogs(enrichedLogs);
      setFilteredLogs(enrichedLogs);

    } catch (error: any) {
      console.error("❌ Failed to load audit logs:", error);
      setError(`Failed to load audit logs: ${error.message}`);
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.target_user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.assigner_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.target_user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.assigner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.role_assigned?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === actionFilter);
    }

    setFilteredLogs(filtered);
  };

  const formatRole = (role: string) => {
    if (!role) return 'Unknown';
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
      ASSIGNED: 'default',
      REMOVED: 'destructive',
      MODIFIED: 'secondary'
    };

    return (
      <Badge variant={variants[action] || 'outline'}>
        {action || 'UNKNOWN'}
      </Badge>
    );
  };

  const createTestAuditLog = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("No user logged in");
        return;
      }

      const { error } = await supabase
        .from("role_assignments_audit")
        .insert({
          action: "MODIFIED",
          target_user_id: user.id,
          role_assigned: "viewer",
          previous_role: "viewer",
          assigned_by: user.id,
          reason: "Test audit log entry",
          timestamp: new Date().toISOString()
        });

      if (error) throw error;

      toast.success("Test audit log created");
      fetchAuditLogs();
    } catch (error: any) {
      console.error("Failed to create test audit log:", error);
      toast.error("Failed to create test log: " + error.message);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <div>Loading audit logs...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Audit Logs</CardTitle>
            <CardDescription>
              Complete history of role assignments and changes
              {logs.length > 0 && (
                <span className="ml-2 text-sm">
                  • {logs.length} total logs
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={createTestAuditLog}
              disabled={loading}
            >
              <Database className="h-4 w-4 mr-2" />
              Test Log
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAuditLogs}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-6 p-4 border border-amber-200 bg-amber-50 rounded-lg">
            <div className="flex items-center gap-2 text-amber-800 mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">{error}</span>
            </div>
            <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
              <li>No role changes have been made yet</li>
              <li>The audit log table might be empty</li>
              <li>There could be a database connection issue</li>
              <li>Try creating a test log using the button above</li>
            </ul>
          </div>
        )}

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, name, role, or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="ASSIGNED">Assigned</SelectItem>
              <SelectItem value="REMOVED">Removed</SelectItem>
              <SelectItem value="MODIFIED">Modified</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Admin
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Target User
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Role
                </div>
              </TableHead>
              <TableHead>Previous Role</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    <div>No audit logs found</div>
                    {searchTerm || actionFilter !== 'all' ? (
                      <div className="text-sm">Try changing your search or filter criteria</div>
                    ) : (
                      <div className="text-sm">No role changes have been recorded yet</div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(new Date(log.timestamp), "PPp")}
                  </TableCell>
                  <TableCell>{getActionBadge(log.action)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{log.assigner_name}</div>
                      <div className="text-muted-foreground">{log.assigner_email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{log.target_user_name}</div>
                      <div className="text-muted-foreground">{log.target_user_email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {formatRole(log.role_assigned)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {log.previous_role ? (
                      <Badge variant="outline" className="bg-muted">
                        {formatRole(log.previous_role)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.province_name || log.district_name || '-'}
                  </TableCell>
                  <TableCell className="text-sm max-w-xs">
                    <div className="break-words">
                      {log.reason || '-'}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {filteredLogs.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground text-center">
            Showing {filteredLogs.length} of {logs.length} logs
            {searchTerm || actionFilter !== 'all' ? ' (filtered)' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  );
}