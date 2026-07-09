import {
  DEFAULT_SAFETY_MEMOS,
  GAME_ACTIVITIES,
  GAME_VARIANTS,
  GEAR_INTRO_VARIANTS,
  WARMUP_ACTIVITIES,
  WARMUP_ACTIVITY_VARIANTS,
  WARMUP_PART_VARIANTS,
  WARMUP_SETS,
} from "./lessonScriptDataDefaults.js";
import {
  deleteAdminCollectionFromSupabase,
  fetchAdminPatchFromSupabase,
  upsertAdminCollectionToSupabase,
} from "./lessonScriptAdminDataApi.js";
import {
  getAdminDataSource,
  getAdminLoadPromise,
  getCachedAdminPatch,
  invalidateAdminDataCache,
  setAdminLoadPromise,
  setCachedAdminPatch,
} from "./lessonScriptDataCache.js";
import {
  ADMIN_COLLECTIONS,
  gearLessonOverrideKey,
  LESSON_SCRIPT_DATA_VERSION,
} from "./lessonScriptDataTypes.js";
import {
  clearAdminPatch as clearLocalAdminPatch,
  loadAdminPatch as loadLocalAdminPatch,
  saveAdminPatch as saveLocalAdminPatch,
} from "./lessonScriptDataStorage.js";
import { isLessonScriptSupabaseConfigured } from "./lessonScriptSupabase.js";

function resolveAdminPatch() {
  return getCachedAdminPatch() || loadLocalAdminPatch();
}

function getCollectionPatch(collectionKey) {
  const patch = resolveAdminPatch();
  return patch?.collections?.[collectionKey] || null;
}

/** @returns {Promise<import("./lessonScriptDataTypes.js").LessonScriptAdminPatch | null>} */
export async function initLessonScriptAdminData() {
  const existing = getAdminLoadPromise();
  if (existing) return existing;

  const promise = (async () => {
    if (isLessonScriptSupabaseConfigured()) {
      try {
        const remote = await fetchAdminPatchFromSupabase();
        if (remote) {
          setCachedAdminPatch(remote, "supabase");
          saveLocalAdminPatch(remote);
          return remote;
        }
      } catch {
        // fallback below
      }
    }

    const local = loadLocalAdminPatch();
    if (local) {
      setCachedAdminPatch(local, "local");
      return local;
    }

    setCachedAdminPatch(null, "defaults");
    return null;
  })();

  setAdminLoadPromise(promise);
  return promise;
}

export function invalidateLessonScriptAdminData() {
  invalidateAdminDataCache();
}

async function persistCollectionPatch(collectionKey, collectionPatch, userId) {
  const current = resolveAdminPatch() || {
    version: LESSON_SCRIPT_DATA_VERSION,
    updatedAt: "",
    collections: {},
  };

  const next = {
    ...current,
    version: LESSON_SCRIPT_DATA_VERSION,
    updatedAt: new Date().toISOString(),
    collections: {
      ...current.collections,
      [collectionKey]: collectionPatch,
    },
  };

  let source = "local";

  if (isLessonScriptSupabaseConfigured() && userId) {
    try {
      const isEmpty = !collectionPatch?.upsert
        || (Array.isArray(collectionPatch.upsert) && collectionPatch.upsert.length === 0)
        || (typeof collectionPatch.upsert === "object" && !Array.isArray(collectionPatch.upsert) && !Object.keys(collectionPatch.upsert).length);

      if (isEmpty && !(collectionPatch?.deleteIds?.length)) {
        await deleteAdminCollectionFromSupabase(collectionKey);
      } else {
        await upsertAdminCollectionToSupabase(collectionKey, collectionPatch, userId);
      }

      const remote = await fetchAdminPatchFromSupabase();
      if (remote) {
        setCachedAdminPatch(remote, "supabase");
        saveLocalAdminPatch(remote);
        return remote;
      }
      source = "supabase";
    } catch {
      // local fallback
    }
  }

  saveLocalAdminPatch(next);
  setCachedAdminPatch(next, source);
  return next;
}

function mergeArrayById(defaultItems, collectionKey) {
  const patch = getCollectionPatch(collectionKey);
  if (!patch) return [...defaultItems];
  const map = new Map(defaultItems.map(item => [item.id, { ...item }]));
  for (const id of patch.deleteIds || []) map.delete(id);
  const upserts = Array.isArray(patch.upsert) ? patch.upsert : [];
  for (const item of upserts) {
    if (item?.id) map.set(item.id, { ...item });
  }
  return Array.from(map.values());
}

