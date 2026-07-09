import { LESSON_SCRIPT_DATA_VERSION } from "./lessonScriptDataTypes.js";
import { isLessonScriptSupabaseConfigured, lessonScriptSupabase } from "./lessonScriptSupabase.js";

const TABLE = "lesson_script_admin_data";
const DATA_TYPE = "collection_patch";

/** @returns {Promise<import("./lessonScriptDataTypes.js").LessonScriptAdminPatch | null>} */
export async function fetchAdminPatchFromSupabase() {
  if (!isLessonScriptSupabaseConfigured()) return null;

  const { data, error } = await lessonScriptSupabase
    .from(TABLE)
    .select("data_key, data_json, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  if (!data?.length) return null;

  /** @type {Record<string, import("./lessonScriptDataTypes.js").CollectionPatch>} */
  const collections = {};
  let latestUpdated = "";

  for (const row of data) {
    if (!row?.data_key) continue;
    collections[row.data_key] = row.data_json || {};
    if (row.updated_at && row.updated_at > latestUpdated) latestUpdated = row.updated_at;
  }

  if (!Object.keys(collections).length) return null;

  return {
    version: LESSON_SCRIPT_DATA_VERSION,
    updatedAt: latestUpdated,
    collections,
  };
}

/**
 * @param {string} dataKey
 * @param {import("./lessonScriptDataTypes.js").CollectionPatch} dataJson
 * @param {string} userId
 */
export async function upsertAdminCollectionToSupabase(dataKey, dataJson, userId) {
  if (!isLessonScriptSupabaseConfigured()) {
    throw new Error("Supabase가 설정되지 않았습니다.");
  }

  const now = new Date().toISOString();
  const { data: existing, error: readError } = await lessonScriptSupabase
    .from(TABLE)
    .select("id, created_by")
    .eq("data_key", dataKey)
    .maybeSingle();

  if (readError) throw readError;

  const row = {
    data_key: dataKey,
    data_type: DATA_TYPE,
    data_json: dataJson,
    updated_by: userId,
    updated_at: now,
  };

  if (existing?.id) {
    const { error } = await lessonScriptSupabase
      .from(TABLE)
      .update(row)
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await lessonScriptSupabase
    .from(TABLE)
    .insert({ ...row, created_by: userId });

  if (error) throw error;
}

/** @param {string} dataKey */
export async function deleteAdminCollectionFromSupabase(dataKey) {
  if (!isLessonScriptSupabaseConfigured()) return;

  const { error } = await lessonScriptSupabase
    .from(TABLE)
    .delete()
    .eq("data_key", dataKey);

  if (error) throw error;
}

export async function clearAllAdminDataFromSupabase() {
  if (!isLessonScriptSupabaseConfigured()) return;

  const { error } = await lessonScriptSupabase
    .from(TABLE)
    .delete()
    .neq("data_key", "");

  if (error) throw error;
}
