/** 수업 대본 만들기 — 모듈 데이터 (기본값 + 관리자 오버라이드) */

export { LESSON_SCRIPT_LEVELS, GEAR_INTRO_SCRIPT } from "./lessonScriptDataDefaults.js";

export {
  getWarmupSets,
  getWarmupActivities,
  getGameActivities,
  getWarmupPartVariantsMap,
  getWarmupActivityVariantsMap,
  getGameVariantsMap,
  getGearIntroVariants,
  getSafetyMemosMap,
  findWarmupSet,
  findWarmupActivity,
  findGame,
  getWarmupPartVariants,
  getWarmupActivityVariants,
  getGameVariants,
  getSafetyMemo,
  getGearLessonOverrideText,
  listGearLessonOverrides,
  getAllAlternatives,
  genericActivityPlaceholder,
} from "./lessonScriptDataRepository.js";
