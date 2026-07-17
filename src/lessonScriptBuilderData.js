/** 수업 대본 만들기 — 모듈 데이터 (기본값 + 관리자 오버라이드) */

export { LESSON_SCRIPT_LEVELS } from "./lessonScriptDataDefaults.js";

export {
  getWarmupSets,
  getWarmupActivities,
  getGameActivities,
  getClosingActivities,
  getWarmupPartVariantsMap,
  getWarmupSetVariantsMap,
  getWarmupActivityVariantsMap,
  getGameVariantsMap,
  getClosingVariantsMap,
  getSafetyMemosMap,
  findWarmupSet,
  findWarmupActivity,
  findGame,
  findClosing,
  getWarmupPartVariants,
  getWarmupSetVariants,
  getWarmupActivityVariants,
  getGameVariants,
  getClosingVariants,
  getSafetyMemo,
  getGearLessonOverrideText,
  listGearLessonOverrides,
  getAllAlternatives,
  genericActivityPlaceholder,
} from "./lessonScriptDataRepository.js";
