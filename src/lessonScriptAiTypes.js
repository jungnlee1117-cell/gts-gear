/** AI 대본 생성 — 입력/출력 타입 및 폼 옵션 */

export const AI_TARGET_AGES = [
  { id: "3-4", label: "3~4세" },
  { id: "5-6", label: "5~6세" },
  { id: "7+", label: "7세 이상" },
  { id: "mixed", label: "혼합 연령" },
];

export const AI_ATMOSPHERES = [
  { id: "calm", label: "차분한" },
  { id: "normal", label: "보통" },
  { id: "energetic", label: "활발한" },
  { id: "competitive", label: "경쟁적인" },
];

export const AI_ACTIVITY_TYPES = {
  WARMUP: "warmup-activity",
  GAME: "game",
  GEAR: "gear-lesson",
};

/**
 * @typedef {Object} AiGenerateInput
 * @property {string} activityName
 * @property {string} targetAge
 * @property {string} goal
 * @property {string} atmosphere
 * @property {string} gear
 * @property {string} precautions
 * @property {string} activityType
 * @property {string} [gearLabel]
 * @property {string} [levelLabel]
 */

/**
 * @typedef {Object} DifficultyText
 * @property {string} easy
 * @property {string} medium
 * @property {string} hard
 */

/**
 * @typedef {Object} ActivityScriptMeta
 * @property {string} [description]
 * @property {string} [setup]
 * @property {string} [progressSteps]
 * @property {string} [recommendedAge]
 * @property {string} [recommendedDuration]
 * @property {string} [appropriateSize]
 * @property {string} [energyLevel]
 * @property {string} [ruleDifficulty]
 * @property {string[]} [physicalGoalTags]
 * @property {string[]} [atmosphereTags]
 * @property {string[]} [recommendedSituations]
 * @property {string[]} [avoidSituations]
 */

/**
 * @typedef {Object} AiGeneratedScript
 * @property {DifficultyText} default
 * @property {DifficultyText[]} alternatives
 */

/**
 * @typedef {Object} AiGenerateResult
 * @property {string} activityName
 * @property {ActivityScriptMeta} meta
 * @property {AiGeneratedScript} scripts
 * @property {AiGeneratedScript} safetyMemo
 * @property {string} [gearLessonText]
 * @property {"ai"|"local"} source
 */

export function createEmptyAiInput(activityType = AI_ACTIVITY_TYPES.WARMUP) {
  return {
    activityName: "",
    targetAge: "5-6",
    goal: "",
    atmosphere: "normal",
    gear: "",
    precautions: "",
    activityType,
    gearLabel: "",
    levelLabel: "",
  };
}

export function createEmptyAiResult() {
  return {
    activityName: "",
    meta: {
      description: "",
      setup: "",
      progressSteps: "",
      recommendedAge: "",
      recommendedDuration: "",
      appropriateSize: "",
      energyLevel: "",
      ruleDifficulty: "",
      physicalGoalTags: [],
      atmosphereTags: [],
      recommendedSituations: [],
      avoidSituations: [],
    },
    scripts: { default: { easy: "", medium: "", hard: "" }, alternatives: [] },
    safetyMemo: { default: { easy: "", medium: "", hard: "" }, alternatives: [] },
    gearLessonText: "",
    source: "local",
  };
}

export function aiResultToVariantBlock(result) {
  return {
    label: result.activityName,
    default: result.scripts.default,
    alternatives: result.scripts.alternatives || [],
  };
}

export function aiResultToSafetyBlock(result) {
  return {
    label: `${result.activityName} 안전 멘트`,
    default: result.safetyMemo.default,
    alternatives: result.safetyMemo.alternatives || [],
  };
}

export function aiResultToActivityRecord(result, id = "") {
  return {
    id,
    label: result.activityName,
    meta: result.meta,
  };
}
