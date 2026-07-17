import { isLessonScriptSupabaseConfigured, lessonScriptSupabase } from "./lessonScriptSupabase.js";
import {
  createFinalScriptV2,
  flattenFinalScriptSections,
  normalizeFinalScript,
} from "./lessonScriptSavedLessonV2.js";

const TABLE = "lesson_script_saved_lessons";

/** @param {object} row */
export function mapSavedLessonRow(row) {
  if (!row) return null;
  const opts = row.selected_options_json || {};
  const custom = row.custom_text_json || {};
  const final = normalizeFinalScript(
    row.final_script_json || {},
    opts,
    custom.customTexts || {},
  );
  return {
    id: row.id,
    title: row.title,
    warmupSetId: opts.warmupSetId,
    warmupActivityId: opts.warmupActivityId || null,
    gearId: opts.gearId || null,
    gameId: opts.gameId || null,
    closingId: opts.closingId || null,
    levelId: opts.levelId || "foundation",
    difficultyId: row.difficulty || opts.difficultyId || "medium",
    customTexts: custom.customTexts || {},
    safetyOverrides: custom.safetyOverrides || {},
    recommendMeta: custom.recommendMeta || null,
    fullText: final.fullText || "",
    sections: flattenFinalScriptSections(final),
    finalScript: final,
    version: 2,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

/** @param {object} payload @param {string} userId */
export function mapSavedLessonPayload(payload, userId) {
  return {
    id: payload.id || undefined,
    title: payload.title?.trim() || "제목 없는 수업 대본",
    selected_options_json: {
      warmupSetId: payload.warmupSetId,
      warmupActivityId: payload.warmupActivityId || null,
      gearId: payload.gearId || null,
      gameId: payload.gameId || null,
      closingId: payload.closingId || null,
      levelId: payload.levelId || "foundation",
      difficultyId: payload.difficultyId || "medium",
    },
    final_script_json: createFinalScriptV2(payload),
    custom_text_json: {
      customTexts: payload.customTexts || {},
      safetyOverrides: payload.safetyOverrides || {},
      recommendMeta: payload.recommendMeta || null,
    },
    difficulty: payload.difficultyId || "medium",
    created_by: userId,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
}

export async function listSavedLessonsFromSupabase() {
  if (!isLessonScriptSupabaseConfigured()) return [];

  const { data, error } = await lessonScriptSupabase
    .from(TABLE)
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapSavedLessonRow).filter(Boolean);
}

export async function getSavedLessonFromSupabase(id) {
  if (!isLessonScriptSupabaseConfigured()) return null;

  const { data, error } = await lessonScriptSupabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return mapSavedLessonRow(data);
}

export async function saveLessonToSupabase(payload, userId) {
  if (!isLessonScriptSupabaseConfigured()) {
    throw new Error("Supabase가 설정되지 않았습니다.");
  }

  const row = mapSavedLessonPayload(payload, userId);

  if (payload.id) {
    const { data, error } = await lessonScriptSupabase
      .from(TABLE)
      .update({
        title: row.title,
        selected_options_json: row.selected_options_json,
        final_script_json: row.final_script_json,
        custom_text_json: row.custom_text_json,
        difficulty: row.difficulty,
        updated_by: userId,
        updated_at: row.updated_at,
      })
      .eq("id", payload.id)
      .select("*")
      .single();

    if (error) throw error;
    return mapSavedLessonRow(data);
  }

  const { data, error } = await lessonScriptSupabase
    .from(TABLE)
    .insert({
      title: row.title,
      selected_options_json: row.selected_options_json,
      final_script_json: row.final_script_json,
      custom_text_json: row.custom_text_json,
      difficulty: row.difficulty,
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapSavedLessonRow(data);
}

export async function deleteSavedLessonFromSupabase(id) {
  if (!isLessonScriptSupabaseConfigured()) {
    throw new Error("Supabase가 설정되지 않았습니다.");
  }

  const { error } = await lessonScriptSupabase
    .from(TABLE)
    .delete()
    .eq("id", id);

  if (error) throw error;
}
