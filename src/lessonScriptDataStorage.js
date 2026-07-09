import {
  ADMIN_COLLECTIONS,
  LESSON_SCRIPT_DATA_VERSION,
} from "./lessonScriptDataTypes.js";

const STORAGE_KEY = "gts_lesson_script_admin_data_v1";

/** @returns {import("./lessonScriptDataTypes.js").LessonScriptAdminPatch | null} */
export function loadAdminPatch() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      version: parsed.version || LESSON_SCRIPT_DATA_VERSION,
      updatedAt: parsed.updatedAt || "",
      collections: parsed.collections || {},
    };
  } catch {
    return null;
  }
}

/** @param {import("./lessonScriptDataTypes.js").LessonScriptAdminPatch} patch */
export function saveAdminPatch(patch) {
  const row = {
    version: LESSON_SCRIPT_DATA_VERSION,
    updatedAt: new Date().toISOString(),
    collections: patch.collections || {},
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(row));
  return row;
}

export function clearAdminPatch() {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasAdminPatch() {
  return !!localStorage.getItem(STORAGE_KEY);
}

/** @param {string} collectionKey */
export function getCollectionPatch(collectionKey) {
  const patch = loadAdminPatch();
  return patch?.collections?.[collectionKey] || null;
}

/**
 * @param {string} collectionKey
 * @param {import("./lessonScriptDataTypes.js").CollectionPatch} collectionPatch
 */
export function saveCollectionPatch(collectionKey, collectionPatch) {
  const current = loadAdminPatch() || {
    version: LESSON_SCRIPT_DATA_VERSION,
    updatedAt: "",
    collections: {},
  };
  current.collections[collectionKey] = collectionPatch;
  return saveAdminPatch(current);
}

export function resetCollectionPatch(collectionKey) {
  const current = loadAdminPatch();
  if (!current?.collections?.[collectionKey]) return null;
  const { [collectionKey]: _, ...rest } = current.collections;
  if (!Object.keys(rest).length) {
    clearAdminPatch();
    return null;
  }
  return saveAdminPatch({ ...current, collections: rest });
}

export function listPatchedCollectionKeys() {
  const patch = loadAdminPatch();
  return Object.keys(patch?.collections || {});
}

export const LOCAL_ADMIN_STORAGE_KEY = STORAGE_KEY;
export const LOCAL_SAVED_LESSONS_KEY = "gts_lesson_scripts_v1";

export function readLocalSavedLessons() {
  try {
    const raw = localStorage.getItem(LOCAL_SAVED_LESSONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function hasLocalSavedLessons() {
  return readLocalSavedLessons().length > 0;
}

export function clearLocalSavedLessons() {
  localStorage.removeItem(LOCAL_SAVED_LESSONS_KEY);
}

export { STORAGE_KEY, ADMIN_COLLECTIONS };
