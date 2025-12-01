import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CheckCircle, AlertCircle, Eye, CheckCircle2, XCircle, MoreVertical, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import DynamicDataEntryForm from "@/components/dashboard/DynamicDataEntryForm";

interface PublicationStatus {
  month: number;
  year: number;
  provinces_submitted: number;
  total_provinces: number;
  districts_submitted: number;
  total_districts: number;
  status: string;
  published_at?: string;
  published_by?: string;
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
  approved_by: string;
  provinces?: { name: string };
  districts?: { name: string };
  data_entry_schemas?: { schema_name: string };
  profiles?: { email: string; full_name: string };
}

export default function PublicationReview() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [submissions, setSubmissions] = useState<DataEntry[]>([]);
  const [publicationStatus, setPublicationStatus] = useState<PublicationStatus | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<DataEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [month, year]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchSubmissions(),
      fetchPublicationStatus()
    ]);
    setLoading(false);
  };

  const fetchSubmissions = async () => {
    try {
      // Get entries with ALL statuses to see the complete picture
      const { data: entriesData, error: entriesError } = await supabase
        .from("dynamic_data_entries")
        .select("*")
        .eq("month", month)
        .eq("year", year)
        .in("status", ['submitted', 'approved', 'published'])
        .order("submitted_at", { ascending: false });

      if (entriesError) throw entriesError;

      // Fetch related data separately
      const enrichedEntries = await Promise.all(
        (entriesData || []).map(async (entry) => {
          // Get province name
          let provinceName = 'N/A';
          if (entry.province_id) {
            const { data: provinceData } = await supabase
              .from("provinces")
              .select("name")
              .eq("id", entry.province_id)
              .single();
            provinceName = provinceData?.name || 'N/A';
          }

          // Get district name
          let districtName = 'N/A';
          if (entry.district_id) {
            const { data: districtData } = await supabase
              .from("districts")
              .select("name")
              .eq("id", entry.district_id)
              .single();
            districtName = districtData?.name || 'N/A';
          }

          // Get schema name
          let schemaName = 'Unknown Schema';
          if (entry.schema_id) {
            const { data: schemaData } = await supabase
              .from("data_entry_schemas")
              .select("schema_name")
              .eq("id", entry.schema_id)
              .single();
            schemaName = schemaData?.schema_name || 'Unknown Schema';
          }

          // Get user info (submitter)
          let userEmail = 'Unknown';
          let userName = 'Unknown User';
          if (entry.entered_by) {
            const { data: userData } = await supabase
              .from("profiles")
              .select("email, full_name")
              .eq("id", entry.entered_by)
              .single();
            userEmail = userData?.email || 'Unknown';
            userName = userData?.full_name || 'Unknown User';
          }

          return {
            ...entry,
            provinces: { name: provinceName },
            districts: { name: districtName },
            data_entry_schemas: { schema_name: schemaName },
            profiles: { email: userEmail, full_name: userName }
          };
        })
      );

      setSubmissions(enrichedEntries);
    } catch (error: any) {
      console.error("Error fetching submissions:", error);
      toast.error("Failed to load submissions: " + error.message);
    }
  };

  const fetchPublicationStatus = async () => {
    try {
      // Check existing publication queue
      const { data: queueData } = await supabase
        .from("publication_queue")
        .select("*")
        .eq("month", month)
        .eq("year", year)
        .single();

      if (queueData) {
        setPublicationStatus(queueData);
      } else {
        // Count submissions for current status
        const { data: provinceCount } = await supabase
          .from("dynamic_data_entries")
          .select("province_id", { count: 'exact' })
          .eq("month", month)
          .eq("year", year)
          .not("province_id", "is", null)
          .in("status", ['submitted', 'approved', 'published']);

        const { data: districtCount } = await supabase
          .from("dynamic_data_entries")
          .select("district_id", { count: 'exact' })
          .eq("month", month)
          .eq("year", year)
          .not("district_id", "is", null)
          .in("status", ['submitted', 'approved', 'published']);

        setPublicationStatus({
          month,
          year,
          provinces_submitted: provinceCount?.length || 0,
          total_provinces: 7,
          districts_submitted: districtCount?.length || 0,
          total_districts: 77,
          status: 'in_progress'
        });
      }
    } catch (error: any) {
      console.error("Error fetching publication status:", error);
    }
  };

  const handleApprove = async (entryId: string) => {
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

      toast.success("Submission approved");
      fetchData();
    } catch (error: any) {
      toast.error("Failed to approve: " + error.message);
    }
  };

  const handleReject = async (entryId: string) => {
    const reason = prompt("Reason for rejection (will be sent to submitter):");
    if (!reason) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Change status back to draft
      const { error: updateError } = await supabase
        .from("dynamic_data_entries")
        .update({ status: 'draft' })
        .eq("id", entryId);

      if (updateError) throw updateError;

      // Log rejection in validations table
      const { error: validationError } = await supabase
        .from("data_validations")
        .insert({
          entry_id: entryId,
          validator_id: user?.id,
          validation_status: 'failed',
          issues: { rejection_reason: reason }
        });

      if (validationError) throw validationError;

      toast.success("Submission rejected and sent back to draft");
      fetchData();
    } catch (error: any) {
      toast.error("Failed to reject: " + error.message);
    }
  };

  // FIXED: Publish individual province data - WITHOUT published_by column
  const handlePublishIndividual = async (entryId: string) => {
    setPublishing(entryId);
    try {
      // Update this specific entry to published
      const { error: publishError } = await supabase
        .from("dynamic_data_entries")
        .update({
          status: 'published'
        })
        .eq("id", entryId);

      if (publishError) throw publishError;

      // Update publication queue status
      await updatePublicationQueue();

      toast.success("Data published successfully! Now visible in analytics.");
      fetchData();
    } catch (error: any) {
      console.error("Publishing error:", error);
      toast.error("Failed to publish: " + error.message);
    } finally {
      setPublishing(null);
    }
  };

  // FIXED: Publish all approved data at once - WITHOUT published_by column
  const handlePublishAll = async () => {
    const approvedEntries = submissions.filter(s => s.status === 'approved');
    
    if (approvedEntries.length === 0) {
      toast.error("No approved submissions to publish");
      return;
    }

    if (!confirm(`Publish ${approvedEntries.length} approved entries? They will become visible in analytics.`)) {
      return;
    }

    setPublishing('all');
    try {
      // Update all approved entries to published
      const { error: publishError } = await supabase
        .from("dynamic_data_entries")
        .update({
          status: 'published'
        })
        .eq("month", month)
        .eq("year", year)
        .eq("status", 'approved');

      if (publishError) throw publishError;

      // Update publication queue status
      await updatePublicationQueue();

      toast.success(`${approvedEntries.length} entries published successfully! Now visible in analytics.`);
      fetchData();
    } catch (error: any) {
      console.error("Bulk publishing error:", error);
      toast.error("Failed to publish: " + error.message);
    } finally {
      setPublishing(null);
    }
  };

  // FIXED: Helper to update publication queue
  const updatePublicationQueue = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const publishedCount = submissions.filter(s => s.status === 'published').length + 1;
      const totalCount = submissions.length;

      const { error: queueError } = await supabase
        .from("publication_queue")
        .upsert({
          month,
          year,
          status: publishedCount >= totalCount ? 'published' : 'in_progress',
          published_by: user?.id,
          published_at: new Date().toISOString(),
          provinces_submitted: totalCount,
          total_provinces: 7,
          districts_submitted: 0,
          total_districts: 77
        }, {
          onConflict: 'month,year'
        });

      if (queueError) throw queueError;
    } catch (error) {
      console.error("Error updating publication queue:", error);
      // Don't fail the whole operation if queue update fails
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
      <Badge className={colors[status] || 'bg-gray-500'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getMonthName = (m: number) => {
    return new Date(2000, m - 1).toLocaleString("default", { month: "long" });
  };

  const isPublished = publicationStatus?.status === 'published';
  const approvedEntries = submissions.filter(s => s.status === 'approved');
  const publishedEntries = submissions.filter(s => s.status === 'published');

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Publication Review</CardTitle>
              <CardDescription>
                Review and publish monthly MIS reports - Publish provinces individually or all at once
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
                      {getMonthName(m)}
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
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Publication Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-bold text-blue-600">{submissions.length}</div>
                <div className="text-sm text-muted-foreground">Total Submissions</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-bold text-green-600">{approvedEntries.length}</div>
                <div className="text-sm text-muted-foreground">Approved</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-bold text-purple-600">{publishedEntries.length}</div>
                <div className="text-sm text-muted-foreground">Published</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-bold">
                  {isPublished ? 'Published' : 'In Progress'}
                </div>
                <div className="text-sm text-muted-foreground">Overall Status</div>
              </CardContent>
            </Card>
          </div>

          {/* Bulk Publish Button */}
          {approvedEntries.length > 0 && (
            <div className="flex justify-between items-center p-4 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <div className="font-semibold text-green-800">
                  Publish All Approved Data
                </div>
                <div className="text-sm text-green-600">
                  {approvedEntries.length} provinces ready to publish
                </div>
              </div>
              <Button
                onClick={handlePublishAll}
                disabled={publishing === 'all'}
                className="bg-green-600 hover:bg-green-700"
              >
                {publishing === 'all' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {publishing === 'all' ? 'Publishing...' : `Publish All (${approvedEntries.length})`}
              </Button>
            </div>
          )}

          {/* Submissions Table */}
          {loading ? (
            <div className="text-center py-8">Loading submissions...</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No submissions found for {getMonthName(month)} {year}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Province</TableHead>
                  <TableHead>Schema</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Submitted Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.provinces?.name || entry.districts?.name || 'N/A'}
                    </TableCell>
                    <TableCell>{entry.data_entry_schemas?.schema_name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{entry.profiles?.full_name || 'Unknown'}</div>
                        <div className="text-muted-foreground">{entry.profiles?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.submitted_at ? format(new Date(entry.submitted_at), "PPP") : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedEntry(entry)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {entry.status === 'submitted' && (
                            <>
                              <DropdownMenuItem onClick={() => handleApprove(entry.id)}>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleReject(entry.id)}
                                className="text-destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          {entry.status === 'approved' && (
                            <DropdownMenuItem 
                              onClick={() => handlePublishIndividual(entry.id)}
                              disabled={publishing === entry.id}
                            >
                              {publishing === entry.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4 mr-2" />
                              )}
                              {publishing === entry.id ? 'Publishing...' : 'Publish'}
                            </DropdownMenuItem>
                          )}
                          {entry.status === 'published' && (
                            <DropdownMenuItem className="text-purple-600" disabled>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Published
                            </DropdownMenuItem>
                          )}
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

      {/* View Entry Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              View Submission - {selectedEntry?.provinces?.name || selectedEntry?.districts?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <DynamicDataEntryForm
              schemaId={selectedEntry.schema_id}
              month={selectedEntry.month}
              year={selectedEntry.year}
              existingData={selectedEntry.data}
              readOnly={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}