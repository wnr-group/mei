import { createClient } from "@/lib/supabase/client";
import type { MeasurementField } from "@/types";

// Prettified names for the fixed anatomical field keys. Custom fields use
// their stored free-text label instead.
export const FIELD_LABELS: Record<string, string> = {
  bust: "Bust",
  upper_bust: "Upper Bust",
  under_bust: "Under Bust",
  waist: "Waist",
  hip: "Hip",
  shoulder: "Shoulder",
  blouse_length: "Blouse Length",
  sleeve_length: "Sleeve Length",
  lehenga_length: "Lehenga Length",
  bottom_length: "Bottom Length",
  dupatta_length: "Dupatta Length",
  torso_length: "Torso Length",
  back_length: "Back Length",
  front_length: "Front Length",
  height: "Height",
  armhole: "Armhole",
  neck_depth_front: "Neck Depth (Front)",
  neck_depth_back: "Neck Depth (Back)",
  neck_circumference: "Neck Circumference",
  bicep: "Bicep",
  wrist: "Wrist",
  elbow: "Elbow",
  inseam: "Inseam",
  thigh: "Thigh",
  knee: "Knee",
  calf: "Calf",
  ankle: "Ankle",
};

type FieldRow = {
  field_key: string;
  label: string | null;
  is_required: boolean;
  sort_order: number;
};

async function fetchTemplateFields(
  supabase: ReturnType<typeof createClient>,
  templateId: string
): Promise<MeasurementField[]> {
  const { data, error } = await supabase
    .from("measurement_template_fields")
    .select("field_key, label, is_required, sort_order")
    .eq("template_id", templateId)
    .order("sort_order");
  if (error || !data) return [];
  return (data as FieldRow[]).map((f) => ({
    key: f.field_key,
    label:
      f.field_key === "custom"
        ? (f.label ?? "Custom")
        : (FIELD_LABELS[f.field_key] ?? f.field_key),
    is_required: f.is_required,
  }));
}

// Browser-side resolver used at checkout (the cart item only carries the
// product id). Mirrors the server rule: product override → primary category
// template → none. Reads are allowed for anon via the public SELECT policies.
export async function getMeasurementFieldsForProduct(
  productId: string
): Promise<MeasurementField[]> {
  const supabase = createClient();

  const { data: override } = await supabase
    .from("measurement_templates")
    .select("id")
    .eq("product_id", productId)
    .is("deleted_at", null)
    .maybeSingle();
  if (override?.id) return fetchTemplateFields(supabase, override.id);

  const { data: prod } = await supabase
    .from("products")
    .select("category_id")
    .eq("id", productId)
    .maybeSingle();
  if (!prod?.category_id) return [];

  const { data: cat } = await supabase
    .from("categories")
    .select("measurement_template_id")
    .eq("id", prod.category_id)
    .maybeSingle();
  if (cat?.measurement_template_id) {
    return fetchTemplateFields(supabase, cat.measurement_template_id);
  }
  return [];
}
