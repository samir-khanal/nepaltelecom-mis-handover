import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import DynamicDataEntryForm from "./DynamicDataEntryForm";

interface Schema {
  id: string;
  schema_name: string;
  category: string;
}

export default function SchemaSelectorForm() {
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string>("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchemas();
  }, []);

  const fetchSchemas = async () => {
    try {
      const { data, error } = await supabase
        .from("data_entry_schemas")
        .select("id, schema_name, category")
        .eq("is_active", true)
        .order("schema_name");

      if (error) throw error;
      setSchemas(data || []);
    } catch (error: any) {
      toast.error("Failed to load forms: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (m: number) => {
    return new Date(2000, m - 1).toLocaleString("default", { month: "long" });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">Loading forms...</CardContent>
      </Card>
    );
  }

  if (!selectedSchema) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select Data Entry Form</CardTitle>
          <CardDescription>
            Choose a form schema to start data entry for {getMonthName(month)} {year}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Month</label>
              <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger>
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
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Year</label>
              <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Form Schema</label>
              <Select value={selectedSchema} onValueChange={setSelectedSchema}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a form" />
                </SelectTrigger>
                <SelectContent>
                  {schemas.map(schema => (
                    <SelectItem key={schema.id} value={schema.id}>
                      {schema.schema_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {schemas.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No active forms available. Contact administrator to create forms.
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <DynamicDataEntryForm
      schemaId={selectedSchema}
      month={month}
      year={year}
      onSave={() => {
        toast.success("Data saved successfully!");
      }}
    />
  );
}