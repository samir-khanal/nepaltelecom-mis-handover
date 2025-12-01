import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, GripVertical, Trash2, Eye } from "lucide-react";

interface SchemaField {
  id: string;
  field_name: string;
  display_label: string;
  field_type: string;
  is_required: boolean;
  min_value: number | null;
  max_value: number | null;
  is_calculated: boolean;
  calculation_formula: string | null;
  help_text: string | null;
  placeholder: string | null;
  unit: string | null;
}

interface FieldEditorProps {
  field: SchemaField;
  index: number;
  canEdit: boolean;
  isSuperAdmin: boolean;
  onUpdate: (updates: Partial<SchemaField>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export default function FieldEditor({
  field,
  index,
  canEdit,
  isSuperAdmin,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown
}: FieldEditorProps) {
  const [expanded, setExpanded] = useState(false);

  const isNumericType = ['integer', 'decimal', 'currency', 'percentage'].includes(field.field_type);

  return (
    <Card className={`border-l-4 ${canEdit ? 'border-l-primary/50' : 'border-l-gray-300'}`}>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <GripVertical className={`h-5 w-5 text-muted-foreground ${canEdit ? 'cursor-move' : 'cursor-not-allowed'}`} />
            <div className="flex-1">
              <div className="font-medium flex items-center gap-2">
                {field.display_label}
                {!canEdit && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">View Only</span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {field.field_name} • {field.field_type}
                {field.is_required && " • Required"}
                {field.is_calculated && " • Calculated"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onMoveUp}
              disabled={!canEdit || index === 0}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onMoveDown}
              disabled={!canEdit}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onDelete}
              disabled={!canEdit}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Field Name (Code) */}
            <div className="space-y-2">
              <Label>Field Name (Code)</Label>
              <Input
                value={field.field_name}
                onChange={(e) => onUpdate({ field_name: e.target.value })}
                placeholder="field_name"
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Use lowercase, underscores only
              </p>
            </div>

            {/* Display Label */}
            <div className="space-y-2">
              <Label>Display Label</Label>
              <Input
                value={field.display_label}
                onChange={(e) => onUpdate({ display_label: e.target.value })}
                placeholder="Field Label"
                disabled={!canEdit}
              />
            </div>

            {/* Field Type */}
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select
                value={field.field_type}
                onValueChange={(value) => onUpdate({ field_type: value })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="integer">Integer</SelectItem>
                  <SelectItem value="decimal">Decimal</SelectItem>
                  <SelectItem value="currency">Currency (NPR)</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="dropdown">Dropdown</SelectItem>
                  <SelectItem value="vehicle_number">Vehicle Number</SelectItem>
                  <SelectItem value="phone_number">Phone Number</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Unit */}
            <div className="space-y-2">
              <Label>Unit (Optional)</Label>
              <Input
                value={field.unit || ""}
                onChange={(e) => onUpdate({ unit: e.target.value })}
                placeholder="e.g., NPR, %, subscribers"
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Checkboxes Row */}
          <div className="flex gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`required-${field.id}`}
                checked={field.is_required}
                onCheckedChange={(checked) => onUpdate({ is_required: !!checked })}
                disabled={!canEdit}
              />
              <Label 
                htmlFor={`required-${field.id}`} 
                className={`cursor-pointer ${!canEdit ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Required Field
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id={`calculated-${field.id}`}
                checked={field.is_calculated}
                onCheckedChange={(checked) => onUpdate({ is_calculated: !!checked })}
                disabled={!canEdit}
              />
              <Label 
                htmlFor={`calculated-${field.id}`} 
                className={`cursor-pointer ${!canEdit ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Calculated Field
              </Label>
            </div>
          </div>

          {/* Min/Max Values (for numeric types) */}
          {isNumericType && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum Value</Label>
                <Input
                  type="number"
                  value={field.min_value || ""}
                  onChange={(e) => onUpdate({ min_value: parseFloat(e.target.value) || null })}
                  placeholder="0"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label>Maximum Value</Label>
                <Input
                  type="number"
                  value={field.max_value || ""}
                  onChange={(e) => onUpdate({ max_value: parseFloat(e.target.value) || null })}
                  placeholder="999999"
                  disabled={!canEdit}
                />
              </div>
            </div>
          )}

          {/* Calculation Formula */}
          {field.is_calculated && (
            <div className="space-y-2">
              <Label>Calculation Formula</Label>
              <Input
                value={field.calculation_formula || ""}
                onChange={(e) => onUpdate({ calculation_formula: e.target.value })}
                placeholder="e.g., field1 + field2 + field3"
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Use field names and operators: +, -, *, /, ()
              </p>
            </div>
          )}

          {/* Placeholder */}
          <div className="space-y-2">
            <Label>Placeholder Text</Label>
            <Input
              value={field.placeholder || ""}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
              placeholder="Enter value..."
              disabled={!canEdit}
            />
          </div>

          {/* Help Text */}
          <div className="space-y-2">
            <Label>Help Text</Label>
            <Textarea
              value={field.help_text || ""}
              onChange={(e) => onUpdate({ help_text: e.target.value })}
              placeholder="Instructions for users filling this field"
              rows={2}
              disabled={!canEdit}
            />
          </div>

          {/* View Only Message */}
          {!canEdit && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-600" />
              <div className="text-sm text-blue-700">
                <strong>View Only:</strong> You don't have permission to edit this form. 
                Contact a Super Administrator for modifications.
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}