function mergeObjectRecords(defaultObj, collectionKey) {
  const patch = getCollectionPatch(collectionKey);
  if (!patch) return { ...defaultObj };
  const result = { ...defaultObj };
  for (const id of patch.deleteIds || []) delete result[id];
  const upserts = patch.upsert && typeof patch.upsert === "object" && !Array.isArray(patch.upsert)
    ? patch.upsert
    : {};
  for (const [key, value] of Object.entries(upserts)) {
    if (value) result[key] = value;
  }
  return result;
}

function mergeSingleRecord(defaultRecord, collectionKey) {
  const patch = getCollectionPatch(collectionKey);
  if (!patch?.upsert) return { ...defaultRecord };
  return { ...defaultRecord, ...patch.upsert };
}

function mergeGearLessonOverrides() {
  const patch = getCollectionPatch(ADMIN_COLLECTIONS.GEAR_LESSON_OVERRIDES);
  const map = new Map();
  const upserts = Array.isArray(patch?.upsert) ? patch.upsert : [];
  for (const row of upserts) {
    if (!row?.gearId || !row?.levelId) continue;
    map.set(gearLessonOverrideKey(row.gearId, row.levelId), row.text || "");
  }
  for (const key of patch?.deleteIds || []) map.delete(key);
  return map;
}

export function getWarmupSets() {
  return mergeArrayById(WARMUP_SETS, ADMIN_COLLECTIONS.WARMUP_SETS);
}

export function getWarmupActivities() {
  return mergeArrayById(WARMUP_ACTIVITIES, ADMIN_COLLECTIONS.WARMUP_ACTIVITIES);
}

export function getGameActivities() {
  return mergeArrayById(GAME_ACTIVITIES, ADMIN_COLLECTIONS.GAMES);
}

export function getWarmupPartVariantsMap() {
  return mergeObjectRecords(WARMUP_PART_VARIANTS, ADMIN_COLLECTIONS.WARMUP_PART_VARIANTS);
}

export function getWarmupActivityVariantsMap() {
  return mergeObjectRecords(WARMUP_ACTIVITY_VARIANTS, ADMIN_COLLECTIONS.WARMUP_ACTIVITY_VARIANTS);
}

export function getGameVariantsMap() {
  return mergeObjectRecords(GAME_VARIANTS, ADMIN_COLLECTIONS.GAME_VARIANTS);
}

export function getGearIntroVariants() {
  return mergeSingleRecord(GEAR_INTRO_VARIANTS, ADMIN_COLLECTIONS.GEAR_INTRO);
}

export function getSafetyMemosMap() {
  return mergeObjectRecords(DEFAULT_SAFETY_MEMOS, ADMIN_COLLECTIONS.SAFETY_MEMOS);
}

export function findWarmupSet(id) {
  return getWarmupSets().find(s => s.id === id) ?? null;
}

export function findWarmupActivity(id) {
  return getWarmupActivities().find(a => a.id === id) ?? null;
}

export function findGame(id) {
  return getGameActivities().find(g => g.id === id) ?? null;
}

export function getWarmupPartVariants(partId) {
  return getWarmupPartVariantsMap()[partId] ?? null;
}

export function getWarmupActivityVariants(activityId) {
  return getWarmupActivityVariantsMap()[activityId] ?? null;
}

export function getGameVariants(gameId) {
  return getGameVariantsMap()[gameId] ?? null;
}

export function getSafetyMemo(slotId) {
  return getSafetyMemosMap()[slotId] ?? null;
}

export function getGearLessonOverrideText(gearId, levelId) {
  const map = mergeGearLessonOverrides();
  return map.get(gearLessonOverrideKey(gearId, levelId)) ?? null;
}

export function getGearLessonOverrideMeta(gearId, levelId) {
  const patch = getCollectionPatch(ADMIN_COLLECTIONS.GEAR_LESSON_OVERRIDES);
  const upserts = Array.isArray(patch?.upsert) ? patch.upsert : [];
  const row = upserts.find(r => gearLessonOverrideKey(r.gearId, r.levelId) === gearLessonOverrideKey(gearId, levelId));
  return row?.meta || null;
}

