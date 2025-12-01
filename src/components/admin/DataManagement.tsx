import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MoreVertical, Eye, Edit, CheckCircle, XCircle, Trash2, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import DynamicDataEntryForm from "../dashboard/DynamicDataEntryForm";

interface DataManagementProps {
  adminRole: string;
  provinceId?: string;
  districtId?: string;
}

interface DataEntry {
  id: string;
  schema_id: string;
  province_id: string;
  district_id: string;
  month: number;
  year: number;
  data: any;
  status: string;
  entered_by: string;
  submitted_at: string;
  approved_at: string;
  updated_at: string;
  province_name?: string;
  district_name?: string;
  schema_name?: string;
}

export default function DataManagement({ adminRole, provinceId, districtId }: DataManagementProps) {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedProvince, setSelectedProvince] = useState(provinceId || 'all');
  const [provinces, setProvinces] = useState<any[]>([]);
  const [entries, setEntries] = useState<DataEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<DataEntry | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProvinces = useCallback(async () => {
    if (adminRole === 'super_admin') {
      const { data } = await supabase
        .from("provinces")
        .select("*")
        .order("province_number");
      setProvinces(data || []);
    }
  }, [adminRole]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("dynamic_data_entries")
        .select("*")
        .eq("month", month)
        .eq("year", year);

      if (adminRole !== 'super_admin' && provinceId) {
        query = query.eq("province_id", provinceId);
      } else if (adminRole === 'super_admin' && selectedProvince !== 'all') {
        query = query.eq("province_id", selectedProvince);
      }

      const { data: entriesData, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch all related data in parallel for better performance
      const [provincesData, districtsData, schemasData] = await Promise.all([
        supabase.from("provinces").select("id, name"),
        supabase.from("districts").select("id, name"),
        supabase.from("data_entry_schemas").select("id, schema_name")
      ]);

      // Create lookup maps for fast access
      const provinceMap = new Map(provincesData.data?.map(p => [p.id, p.name]) || []);
      const districtMap = new Map(districtsData.data?.map(d => [d.id, d.name]) || []);
      const schemaMap = new Map(schemasData.data?.map(s => [s.id, s.schema_name]) || []);

      // Enrich entries with related data
      const enrichedEntries: DataEntry[] = (entriesData || []).map(entry => ({
        ...entry,
        province_name: entry.province_id ? provinceMap.get(entry.province_id) || 'N/A' : 'N/A',
        district_name: entry.district_id ? districtMap.get(entry.district_id) || 'N/A' : 'N/A',
        schema_name: entry.schema_id ? schemaMap.get(entry.schema_id) || 'Unknown Schema' : 'Unknown Schema'
      }));

      setEntries(enrichedEntries);
    } catch (error: any) {
      console.error('Data management error:', error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [month, year, selectedProvince, adminRole, provinceId]);

  useEffect(() => {
    if (adminRole === 'super_admin') {
      fetchProvinces();
    }
  }, [adminRole, fetchProvinces]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleView = (entry: DataEntry) => {
    setSelectedEntry(entry);
    setEditMode(false);
  };

  const handleEdit = (entry: DataEntry) => {
    if (!['draft', 'submitted'].includes(entry.status)) {
      toast.error("Cannot edit approved or published entries");
      return;
    }
    setSelectedEntry(entry);
    setEditMode(true);
  };

  const handleApprove = async (entryId: string) => {
    if (adminRole !== 'super_admin') {
      toast.error("Only super admins can approve data");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("dynamic_data_entries")
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq("id", entryId);

      if (error) throw error;

      toast.success("Data approved successfully");
      fetchEntries();
    } catch (error: any) {
      toast.error("Failed to approve: " + error.message);
    }
  };

  const handleReject = async (entryId: string) => {
    const reason = prompt("Reason for rejection (will notify submitter):");
    if (!reason) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: updateError } = await supabase
        .from("dynamic_data_entries")
        .update({ status: 'draft', updated_at: new Date().toISOString() })
        .eq("id", entryId);

      if (updateError) throw updateError;

      await supabase.from("data_validations").insert({
        entry_id: entryId,
        validator_id: user?.id,
        validation_status: 'failed',
        issues: { rejection_reason: reason }
      });

      toast.success("Data rejected and sent back to draft");
      fetchEntries();
    } catch (error: any) {
      toast.error("Failed to reject: " + error.message);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Delete this entry permanently? This cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from("dynamic_data_entries")
        .delete()
        .eq("id", entryId);

      if (error) throw error;

      toast.success("Entry deleted");
      fetchEntries();
    } catch (error: any) {
      toast.error("Failed to delete: " + error.message);
    }
  };

  const handleBulkApprove = async () => {
    if (adminRole !== 'super_admin') {
      toast.error("Only super admins can approve data");
      return;
    }

    if (selectedRows.length === 0) {
      toast.error("No entries selected");
      return;
    }

    if (!confirm(`Approve ${selectedRows.length} selected entries?`)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("dynamic_data_entries")
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .in("id", selectedRows);

      if (error) throw error;

      toast.success(`${selectedRows.length} entries approved`);
      setSelectedRows([]);
      fetchEntries();
    } catch (error: any) {
      toast.error("Failed to approve: " + error.message);
    }
  };

  const handleExportSelected = async () => {
    if (selectedRows.length === 0) {
      toast.error("No entries selected");
      return;
    }

    try {
      const selectedEntries = entries.filter(e => selectedRows.includes(e.id));
      
      const headers = "Province,District,Schema,Status,Date,Data\n";
      const rows = selectedEntries.map(entry => {
        const location = entry.province_name || entry.district_name || 'N/A';
        const date = entry.submitted_at ? format(new Date(entry.submitted_at), "yyyy-MM-dd") : '';
        const data = JSON.stringify(entry.data);
        
        return `"${location}","${entry.district_name || ''}","${entry.schema_name}","${entry.status}","${date}","${data}"`;
      }).join("\n");

      const csv = headers + rows;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-export-${month}-${year}.csv`;
      a.click();

      toast.success("Export completed");
    } catch (error: any) {
      toast.error("Failed to export: " + error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-500',
      submitted: 'bg-blue-500',
      approved: 'bg-green-500',
      published: 'bg-purple-500'
    };

    return (
      <Badge className={colors[status]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                {adminRole === 'super_admin' 
                  ? 'View and manage all data entries'
                  : 'View and manage data in your province'}
              </CardDescription>
            </div>

            <div className="flex gap-2">
              <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {new Date(2000, m - 1).toLocaleString("default", { month: "long" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {adminRole === 'super_admin' && (
                <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Provinces</SelectItem>
                    {provinces.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {selectedRows.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{selectedRows.length} entries selected</span>
                <div className="flex gap-2">
                  {adminRole === 'super_admin' && (
                    <Button size="sm" onClick={handleBulkApprove}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Selected
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={handleExportSelected}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Selected
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="text-center py-12">Loading data...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No data entries found for this period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedRows.length === entries.length && entries.length > 0}
                      onCheckedChange={(checked) => {
                        setSelectedRows(checked ? entries.map(e => e.id) : []);
                      }}
                    />
                  </TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Schema</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRows.includes(entry.id)}
                        onCheckedChange={(checked) => {
                          setSelectedRows(checked 
                            ? [...selectedRows, entry.id]
                            : selectedRows.filter(id => id !== entry.id)
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.province_name || entry.district_name || 'N/A'}
                    </TableCell>
                    <TableCell>{entry.schema_name}</TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell>
                      {entry.updated_at ? format(new Date(entry.updated_at), "PPp") : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleView(entry)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          
                          {['draft', 'submitted'].includes(entry.status) && (
                            <DropdownMenuItem onClick={() => handleEdit(entry)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Data
                            </DropdownMenuItem>
                          )}

                          {adminRole === 'super_admin' && entry.status === 'submitted' && (
                            <>
                              <DropdownMenuItem onClick={() => handleApprove(entry.id)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReject(entry.id)}>
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}

                          <DropdownMenuItem 
                            onClick={() => handleDelete(entry.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editMode ? 'Edit Data Entry' : 'View Data Entry'} - {selectedEntry?.province_name || selectedEntry?.district_name}
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <DynamicDataEntryForm
              schemaId={selectedEntry.schema_id}
              month={selectedEntry.month}
              year={selectedEntry.year}
              existingData={selectedEntry.data}
              entryId={selectedEntry.id}
              readOnly={!editMode}
              onSave={() => {
                setSelectedEntry(null);
                fetchEntries();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}