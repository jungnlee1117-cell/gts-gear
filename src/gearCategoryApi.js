import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || "",
);

export async function fetchGearCategories() {
  const { data, error } = await supabase
    .from("gear_categories")
    .select("id, label, color, icon, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function insertGearCategory(row) {
  const { data, error } = await supabase
    .from("gear_categories")
    .insert({
      ...row,
      updated_at: new Date().toISOString(),
    })
    .select("id, label, color, icon, sort_order")
    .single();
  if (error) throw error;
  return data;
}

export async function updateGearCategory(id, patch) {
  const { data, error } = await supabase
    .from("gear_categories")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, label, color, icon, sort_order")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGearCategory(id) {
  const { error } = await supabase
    .from("gear_categories")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function saveGearCategoryOrder(orderedIds) {
  const now = new Date().toISOString();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("gear_categories")
        .update({ sort_order: index + 1, updated_at: now })
        .eq("id", id),
    ),
  );
  const failed = results.find(r => r.error);
  if (failed?.error) throw failed.error;
}
