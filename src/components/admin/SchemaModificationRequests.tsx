import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Clock, User, MapPin, FileText } from "lucide-react";
import { toast } from "sonner";

interface SchemaModificationRequest {
  id: string;
  schema_id: string;
  requested_by: string;
  province_id: string;
  district_id: string;
  modification_type: string;
  field_data: any;
  status: string;
  review_notes: string;
  created_at: string;
  schema_name?: string;
  requester_email?: string;
  requester_name?: string;  
  province_name?: string;
  district_name?: string;
}

interface SchemaModificationRequestsProps {
  onClose: () => void;
  onApproval: () => void;
}

export default function SchemaModificationRequests({ onClose, onApproval }: SchemaModificationRequestsProps) {
  const [requests, setRequests] = useState<SchemaModificationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
  try {
    // First get the basic requests
    const { data: requestsData, error: requestsError } = await supabase
      .from("schema_modification_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (requestsError) throw requestsError;

    // Enrich each request with related data using separate queries
    const enrichedRequests = await Promise.all(
      (requestsData || []).map(async (request) => {
        // Get schema name
        let schemaName = "Unknown Schema";
        if (request.schema_id) {
          const { data: schemaData } = await supabase
            .from("data_entry_schemas")
            .select("schema_name")
            .eq("id", request.schema_id)
            .single();
          schemaName = schemaData?.schema_name || "Unknown Schema";
        }

        // Get user info (requester)
        let userEmail = "Unknown";
        let userName = "Unknown User";
        if (request.requested_by) {
          const { data: userData } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", request.requested_by)
            .single();
          userEmail = userData?.email || "Unknown";
          userName = userData?.full_name || "Unknown User";
        }

        // Get province name if exists
        let provinceName = null;
        if (request.province_id) {
          const { data: provinceData } = await supabase
            .from("provinces")
            .select("name")
            .eq("id", request.province_id)
            .single();
          provinceName = provinceData?.name;
        }

        // Get district name if exists
        let districtName = null;
        if (request.district_id) {
          const { data: districtData } = await supabase
            .from("districts")
            .select("name")
            .eq("id", request.drict_id)
            .single();
          districtName = districtData?.name;
        }

        return {
          ...request,
          schema_name: schemaName,
          requester_email: userEmail,
          requester_name: userName,
          province_name: provinceName,
          district_name: districtName
        };
      })
    );

    console.log("Enriched requests:", enrichedRequests);
    setRequests(enrichedRequests);
  } catch (error: any) {
    console.error("Error fetching requests:", error);
    toast.error("Failed to load requests: " + error.message);
  } finally {
    setLoading(false);
  }
};

  const handleApprove = async (requestId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get the request details
    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    // Handle different modification types
    switch (request.modification_type) {
      case 'ADD_FIELD':
        // Add new field to schema_fields
        const { error: fieldError } = await supabase
          .from("schema_fields")
          .insert({
            schema_id: request.schema_id,
            ...request.field_data,
            added_by: request.requested_by,
            approved_by: user?.id,
            approved_at: new Date().toISOString(),
            is_custom: true
          });

        if (fieldError) throw fieldError;
        break;

      case 'MODIFY_FIELD':
        // Update existing field
        const { error: updateError } = await supabase
          .from("schema_fields")
          .update({
            display_label: request.field_data.display_label,
            field_type: request.field_data.field_type,
            field_order: request.field_data.field_order,
            is_required: request.field_data.is_required,
            min_value: request.field_data.min_value,
            max_value: request.field_data.max_value,
            default_value: request.field_data.default_value,
            validation_regex: request.field_data.validation_regex,
            is_calculated: request.field_data.is_calculated,
            calculation_formula: request.field_data.calculation_formula,
            help_text: request.field_data.help_text,
            placeholder: request.field_data.placeholder,
            unit: request.field_data.unit,
            approved_by: user?.id,
            approved_at: new Date().toISOString()
          })
          .eq("id", request.field_data.field_id);

        if (updateError) throw updateError;
        break;

      case 'DELETE_FIELD':
        // Delete the field (soft delete by setting is_active to false, or hard delete)
        const { error: deleteError } = await supabase
          .from("schema_fields")
          .delete()
          .eq("id", request.field_data.field_id);

        if (deleteError) throw deleteError;
        break;

      default:
        throw new Error(`Unknown modification type: ${request.modification_type}`);
    }

    // Update request status
    const { error: updateError } = await supabase
      .from("schema_modification_requests")
      .update({
        status: "approved",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: `Field ${request.modification_type.toLowerCase().replace('_', ' ')} approved`
      })
      .eq("id", requestId);

    if (updateError) throw updateError;

    toast.success(`Field ${request.modification_type.toLowerCase().replace('_', ' ')} approved`);
    fetchRequests();
    onApproval();
  } catch (error: any) {
    console.error("Approval error:", error);
    toast.error("Failed to approve request: " + error.message);
  }
};

  const handleReject = async (requestId: string) => {
    const reason = prompt("Reason for rejection:");
    if (!reason) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("schema_modification_requests")
        .update({
          status: "rejected",
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reason
        })
        .eq("id", requestId);

      if (error) throw error;

      toast.success("Request rejected");
      fetchRequests();
    } catch (error: any) {
      toast.error("Failed to reject request: " + error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: "bg-yellow-500",
      approved: "bg-green-500",
      rejected: "bg-red-500"
    };

    return (
      <Badge className={colors[status as keyof typeof colors]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schema Modification Requests</DialogTitle>
          <DialogDescription>
            Review and approve field addition requests from province and district admins
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">Loading requests...</div>
        ) : requests.length === 0 ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              No pending modification requests
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {requests.map(request => (
                <Card key={request.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {request.field_data?.display_label || "New Field"}
                      </CardTitle>
                      {getStatusBadge(request.status)}
                    </div>
                    <CardDescription>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {request.requester_name} ({request.requester_email})
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {request.province_name || request.district_name || "N/A"}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(request.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Field Type:</strong> {request.field_data?.field_type}
                      </div>
                      <div>
                        <strong>Required:</strong> {request.field_data?.is_required ? "Yes" : "No"}
                      </div>
                      <div>
                        <strong>Schema:</strong> {request.schema_name}
                      </div>
                      <div>
                        <strong>Modification:</strong> {request.modification_type.replace('_', ' ')}
                      </div>
                    </div>
                    
                    {request.field_data?.help_text && (
                      <div className="mt-2">
                        <strong>Help Text:</strong> {request.field_data.help_text}
                      </div>
                    )}

                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(request.id)}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(request.id)}
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}