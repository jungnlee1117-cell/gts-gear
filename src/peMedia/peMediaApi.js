import { createClient } from "@supabase/supabase-js";
import { getStoragePath } from "./peMediaUtils.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const peMediaSupabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export async function fetchMediaResources() {
  const { data, error } = await peMediaSupabase
    .from("resources")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function insertMediaResource(payload) {
  const { data, error } = await peMediaSupabase
    .from("resources")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateMediaResource(id, patch) {
  const { data, error } = await peMediaSupabase
    .from("resources")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteMediaResource(res) {
  for (const url of [res.file_url, res.cover_url]) {
    const path = getStoragePath(url);
    if (path) {
      await peMediaSupabase.storage.from("pe-resources").remove([path]);
    }
  }
  const { error } = await peMediaSupabase.from("resources").delete().eq("id", res.id);
  if (error) throw new Error(error.message);
}

export async function uploadPeFile(path, file) {
  const { error } = await peMediaSupabase.storage
    .from("pe-resources")
    .upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  const { data } = peMediaSupabase.storage.from("pe-resources").getPublicUrl(path);
  return data.publicUrl;
}
