import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Schema {
  schema_name: string;
  category: string;
}

interface SchemaField {
  id: string;
  field_name: string;
  display_label: string;
  field_type: string;
  is_required: boolean;
  is_calculated: boolean;
  placeholder: string | null;
  help_text: string | null;
  unit: string | null;
}

interface DynamicFormPreviewProps {
  schema: Schema;
  fields: SchemaField[];
}

export default function DynamicFormPreview({ schema, fields }: DynamicFormPreviewProps) {
  const renderField = (field: SchemaField) => {
    const commonProps = {
      placeholder: field.placeholder || undefined,
      disabled: field.is_calculated
    };

    return (
      <div key={field.id} className="space-y-2">
        <Label>
          {field.display_label}
          {field.is_required && <span className="text-destructive ml-1">*</span>}
          {field.is_calculated && (
            <Badge variant="secondary" className="ml-2">Auto-calculated</Badge>
          )}
        </Label>

        {field.field_type === 'currency' && (
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-muted-foreground">NPR</span>
            <Input {...commonProps} className="pl-14" type="number" />
          </div>
        )}

        {field.field_type === 'percentage' && (
          <div className="relative">
            <Input {...commonProps} type="number" />
            <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
          </div>
        )}

        {['integer', 'decimal'].includes(field.field_type) && (
          <Input {...commonProps} type="number" />
        )}

        {field.field_type === 'text' && (
          <Input {...commonProps} />
        )}

        {field.field_type === 'date' && (
          <Input {...commonProps} type="date" />
        )}

        {field.unit && !['currency', 'percentage'].includes(field.field_type) && (
          <p className="text-sm text-muted-foreground">Unit: {field.unit}</p>
        )}

        {field.help_text && (
          <p className="text-sm text-muted-foreground">{field.help_text}</p>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground mb-4">
            This is a preview. Actual forms will have full functionality.
          </div>

          {fields.map(renderField)}

          {fields.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No fields added yet. Click "Add Field" to start building your form.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}