export function listGearLessonOverrides() {
  const map = mergeGearLessonOverrides();
  return Array.from(map.entries()).map(([key, text]) => {
    const [gearId, levelId] = key.split("::");
    return { gearId, levelId, text };
  });
}

export function getAllAlternatives(sectionKey, contextId = null) {
  if (sectionKey === "gear-intro") {
    const block = getGearIntroVariants();
    return [block.default, ...(block.alternatives || [])];
  }
  if (sectionKey.startsWith("safety-")) {
    const key = sectionKey.replace("safety-", "");
    const block = getSafetyMemo(key);
    if (!block) return [];
    return [block.default, ...(block.alternatives || [])];
  }
  if (sectionKey === "warmup-activity" && contextId) {
    const block = getWarmupActivityVariants(contextId);
    if (!block) return [];
    return [block.default, ...(block.alternatives || [])];
  }
  if (sectionKey === "game" && contextId) {
    const block = getGameVariants(contextId);
    if (!block) return [];
    return [block.default, ...(block.alternatives || [])];
  }
  const part = getWarmupPartVariants(sectionKey);
  if (!part) return [];
  return [part.default, ...(part.alternatives || [])];
}

export function genericActivityPlaceholder(label, difficultyId) {
  const templates = {
    easy: `${label} — let's try together! Copy teacher!`,
    medium: `Let's do ${label}! Follow teacher and have fun!`,
    hard: `${label} time! Listen to the rules, then lead your team in English!`,
  };
  return templates[difficultyId] || templates.medium;
}

async function upsertArrayItem(collectionKey, item, defaultItems, userId) {
  const patch = getCollectionPatch(collectionKey) || { upsert: [], deleteIds: [] };
  const upserts = Array.isArray(patch.upsert) ? [...patch.upsert] : [];
  const idx = upserts.findIndex(row => row.id === item.id);
  if (idx >= 0) upserts[idx] = item;
  else upserts.push(item);
  const deleteIds = (patch.deleteIds || []).filter(id => id !== item.id);
  return persistCollectionPatch(collectionKey, { upsert: upserts, deleteIds }, userId);
}

async function deleteArrayItem(collectionKey, id, defaultItems, userId) {
  const patch = getCollectionPatch(collectionKey) || { upsert: [], deleteIds: [] };
  const upserts = (Array.isArray(patch.upsert) ? patch.upsert : []).filter(row => row.id !== id);
  const deleteIds = [...new Set([...(patch.deleteIds || []), id])];
  return persistCollectionPatch(collectionKey, { upsert: upserts, deleteIds }, userId);
}

async function upsertObjectRecord(collectionKey, recordId, value, defaultObj, userId) {
  const patch = getCollectionPatch(collectionKey) || { upsert: {}, deleteIds: [] };
  const upserts = { ...(patch.upsert || {}) };
  upserts[recordId] = value;
  const deleteIds = (patch.deleteIds || []).filter(rid => rid !== recordId);
  return persistCollectionPatch(collectionKey, { upsert: upserts, deleteIds }, userId);
}

async function deleteObjectRecord(collectionKey, recordId, defaultObj, userId) {
  const patch = getCollectionPatch(collectionKey) || { upsert: {}, deleteIds: [] };
  const upserts = { ...(patch.upsert || {}) };
  delete upserts[recordId];
  const deleteIds = [...new Set([...(patch.deleteIds || []), recordId])];
  return persistCollectionPatch(collectionKey, { upsert: upserts, deleteIds }, userId);
}

export function saveWarmupSet(record, userId) {
  return upsertArrayItem(ADMIN_COLLECTIONS.WARMUP_SETS, record, WARMUP_SETS, userId);
}

export function deleteWarmupSet(id, userId) {
  return deleteArrayItem(ADMIN_COLLECTIONS.WARMUP_SETS, id, WARMUP_SETS, userId);
}

export function saveWarmupActivity(record, userId) {
  return upsertArrayItem(ADMIN_COLLECTIONS.WARMUP_ACTIVITIES, record, WARMUP_ACTIVITIES, userId);
}

export function deleteWarmupActivity(id, userId) {
  return deleteArrayItem(ADMIN_COLLECTIONS.WARMUP_ACTIVITIES, id, WARMUP_ACTIVITIES, userId);
}

export function saveGameActivity(record, userId) {
  return upsertArrayItem(ADMIN_COLLECTIONS.GAMES, record, GAME_ACTIVITIES, userId);
}

