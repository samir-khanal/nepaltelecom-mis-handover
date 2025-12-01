import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Save, Eye, Trash2, AlertTriangle, Database, FileText, Clock } from "lucide-react";
import { toast } from "sonner";
import FieldEditor from "./FieldEditor";
import DynamicFormPreview from "./DynamicFormPreview";
import SchemaModificationRequests from "./SchemaModificationRequests";

interface Schema {
  id: string;
  schema_name: string;
  category: string;
  version: number;
  is_active: boolean;
  created_at: string;
}

interface SchemaField {
  id: string;
  schema_id: string;
  field_name: string;
  display_label: string;
  field_type: string;
  parent_field_id: string | null;
  field_order: number;
  is_required: boolean;
  min_value: number | null;
  max_value: number | null;
  default_value: string | null;
  validation_regex: string | null;
  is_calculated: boolean;
  calculation_formula: string | null;
  help_text: string | null;
  placeholder: string | null;
  unit: string | null;
  added_by?: string;
  approved_by?: string;
  approved_at?: string;
  is_custom?: boolean;
}

interface SchemaEditorProps {
  adminRole: string;
  provinceId?: string;
  districtId?: string;
}

export default function SchemaEditor({ adminRole, provinceId, districtId }: SchemaEditorProps) {
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<Schema | null>(null);
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [showNewSchemaDialog, setShowNewSchemaDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showModificationRequests, setShowModificationRequests] = useState(false);
  const [schemaToDelete, setSchemaToDelete] = useState<Schema | null>(null);
  const [entryCount, setEntryCount] = useState<number>(0);
  const [newSchemaName, setNewSchemaName] = useState("");
  const [newSchemaCategory, setNewSchemaCategory] = useState("province");
  const [loading, setLoading] = useState(true);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const isSuperAdmin = adminRole === 'super_admin';
  const isProvinceAdmin = adminRole === 'province_admin';
  const isDistrictAdmin = adminRole === 'district_admin';

  useEffect(() => {
    fetchSchemas();
    if (isSuperAdmin) {
      fetchPendingRequestsCount();
    }
  }, []);

  useEffect(() => {
    if (selectedSchema) {
      fetchFields(selectedSchema.id);
    }
  }, [selectedSchema]);

  const fetchSchemas = async () => {
    try {
      let query = supabase
        .from("data_entry_schemas")
        .select("*")
        .order("created_at", { ascending: false });

      // Province admins can only see schemas for their category
      if (isProvinceAdmin) {
        query = query.eq("category", "province");
      } else if (isDistrictAdmin) {
        query = query.eq("category", "district");
      }

      const { data, error } = await query;

      if (error) throw error;
      setSchemas(data || []);
    } catch (error: any) {
      toast.error("Failed to load schemas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async (schemaId: string) => {
    try {
      const { data, error } = await supabase
        .from("schema_fields")
        .select("*")
        .eq("schema_id", schemaId)
        .order("field_order");

      if (error) throw error;
      
      // For non-super admins, only show approved fields
      let filteredFields = isSuperAdmin 
        ? data || []
        : (data || []).filter(field => field.approved_by !== null || field.added_by === null);
      
      // Keep temporary fields in local state (fields that start with 'temp-')
      const tempFields = fields.filter(field => field.id.startsWith('temp-'));
      filteredFields = [...filteredFields, ...tempFields];
      
      setFields(filteredFields);
    } catch (error: any) {
      toast.error("Failed to load fields: " + error.message);
    }
  };

  const fetchPendingRequestsCount = async () => {
    try {
      const { count, error } = await supabase
        .from("schema_modification_requests")
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      setPendingRequestsCount(count || 0);
    } catch (error) {
      console.error("Error fetching pending requests count:", error);
    }
  };

  const checkDataEntries = async (schemaId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from("dynamic_data_entries")
        .select('*', { count: 'exact', head: true })
        .eq('schema_id', schemaId);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error("Error checking data entries:", error);
      return 0;
    }
  };

  const handleCreateSchema = async () => {
    if (!newSchemaName.trim()) {
      toast.error("Schema name is required");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("data_entry_schemas")
        .insert({
          schema_name: newSchemaName,
          category: newSchemaCategory,
          version: 1,
          is_active: true,
          created_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Schema created successfully");
      setSchemas([data, ...schemas]);
      setSelectedSchema(data);
      setShowNewSchemaDialog(false);
      setNewSchemaName("");
    } catch (error: any) {
      toast.error("Failed to create schema: " + error.message);
    }
  };

  const handleAddField = async () => {
    const fieldData = {
      field_name: `field_${Date.now()}`,
      display_label: `New Field ${fields.length + 1}`,
      field_type: "text",
      parent_field_id: null,
      field_order: fields.length,
      is_required: false,
      min_value: null,
      max_value: null,
      default_value: null,
      validation_regex: null,
      is_calculated: false,
      calculation_formula: null,
      help_text: null,
      placeholder: null,
      unit: null
    };

    if (isSuperAdmin) {
      // Super admin can add fields directly
      const newField: SchemaField = {
        ...fieldData,
        id: `temp-${Date.now()}`,
        schema_id: selectedSchema?.id || "",
        added_by: (await supabase.auth.getUser()).data.user?.id,
        approved_by: (await supabase.auth.getUser()).data.user?.id,
        approved_at: new Date().toISOString(),
        is_custom: false
      };
      setFields([...fields, newField]);
      toast.success("Field added successfully");
    } else {
      // For non-super admins, add to local state immediately and submit request
      let newFieldId = `temp-${Date.now()}`;
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Create the new field object
        const newField: SchemaField = {
          ...fieldData,
          id: newFieldId,
          schema_id: selectedSchema?.id || "",
          added_by: user?.id,
          approved_by: null, // Not approved yet
          approved_at: null,
          is_custom: true
        };

        // Add to local state first so user can see it
        setFields([...fields, newField]);

        // Submit the request to database
        const { error } = await supabase
          .from("schema_modification_requests")
          .insert({
            schema_id: selectedSchema?.id,
            requested_by: user?.id,
            province_id: provinceId,
            district_id: districtId,
            modification_type: "ADD_FIELD",
            field_data: fieldData,
            status: "pending"
          });

        if (error) throw error;

        toast.success("Field addition requested. Waiting for super admin approval.");
        
      } catch (error: any) {
        // Remove from local state if request failed using the ID
        setFields(prevFields => prevFields.filter(f => f.id !== newFieldId));
        toast.error("Failed to request field addition: " + error.message);
      }
    }
  };

  const handleUpdateField = (fieldId: string, updates: Partial<SchemaField>) => {
    if (!canEditSchema(selectedSchema)) return;
    
    setFields(fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
  };

  const handleDeleteField = (fieldId: string) => {
    if (!canEditSchema(selectedSchema)) return;
    setFields(fields.filter(f => f.id !== fieldId));
  };

  const handleMoveField = (fromIndex: number, toIndex: number) => {
    if (!canEditSchema(selectedSchema)) return;
    if (toIndex < 0 || toIndex >= fields.length) return;
    
    const newFields = [...fields];
    const [movedField] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, movedField);
    
    // Update field_order
    const updatedFields = newFields.map((f, idx) => ({ ...f, field_order: idx }));
    setFields(updatedFields);
  };

  const handleModifyField = async (fieldId: string) => {
    if (!selectedSchema || !canEditSchema(selectedSchema)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const field = fields.find(f => f.id === fieldId);
      
      if (!field) return;

      if (isSuperAdmin) {
        // Super admin can modify directly
        toast.success("Field updated successfully");
      } else {
        // Province admin needs to request modification
        const { error } = await supabase
          .from("schema_modification_requests")
          .insert({
            schema_id: selectedSchema.id,
            requested_by: user?.id,
            province_id: provinceId,
            district_id: districtId,
            modification_type: "MODIFY_FIELD",
            field_data: {
              field_id: field.id,
              field_name: field.field_name,
              display_label: field.display_label,
              field_type: field.field_type,
              field_order: field.field_order,
              is_required: field.is_required,
              min_value: field.min_value,
              max_value: field.max_value,
              default_value: field.default_value,
              validation_regex: field.validation_regex,
              is_calculated: field.is_calculated,
              calculation_formula: field.calculation_formula,
              help_text: field.help_text,
              placeholder: field.placeholder,
              unit: field.unit
            },
            status: "pending"
          });

        if (error) throw error;

        toast.success("Field modification requested. Waiting for super admin approval.");
      }
    } catch (error: any) {
      toast.error("Failed to request field modification: " + error.message);
    }
  };

  const handleDeleteFieldRequest = async (fieldId: string) => {
    if (!selectedSchema || !canEditSchema(selectedSchema)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const field = fields.find(f => f.id === fieldId);
      
      if (!field) return;

      if (isSuperAdmin) {
        // Super admin can delete directly
        setFields(fields.filter(f => f.id !== fieldId));
        toast.success("Field deleted successfully");
      } else {
        // Province admin needs to request deletion
        const { error } = await supabase
          .from("schema_modification_requests")
          .insert({
            schema_id: selectedSchema.id,
            requested_by: user?.id,
            province_id: provinceId,
            district_id: districtId,
            modification_type: "DELETE_FIELD",
            field_data: {
              field_id: field.id,
              field_name: field.field_name,
              display_label: field.display_label
            },
            status: "pending"
          });

        if (error) throw error;

        toast.success("Field deletion requested. Waiting for super admin approval.");
      }
    } catch (error: any) {
      toast.error("Failed to request field deletion: " + error.message);
    }
  };

  const handleSaveSchema = async () => {
    if (!selectedSchema) return;

    try {
      if (isSuperAdmin) {
        // Super admin can save directly
        // Delete existing fields
        await supabase
          .from("schema_fields")
          .delete()
          .eq("schema_id", selectedSchema.id);

        // Insert updated fields (filter out temp IDs)
        const fieldsToInsert = fields.map(({ id, ...field }) => ({
          ...field,
          schema_id: selectedSchema.id
        }));

        const { error } = await supabase
          .from("schema_fields")
          .insert(fieldsToInsert);

        if (error) throw error;

        toast.success("Schema saved successfully");
        fetchFields(selectedSchema.id); // Refresh to get real IDs
      } else {
        // For non-super admins, submit modification requests ONLY for NEW fields
        const { data: { user } } = await supabase.auth.getUser();
        
        // Get existing approved fields from database
        const { data: existingFields } = await supabase
          .from("schema_fields")
          .select("*")
          .eq("schema_id", selectedSchema.id)
          .not("approved_by", "is", null); // Only get approved fields

        const existingFieldNames = new Set(existingFields?.map(f => f.field_name) || []);
        
        let submittedRequests = 0;

        // Only submit requests for fields that don't exist in the database (new fields)
        for (const field of fields) {
          // Check if this is a new field (not in existing fields and has temp ID or no approval)
          const isNewField = !existingFieldNames.has(field.field_name) && 
                            (field.id.startsWith('temp-') || field.approved_by === null);

          if (isNewField) {
            const { error } = await supabase
              .from("schema_modification_requests")
              .insert({
                schema_id: selectedSchema.id,
                requested_by: user?.id,
                province_id: provinceId,
                district_id: districtId,
                modification_type: "ADD_FIELD",
                field_data: {
                  field_name: field.field_name,
                  display_label: field.display_label,
                  field_type: field.field_type,
                  field_order: field.field_order,
                  is_required: field.is_required,
                  min_value: field.min_value,
                  max_value: field.max_value,
                  default_value: field.default_value,
                  validation_regex: field.validation_regex,
                  is_calculated: field.is_calculated,
                  calculation_formula: field.calculation_formula,
                  help_text: field.help_text,
                  placeholder: field.placeholder,
                  unit: field.unit
                },
                status: "pending"
              });

            if (!error) submittedRequests++;
          }
        }

        if (submittedRequests > 0) {
          toast.success(`${submittedRequests} new field request(s) submitted for super admin approval.`);
          // Refresh the fields to show only approved ones
          fetchFields(selectedSchema.id);
        } else {
          // Check if there are any temporary fields that need to be submitted
          const tempFields = fields.filter(f => f.id.startsWith('temp-'));
          if (tempFields.length > 0) {
            toast.info("New fields will be submitted when you click 'Request New Field'. Use that button for individual field requests.");
          } else {
            toast.info("No new fields to submit for approval.");
          }
        }
      }
    } catch (error: any) {
      console.error("Save schema error:", error);
      toast.error("Failed to save changes: " + error.message);
    }
  };

  const handleToggleActive = async (schema: Schema) => {
    try {
      const { error } = await supabase
        .from("data_entry_schemas")
        .update({ is_active: !schema.is_active })
        .eq("id", schema.id);

      if (error) throw error;

      toast.success(`Schema ${!schema.is_active ? 'activated' : 'deactivated'}`);
      fetchSchemas();
    } catch (error: any) {
      toast.error("Failed to update schema");
    }
  };

  const handleDeleteSchema = async (schema: Schema) => {
    if (!isSuperAdmin) {
      toast.error("Only super admins can delete schemas");
      return;
    }

    const count = await checkDataEntries(schema.id);
    setEntryCount(count);
    setSchemaToDelete(schema);
    setShowDeleteDialog(true);
  };

  const forceDeleteSchema = async () => {
    if (!schemaToDelete || !isSuperAdmin) return;

    try {
      // Use a transaction to ensure all deletions happen together
      const { error: entriesError } = await supabase
        .from("dynamic_data_entries")
        .delete()
        .eq("schema_id", schemaToDelete.id);

      if (entriesError) throw entriesError;

      // Delete schema fields
      const { error: fieldsError } = await supabase
        .from("schema_fields")
        .delete()
        .eq("schema_id", schemaToDelete.id);

      if (fieldsError) throw fieldsError;

      // Delete the schema
      const { error } = await supabase
        .from("data_entry_schemas")
        .delete()
        .eq("id", schemaToDelete.id);

      if (error) throw error;

      toast.success(`Schema and ${entryCount} data entries deleted successfully`);
      
      // Reset selection if the deleted schema was selected
      if (selectedSchema?.id === schemaToDelete.id) {
        setSelectedSchema(null);
        setFields([]);
      }
      
      fetchSchemas();
    } catch (error: any) {
      console.error("Force delete error:", error);
      toast.error("Failed to delete schema: " + error.message);
    } finally {
      setShowDeleteDialog(false);
      setSchemaToDelete(null);
      setEntryCount(0);
    }
  };

  const safeDeleteSchema = async () => {
    if (!schemaToDelete || !isSuperAdmin) return;

    try {
      // Only delete if no data entries exist
      if (entryCount > 0) {
        toast.error(`Cannot delete: ${entryCount} data entries exist. Use Force Delete to remove everything.`);
        return;
      }

      // Delete schema fields
      const { error: fieldsError } = await supabase
        .from("schema_fields")
        .delete()
        .eq("schema_id", schemaToDelete.id);

      if (fieldsError) throw fieldsError;

      // Delete the schema
      const { error } = await supabase
        .from("data_entry_schemas")
        .delete()
        .eq("id", schemaToDelete.id);

      if (error) throw error;

      toast.success("Schema deleted successfully");
      
      // Reset selection if the deleted schema was selected
      if (selectedSchema?.id === schemaToDelete.id) {
        setSelectedSchema(null);
        setFields([]);
      }
      
      fetchSchemas();
    } catch (error: any) {
      console.error("Safe delete error:", error);
      toast.error("Failed to delete schema: " + error.message);
    } finally {
      setShowDeleteDialog(false);
      setSchemaToDelete(null);
      setEntryCount(0);
    }
  };

  const canEditSchema = (schema: Schema | null) => {
    if (!schema) return false;
    if (isSuperAdmin) return true;
    if (isProvinceAdmin && schema.category === 'province') return true;
    if (isDistrictAdmin && schema.category === 'district') return true;
    return false;
  };

  if (loading) {
    return <Card><CardContent className="py-12 text-center">Loading schemas...</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {/* Modification Requests Button for Super Admin */}
      {isSuperAdmin && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => setShowModificationRequests(true)}
          >
            <Clock className="h-4 w-4 mr-2" />
            Review Requests ({pendingRequestsCount})
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Schema List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Data Entry Forms</CardTitle>
              {isSuperAdmin && (
                <Button size="sm" onClick={() => setShowNewSchemaDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New
                </Button>
              )}
            </div>
            <CardDescription>
              {isSuperAdmin ? "Manage all form templates" :
               isProvinceAdmin ? "Province-level forms" : 
               isDistrictAdmin ? "District-level forms" : "Available forms"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {schemas.map(schema => (
                  <div
                    key={schema.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedSchema?.id === schema.id 
                        ? 'bg-primary/10 border-primary' 
                        : 'hover:bg-accent'
                    } ${!canEditSchema(schema) ? 'opacity-50' : ''}`}
                    onClick={() => canEditSchema(schema) && setSelectedSchema(schema)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{schema.schema_name}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {schema.category} • v{schema.version}
                          {!canEditSchema(schema) && " • View Only"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSuperAdmin && (
                          <Switch
                            checked={schema.is_active}
                            onCheckedChange={() => handleToggleActive(schema)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        {isSuperAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSchema(schema);
                            }}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Field Editor */}
        {selectedSchema ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    Edit: {selectedSchema.schema_name}
                    {!canEditSchema(selectedSchema) && (
                      <Badge variant="outline" className="ml-2">View Only</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {fields.length} fields • Category: {selectedSchema.category}
                    {!isSuperAdmin && " • Changes require super admin approval"}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  {canEditSchema(selectedSchema) && (
                    <>
                      <Button size="sm" onClick={handleSaveSchema}>
                        <Save className="h-4 w-4 mr-2" />
                        {isSuperAdmin ? "Save" : "Submit New Fields"}
                      </Button>
                      {isSuperAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteSchema(selectedSchema)}
                          className="text-destructive border-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Form
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <FieldEditor
                      key={field.id}
                      field={field}
                      index={index}
                      canEdit={canEditSchema(selectedSchema)}
                      isSuperAdmin={isSuperAdmin}
                      onUpdate={(updates) => {
                        handleUpdateField(field.id, updates);
                        // Auto-submit modification request for province admins when they edit existing fields
                        if (!isSuperAdmin && !field.id.startsWith('temp-')) {
                          handleModifyField(field.id);
                        }
                      }}
                      onDelete={() => {
                        if (isSuperAdmin) {
                          handleDeleteField(field.id);
                        } else {
                          handleDeleteFieldRequest(field.id);
                        }
                      }}
                      onMoveUp={() => handleMoveField(index, index - 1)}
                      onMoveDown={() => handleMoveField(index, index + 1)}
                    />
                  ))}
                </div>

                {canEditSchema(selectedSchema) && (
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={handleAddField}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {isSuperAdmin ? "Add Field" : "Request New Field"}
                  </Button>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardContent className="py-12 text-center text-muted-foreground">
              {schemas.length === 0 ? 
                "No forms available for your access level" : 
                "Select a form to edit or preview"}
            </CardContent>
          </Card>
        )}
      </div>

      {/* New Schema Dialog */}
      {isSuperAdmin && (
        <Dialog open={showNewSchemaDialog} onOpenChange={setShowNewSchemaDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Schema</DialogTitle>
              <DialogDescription>
                Define a new data entry form template
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Schema Name *</Label>
                <Input
                  placeholder="e.g., Quarterly Financial Report"
                  value={newSchemaName}
                  onChange={(e) => setNewSchemaName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={newSchemaCategory} onValueChange={setNewSchemaCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nationwide">Nationwide</SelectItem>
                    <SelectItem value="province">Province Level</SelectItem>
                    <SelectItem value="district">District Level</SelectItem>
                    <SelectItem value="imu">IMU Level</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewSchemaDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSchema}>Create Schema</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Schema
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You are about to delete: <strong>"{schemaToDelete?.schema_name}"</strong>
              </AlertDescription>
            </Alert>

            {entryCount > 0 && (
              <Alert variant="destructive">
                <Database className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This schema has {entryCount} data entries.
                  Deleting will remove all associated data permanently.
                </AlertDescription>
              </Alert>
            )}

            {entryCount === 0 && (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  No data entries found. Safe to delete schema.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteDialog(false);
                setSchemaToDelete(null);
                setEntryCount(0);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            
            {entryCount === 0 ? (
              <Button 
                variant="destructive" 
                onClick={safeDeleteSchema}
                className="flex-1"
              >
                Delete Schema
              </Button>
            ) : (
              <Button 
                variant="destructive" 
                onClick={forceDeleteSchema}
                className="flex-1"
              >
                Force Delete ({entryCount} entries)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modification Requests Dialog */}
      {showModificationRequests && (
        <SchemaModificationRequests
          onClose={() => {
            setShowModificationRequests(false);
            fetchPendingRequestsCount();
          }}
          onApproval={() => {
            fetchSchemas();
            if (selectedSchema) fetchFields(selectedSchema.id);
            fetchPendingRequestsCount();
          }}
        />
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Form Preview: {selectedSchema?.schema_name}</DialogTitle>
            <DialogDescription>
              This is how the form will appear to data entry users
            </DialogDescription>
          </DialogHeader>
          {selectedSchema && (
            <DynamicFormPreview schema={selectedSchema} fields={fields} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}