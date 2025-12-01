import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface RoleHistory {
  id: string;
  action: string;
  role_assigned: string;
  province_name: string;
  district_name: string;
  assigned_by_email: string;
  reason: string;
  timestamp: string;
}

interface RoleHistoryDialogProps {
  userId: string;
  userEmail: string;
  onClose: () => void;
}

export default function RoleHistoryDialog({ userId, userEmail, onClose }: RoleHistoryDialogProps) {
  const [history, setHistory] = useState<RoleHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [userId]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("role_assignments_audit")
        .select(`
          *,
          provinces (name),
          districts (name),
          assigner:profiles!role_assignments_audit_assigned_by_fkey(email)
        `)
        .eq("target_user_id", userId)
        .order("timestamp", { ascending: false });

      if (error) throw error;

      const formatted: RoleHistory[] = (data || []).map(h => ({
        id: h.id,
        action: h.action,
        role_assigned: h.role_assigned,
        province_name: h.provinces?.name || '',
        district_name: h.districts?.name || '',
        assigned_by_email: h.assigner?.email || 'Unknown',
        reason: h.reason || '',
        timestamp: h.timestamp
      }));

      setHistory(formatted);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatRole = (role: string) => {
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, any> = {
      ASSIGNED: 'default',
      REMOVED: 'destructive',
      MODIFIED: 'secondary'
    };
    return <Badge variant={variants[action]}>{action}</Badge>;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Role History - {userEmail}</DialogTitle>
          <DialogDescription>
            Complete history of role assignments and changes
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="text-center py-8">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No role history found
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item, index) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getActionBadge(item.action)}
                        <Badge variant="outline">{formatRole(item.role_assigned)}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(item.timestamp), "PPp")}
                      </div>
                    </div>
                    {index === 0 && (
                      <Badge variant="secondary">Current</Badge>
                    )}
                  </div>

                  {(item.province_name || item.district_name) && (
                    <div className="text-sm mt-2">
                      <strong>Location:</strong> {item.province_name}
                      {item.district_name && ` / ${item.district_name}`}
                    </div>
                  )}

                  <div className="text-sm mt-2">
                    <strong>By:</strong> {item.assigned_by_email}
                  </div>

                  {item.reason && (
                    <div className="text-sm mt-2">
                      <strong>Reason:</strong> {item.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}