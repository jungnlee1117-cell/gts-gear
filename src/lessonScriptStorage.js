import {
  deleteSavedLessonFromSupabase,
  getSavedLessonFromSupabase,
  listSavedLessonsFromSupabase,
  mapSavedLessonRow,
  saveLessonToSupabase,
} from "./lessonScriptSavedLessonsApi.js";
import { isLessonScriptSupabaseConfigured } from "./lessonScriptSupabase.js";
import { readLocalSavedLessons } from "./lessonScriptDataStorage.js";
import {
  createFinalScriptV2,
  normalizeLocalSavedLesson,
} from "./lessonScriptSavedLessonV2.js";

const STORAGE_KEY = "gts_lesson_scripts_v1";

function readAllLocal() {
  const rows = readLocalSavedLessons();
  const normalized = rows.map(normalizeLocalSavedLesson).filter(Boolean);
  if (rows.some(row => row?.version !== 2 || !row?.finalScript)) {
    writeAllLocal(normalized);
  }
  return normalized;
}

function writeAllLocal(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function saveLessonScriptLocal(payload) {
  const now = new Date().toISOString();
  const rows = readAllLocal();
  const existingIdx = payload.id ? rows.findIndex(r => r.id === payload.id) : -1;

  const row = {
    id: payload.id || crypto.randomUUID(),
    title: payload.title?.trim() || "제목 없는 수업 대본",
    warmupSetId: payload.warmupSetId,
    warmupActivityId: payload.warmupActivityId || null,
    gearId: payload.gearId || null,
    gameId: payload.gameId || null,
    levelId: payload.levelId || "foundation",
    difficultyId: payload.difficultyId || "medium",
    customTexts: payload.customTexts || {},
    safetyOverrides: payload.safetyOverrides || {},
    recommendMeta: payload.recommendMeta || null,
    fullText: payload.fullText || "",
    sections: payload.sections || [],
    version: 2,
    finalScript: createFinalScriptV2(payload),
    createdAt: existingIdx >= 0 ? rows[existingIdx].createdAt : now,
    updatedAt: now,
  };

  if (existingIdx >= 0) rows[existingIdx] = row;
  else rows.unshift(row);

  writeAllLocal(rows);
  return row;
}

/** @param {string} [userId] */
export async function listSavedLessonScripts(userId) {
  if (isLessonScriptSupabaseConfigured() && userId) {
    try {
      return await listSavedLessonsFromSupabase();
    } catch {
      // fallback
    }
  }
  return readAllLocal().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export async function getSavedLessonScript(id, userId) {
  if (isLessonScriptSupabaseConfigured() && userId) {
    try {
      const row = await getSavedLessonFromSupabase(id);
      if (row) return row;
    } catch {
      // fallback
    }
  }
  return readAllLocal().find(row => row.id === id) ?? null;
}

/** @param {object} payload @param {string} [userId] */
export async function saveLessonScript(payload, userId) {
  if (!userId) {
    return saveLessonScriptLocal(payload);
  }

  if (isLessonScriptSupabaseConfigured()) {
    try {
      return await saveLessonToSupabase(payload, userId);
    } catch {
      // fallback
    }
  }

  return saveLessonScriptLocal(payload);
}

/** @param {string} id @param {string} [userId] */
export async function deleteSavedLessonScript(id, userId) {
  if (isLessonScriptSupabaseConfigured() && userId) {
    try {
      await deleteSavedLessonFromSupabase(id);
      return;
    } catch {
      // fallback
    }
  }
  writeAllLocal(readAllLocal().filter(r => r.id !== id));
}

export { mapSavedLessonRow };
