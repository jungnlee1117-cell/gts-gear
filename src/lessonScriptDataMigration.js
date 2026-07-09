import {
  clearAllAdminDataFromSupabase,
  fetchAdminPatchFromSupabase,
  upsertAdminCollectionToSupabase,
} from "./lessonScriptAdminDataApi.js";
import {
  clearLocalSavedLessons,
  hasAdminPatch,
  hasLocalSavedLessons,
  loadAdminPatch,
  LOCAL_ADMIN_STORAGE_KEY,
  LOCAL_SAVED_LESSONS_KEY,
  readLocalSavedLessons,
  clearAdminPatch,
} from "./lessonScriptDataStorage.js";
import { saveLessonToSupabase } from "./lessonScriptSavedLessonsApi.js";
import { invalidateAdminDataCache } from "./lessonScriptDataCache.js";
import { initLessonScriptAdminData } from "./lessonScriptDataRepository.js";

const MIGRATION_FLAG_KEY = "gts_lesson_script_migrated_to_supabase";

export function isLessonScriptMigrated() {
  return localStorage.getItem(MIGRATION_FLAG_KEY) === "1";
}

export function markLessonScriptMigrated() {
  localStorage.setItem(MIGRATION_FLAG_KEY, "1");
}

export function hasLocalLessonScriptData() {
  return hasAdminPatch() || hasLocalSavedLessons();
}

/**
 * localStorage 관리자 패치 + 저장 대본을 Supabase로 이전
 * @param {string} userId
 */
export async function migrateLocalStorageToSupabase(userId) {
  if (!userId) throw new Error("로그인이 필요합니다.");

  const results = {
    adminCollections: 0,
    savedLessons: 0,
    errors: [],
  };

  const localPatch = loadAdminPatch();
  if (localPatch?.collections) {
    for (const [dataKey, dataJson] of Object.entries(localPatch.collections)) {
      try {
        await upsertAdminCollectionToSupabase(dataKey, dataJson, userId);
        results.adminCollections += 1;
      } catch (err) {
        results.errors.push(`관리자 데이터(${dataKey}): ${err?.message || err}`);
      }
    }
  }

  const localScripts = readLocalSavedLessons();
  for (const script of localScripts) {
    try {
      await saveLessonToSupabase(script, userId);
      results.savedLessons += 1;
    } catch (err) {
      results.errors.push(`저장 대본(${script.title || script.id}): ${err?.message || err}`);
    }
  }

  if (results.errors.length === 0) {
    clearAdminPatch();
    clearLocalSavedLessons();
    markLessonScriptMigrated();
    invalidateAdminDataCache();
    await initLessonScriptAdminData();
  }

  return results;
}

export function getLocalMigrationSummary() {
  const patch = loadAdminPatch();
  const collections = Object.keys(patch?.collections || {});
  const scripts = readLocalSavedLessons();
  return {
    hasAdminPatch: hasAdminPatch(),
    adminCollectionCount: collections.length,
    savedLessonCount: scripts.length,
    migrated: isLessonScriptMigrated(),
    keys: {
      admin: LOCAL_ADMIN_STORAGE_KEY,
      saved: LOCAL_SAVED_LESSONS_KEY,
    },
  };
}

export async function clearRemoteAdminData() {
  await clearAllAdminDataFromSupabase();
  clearAdminPatch();
  invalidateAdminDataCache();
  await initLessonScriptAdminData();
}