export function deleteGameActivity(id, userId) {
  return deleteArrayItem(ADMIN_COLLECTIONS.GAMES, id, GAME_ACTIVITIES, userId);
}

export function saveWarmupPartVariant(partId, block, userId) {
  return upsertObjectRecord(ADMIN_COLLECTIONS.WARMUP_PART_VARIANTS, partId, block, WARMUP_PART_VARIANTS, userId);
}

export function deleteWarmupPartVariant(partId, userId) {
  return deleteObjectRecord(ADMIN_COLLECTIONS.WARMUP_PART_VARIANTS, partId, WARMUP_PART_VARIANTS, userId);
}

export function saveWarmupActivityVariant(activityId, block, userId) {
  return upsertObjectRecord(ADMIN_COLLECTIONS.WARMUP_ACTIVITY_VARIANTS, activityId, block, WARMUP_ACTIVITY_VARIANTS, userId);
}

export function deleteWarmupActivityVariant(activityId, userId) {
  return deleteObjectRecord(ADMIN_COLLECTIONS.WARMUP_ACTIVITY_VARIANTS, activityId, WARMUP_ACTIVITY_VARIANTS, userId);
}

export function saveGameVariant(gameId, block, userId) {
  return upsertObjectRecord(ADMIN_COLLECTIONS.GAME_VARIANTS, gameId, block, GAME_VARIANTS, userId);
}

export function deleteGameVariant(gameId, userId) {
  return deleteObjectRecord(ADMIN_COLLECTIONS.GAME_VARIANTS, gameId, GAME_VARIANTS, userId);
}

export function saveGearIntroVariants(block, userId) {
  return persistCollectionPatch(ADMIN_COLLECTIONS.GEAR_INTRO, { upsert: block, deleteIds: [] }, userId);
}

export function saveSafetyMemo(slotId, block, userId) {
  return upsertObjectRecord(ADMIN_COLLECTIONS.SAFETY_MEMOS, slotId, block, DEFAULT_SAFETY_MEMOS, userId);
}

export function saveGearLessonOverride(gearId, levelId, text, userId, meta = null) {
  const patch = getCollectionPatch(ADMIN_COLLECTIONS.GEAR_LESSON_OVERRIDES) || { upsert: [], deleteIds: [] };
  const key = gearLessonOverrideKey(gearId, levelId);
  let upserts = Array.isArray(patch.upsert) ? [...patch.upsert] : [];
  upserts = upserts.filter(row => gearLessonOverrideKey(row.gearId, row.levelId) !== key);
  if (text?.trim() || meta) {
    upserts.push({
      gearId,
      levelId,
      text: text?.trim() || "",
      meta: meta || undefined,
    });
  }
  const deleteIds = (patch.deleteIds || []).filter(id => id !== key);
  return persistCollectionPatch(ADMIN_COLLECTIONS.GEAR_LESSON_OVERRIDES, { upsert: upserts, deleteIds }, userId);
}

export function deleteGearLessonOverride(gearId, levelId, userId) {
  const patch = getCollectionPatch(ADMIN_COLLECTIONS.GEAR_LESSON_OVERRIDES) || { upsert: [], deleteIds: [] };
  const key = gearLessonOverrideKey(gearId, levelId);
  const upserts = (Array.isArray(patch.upsert) ? patch.upsert : [])
    .filter(row => gearLessonOverrideKey(row.gearId, row.levelId) !== key);
  const deleteIds = [...new Set([...(patch.deleteIds || []), key])];
  return persistCollectionPatch(ADMIN_COLLECTIONS.GEAR_LESSON_OVERRIDES, { upsert: upserts, deleteIds }, userId);
}

export function getAdminPatchSummary() {
  const patch = resolveAdminPatch();
  const source = getAdminDataSource();
  if (!patch) {
    return { hasData: false, updatedAt: null, collections: [], source };
  }
  return {
    hasData: true,
    updatedAt: patch.updatedAt,
    collections: Object.keys(patch.collections || {}),
    source,
  };
}

export {
  WARMUP_SETS,
  WARMUP_ACTIVITIES,
  GAME_ACTIVITIES,
  WARMUP_PART_VARIANTS,
  WARMUP_ACTIVITY_VARIANTS,
  GAME_VARIANTS,
  GEAR_INTRO_VARIANTS,
  DEFAULT_SAFETY_MEMOS,
} from "./lessonScriptDataDefaults.js";
