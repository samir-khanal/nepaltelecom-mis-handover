import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { evaluateFormula } from "@/lib/formulaEvaluator";

interface DynamicDataEntryFormProps {
  schemaId: string;
  month: number;
  year: number;
  existingData?: Record<string, any>;
  entryId?: string;
  readOnly?: boolean;
  onSave?: () => void;
}

interface Schema {
  id: string;
  schema_name: string;
  category: string;
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
}

export default function DynamicDataEntryForm({
  schemaId,
  month,
  year,
  existingData,
  entryId,
  readOnly = false,
  onSave
}: DynamicDataEntryFormProps) {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSchemaAndFields();
  }, [schemaId]);

  useEffect(() => {
    if (existingData) {
      setFormData(existingData);
    }
  }, [existingData]);

  // Auto-calculate fields when dependencies change
  useEffect(() => {
    const calculatedFields = fields.filter(f => f.is_calculated && f.calculation_formula);
    
    calculatedFields.forEach(field => {
      try {
        const result = evaluateFormula(field.calculation_formula!, formData);
        if (!isNaN(result) && formData[field.field_name] !== result) {
          setFormData(prev => ({ ...prev, [field.field_name]: result }));
        }
      } catch (error) {
        console.error(`Error calculating ${field.field_name}:`, error);
      }
    });
  }, [formData, fields]);

  const fetchSchemaAndFields = async () => {
    try {
      const { data: schemaData, error: schemaError } = await supabase
        .from("data_entry_schemas")
        .select("*")
        .eq("id", schemaId)
        .single();

      if (schemaError) throw schemaError;
      setSchema(schemaData);

      const { data: fieldsData, error: fieldsError } = await supabase
        .from("schema_fields")
        .select("*")
        .eq("schema_id", schemaId)
        .order("field_order");

      if (fieldsError) throw fieldsError;
      setFields(fieldsData || []);

      // Set default values
      const defaults: Record<string, any> = {};
      fieldsData?.forEach(field => {
        if (field.default_value) {
          defaults[field.field_name] = field.default_value;
        }
      });
      setFormData(prev => ({ ...defaults, ...prev }));
    } catch (error: any) {
      toast.error("Failed to load form: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const validateForm = (): boolean => {
    const requiredFields = fields.filter(f => f.is_required);
    const missingFields: string[] = [];

    requiredFields.forEach(field => {
      const value = formData[field.field_name];
      if (value === undefined || value === null || value === "") {
        missingFields.push(field.display_label);
      }
    });

    if (missingFields.length > 0) {
      toast.error(`Missing required fields: ${missingFields.join(", ")}`);
      return false;
    }

    // Validate numeric ranges
    for (const field of fields) {
      if (['integer', 'decimal', 'currency', 'percentage'].includes(field.field_type)) {
        const value = formData[field.field_name];
        if (value !== undefined && value !== null && value !== "") {
          const numValue = parseFloat(value);
          
          if (field.min_value !== null && numValue < field.min_value) {
            toast.error(`${field.display_label} must be at least ${field.min_value}`);
            return false;
          }
          
          if (field.max_value !== null && numValue > field.max_value) {
            toast.error(`${field.display_label} must not exceed ${field.max_value}`);
            return false;
          }
        }
      }
    }

    return true;
  };

  const handleSubmit = async (status: 'draft' | 'submitted') => {
    if (status === 'submitted' && !validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get user's province/district from their role
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("province_id, district_id")
        .eq("user_id", user?.id)
        .eq("is_active", true)
        .single();

      const entryData = {
        schema_id: schemaId,
        province_id: userRole?.province_id || null,
        district_id: userRole?.district_id || null,
        month,
        year,
        data: formData,
        status,
        entered_by: user?.id,
        submitted_at: status === 'submitted' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      };

      let error;

      if (entryId) {
        // Update existing entry
        ({ error } = await supabase
          .from("dynamic_data_entries")
          .update(entryData)
          .eq("id", entryId));
      } else {
        // Insert new entry
        ({ error } = await supabase
          .from("dynamic_data_entries")
          .upsert(entryData, {
            onConflict: 'schema_id,province_id,district_id,month,year'
          }));
      }

      if (error) throw error;

      toast.success(
        status === 'draft' 
          ? 'Draft saved successfully' 
          : 'Data submitted for approval'
      );

      if (onSave) {
        onSave();
      }
    } catch (error: any) {
      toast.error("Failed to save: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: SchemaField) => {
    const value = formData[field.field_name] || "";
    const disabled = readOnly || field.is_calculated;

    switch (field.field_type) {
      case 'text':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.display_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
              {field.is_calculated && (
                <Badge variant="secondary" className="ml-2">Auto-calculated</Badge>
              )}
            </Label>
            <Input
              value={value}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              placeholder={field.placeholder || undefined}
              disabled={disabled}
            />
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        );

      case 'integer':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.display_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
              {field.is_calculated && (
                <Badge variant="secondary" className="ml-2">Auto-calculated</Badge>
              )}
            </Label>
            <Input
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(field.field_name, parseInt(e.target.value) || 0)}
              placeholder={field.placeholder || "0"}
              min={field.min_value || undefined}
              max={field.max_value || undefined}
              step="1"
              disabled={disabled}
            />
            {field.is_calculated && field.calculation_formula && (
              <p className="text-sm text-muted-foreground">
                Formula: {field.calculation_formula}
              </p>
            )}
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        );

      case 'decimal':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.display_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(field.field_name, parseFloat(e.target.value) || 0)}
              placeholder={field.placeholder || "0.00"}
              min={field.min_value || undefined}
              max={field.max_value || undefined}
              step="0.01"
              disabled={disabled}
            />
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        );

      case 'currency':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.display_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
              {field.is_calculated && (
                <Badge variant="secondary" className="ml-2">Auto-calculated</Badge>
              )}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground font-medium">
                NPR
              </span>
              <Input
                type="number"
                value={value}
                onChange={(e) => handleFieldChange(field.field_name, parseFloat(e.target.value) || 0)}
                placeholder={field.placeholder || "0.00"}
                className="pl-14"
                step="0.01"
                disabled={disabled}
              />
            </div>
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        );

      case 'percentage':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.display_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={value}
                onChange={(e) => handleFieldChange(field.field_name, parseFloat(e.target.value) || 0)}
                placeholder={field.placeholder || "0"}
                min="0"
                max="100"
                step="0.01"
                disabled={disabled}
              />
              <span className="absolute right-3 top-2.5 text-muted-foreground font-medium">
                %
              </span>
            </div>
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        );

      case 'date':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.display_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !value && "text-muted-foreground"
                  )}
                  disabled={disabled}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {value ? format(new Date(value), "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={value ? new Date(value) : undefined}
                  onSelect={(date) => handleFieldChange(field.field_name, date?.toISOString())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        );

      case 'vehicle_number':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.display_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              value={value}
              onChange={(e) => {
                const formatted = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                handleFieldChange(field.field_name, formatted);
              }}
              placeholder={field.placeholder || "BA01PA1234"}
              maxLength={10}
              disabled={disabled}
            />
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        );

      case 'phone_number':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.display_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              type="tel"
              value={value}
              onChange={(e) => {
                const formatted = e.target.value.replace(/[^0-9+\-() ]/g, "");
                handleFieldChange(field.field_name, formatted);
              }}
              placeholder={field.placeholder || "+977-9841234567"}
              disabled={disabled}
            />
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        );

      case 'email':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.display_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              type="email"
              value={value}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              placeholder={field.placeholder || "email@example.com"}
              disabled={disabled}
            />
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const getMonthName = (m: number) => {
    return new Date(2000, m - 1).toLocaleString("default", { month: "long" });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">Loading form...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{schema?.schema_name}</CardTitle>
        <CardDescription>
          {getMonthName(month)} {year}
          {readOnly && <Badge variant="secondary" className="ml-2">Read Only</Badge>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fields
            .filter(f => !f.parent_field_id)
            .map(field => (
              <div key={field.id}>
                {renderField(field)}
                
                {/* Render sub-fields (nested) */}
                {fields
                  .filter(f => f.parent_field_id === field.id)
                  .map(subField => (
                    <div key={subField.id} className="ml-6 mt-3">
                      {renderField(subField)}
                    </div>
                  ))}
              </div>
            ))}

          {fields.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No fields defined for this form. Contact administrator.
            </div>
          )}
        </div>

        {!readOnly && fields.length > 0 && (
          <div className="flex gap-2 mt-6 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => handleSubmit('draft')}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              onClick={() => handleSubmit('submitted')}
              disabled={saving}
            >
              <Send className="h-4 w-4 mr-2" />
              {saving ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}