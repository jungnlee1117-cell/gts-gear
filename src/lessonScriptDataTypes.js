/**
 * 수업 대본 데이터 타입 정의
 * Supabase 전환 시 동일 스키마로 매핑 가능하도록 분리
 */

/** @typedef {"easy"|"medium"|"hard"} DifficultyId */

/**
 * @typedef {Object} DifficultyText
 * @property {string} easy
 * @property {string} medium
 * @property {string} hard
 */

/**
 * @typedef {Object} ScriptVariantBlock
 * @property {string} [label]
 * @property {DifficultyText} default
 * @property {DifficultyText[]} alternatives
 */

/**
 * @typedef {Object} WarmupSetRecord
 * @property {string} id
 * @property {string} label
 * @property {string} desc
 * @property {string[]} partIds
 */

/**
 * @typedef {Object} ActivityRecord
 * @property {string} id
 * @property {string} label
 * @property {string} [title]
 * @property {string} [title_en]
 * @property {"warmup"|"game"} [stage]
 * @property {"large"|"medium"|"small"|"none"} [space_requirement]
 * @property {"easy"|"medium"|"hard"} [difficulty]
 * @property {number} [duration_minutes]
 * @property {string} [materials]
 * @property {string} [script]
 * @property {import("./lessonScriptAiTypes.js").ActivityScriptMeta} [meta]
 */

/**
 * @typedef {Object} GearLessonOverride
 * @property {string} gearId
 * @property {"foundation"|"interactive"} levelId
 * @property {string} text
 */

/**
 * @typedef {Object} CollectionPatch
 * @property {unknown} [upsert]
 * @property {string[]} [deleteIds]
 */

/**
 * @typedef {Object} LessonScriptAdminPatch
 * @property {number} version
 * @property {string} updatedAt
 * @property {Record<string, CollectionPatch>} collections
 */

export const LESSON_SCRIPT_DATA_VERSION = 1;

export const ADMIN_COLLECTIONS = {
  WARMUP_SETS: "warmupSets",
  WARMUP_PART_VARIANTS: "warmupPartVariants",
  WARMUP_ACTIVITIES: "warmupActivities",
  WARMUP_ACTIVITY_VARIANTS: "warmupActivityVariants",
  GAMES: "games",
  GAME_VARIANTS: "gameVariants",
  GEAR_INTRO: "gearIntroVariants",
  GEAR_LESSON_OVERRIDES: "gearLessonOverrides",
  SAFETY_MEMOS: "safetyMemos",
};

export const SAFETY_SLOT_IDS = ["beforeWarmup", "beforeGear", "beforeGame"];

export const SAFETY_SLOT_LABELS = {
  beforeWarmup: "준비운동 전",
  beforeGear: "교구 수업 전",
  beforeGame: "게임 활동 전",
};

export const DIFFICULTY_FIELDS = [
  { id: "easy", label: "쉬움" },
  { id: "medium", label: "보통" },
  { id: "hard", label: "어려움" },
];

export function createEmptyDifficultyText() {
  return { easy: "", medium: "", hard: "" };
}

export function createEmptyVariantBlock(label = "") {
  return {
    label,
    default: createEmptyDifficultyText(),
    alternatives: [],
  };
}

export function createSlugId(label) {
  const base = String(label || "item")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "item"}-${suffix}`;
}

export function cloneDifficultyText(value) {
  return {
    easy: value?.easy || "",
    medium: value?.medium || "",
    hard: value?.hard || "",
  };
}

export function cloneVariantBlock(block) {
  if (!block) return createEmptyVariantBlock();
  return {
    label: block.label || "",
    default: cloneDifficultyText(block.default),
    alternatives: (block.alternatives || []).map(cloneDifficultyText),
  };
}

export function gearLessonOverrideKey(gearId, levelId) {
  return `${gearId}::${levelId}`;
}
