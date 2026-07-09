import { difficultyToLevelId } from "./lessonScriptDifficulty.js";
import { findGame, findWarmupActivity } from "./lessonScriptBuilderData.js";
import { getGearCatalogEntry } from "./gearScriptMeta.js";

export const RECOMMEND_AGE_GROUPS = [
  { id: "3-4", label: "3~4세" },
  { id: "5-6", label: "5~6세" },
  { id: "7+", label: "7세 이상" },
];

export const RECOMMEND_DURATIONS = [
  { id: "30", label: "30분" },
  { id: "40", label: "40분" },
  { id: "50", label: "50분" },
  { id: "60", label: "60분" },
];

export const RECOMMEND_KID_COUNTS = [
  { id: "small", label: "~8명" },
  { id: "medium", label: "9~14명" },
  { id: "large", label: "15명+" },
];

export const RECOMMEND_ATMOSPHERES = [
  { id: "calm", label: "차분한 분위기" },
  { id: "normal", label: "보통" },
  { id: "energetic", label: "활발한 분위기" },
];

/**
 * 룰 기반 오늘 수업 추천 조합
 */
export function recommendLessonCombination({
  ageGroup = "5-6",
  duration = "40",
  kidCount = "medium",
  atmosphere = "normal",
  difficultyId = "medium",
}) {
  const reasons = [];

  let warmupActivityId = "stretching";
  if (atmosphere === "energetic") {
    warmupActivityId = kidCount === "large" ? "circle-run" : "dance-warmup";
    reasons.push("활발한 분위기 → 움직임이 많은 준비운동");
  } else if (atmosphere === "calm") {
    warmupActivityId = "stretching";
    reasons.push("차분한 분위기 → 스트레칭 준비운동");
  } else if (ageGroup === "3-4") {
    warmupActivityId = "stretching";
    reasons.push("저연령 → 부드러운 스트레칭");
  } else if (ageGroup === "7+") {
    warmupActivityId = "shuttle-run";
    reasons.push("고연령 → 왕복 달리기");
  } else {
    warmupActivityId = "dance-warmup";
    reasons.push("5~6세 기본 → 댄스 준비운동");
  }

  let gearId = "balance-board";
  if (ageGroup === "3-4") {
    gearId = "bilbo";
    reasons.push("3~4세 → 빌리보 추천");
  } else if (ageGroup === "7+" || difficultyId === "hard") {
    gearId = "air-bridge";
    reasons.push("고연령/어려움 → 에어브릿지");
  } else if (atmosphere === "energetic") {
    gearId = "brick";
    reasons.push("활발한 수업 → 벽돌 교구");
  } else {
    gearId = "balance-board";
    reasons.push("5~6세 기본 → 밸런스보드");
  }

  let gameId = "";
  const dur = Number(duration);
  if (dur >= 50) {
    if (ageGroup === "3-4") gameId = "green-red-light";
    else if (atmosphere === "energetic") gameId = "bomb";
    else if (kidCount === "large") gameId = "rock-paper-scissors";
    else gameId = "peanut-butter";
    reasons.push(`${duration}분 수업 → 게임 활동 포함`);
  } else if (dur >= 40 && atmosphere !== "calm") {
    gameId = ageGroup === "3-4" ? "butterfly" : "green-red-light";
    reasons.push("40분 수업 → 가벼운 게임 1개");
  } else {
    reasons.push(`${duration}분 수업 → 게임 생략 (교구 수업 집중)`);
  }

  let resolvedDifficulty = difficultyId;
  if (ageGroup === "3-4" && difficultyId === "hard") {
    resolvedDifficulty = "medium";
    reasons.push("3~4세는 어려움 대신 보통으로 조정");
  }
  if (ageGroup === "7+" && difficultyId === "easy") {
    resolvedDifficulty = "medium";
    reasons.push("7세 이상은 쉬움 대신 보통으로 조정");
  }

  return {
    warmupSetId: "default-greeting-warmup",
    warmupActivityId,
    gearId,
    gameId,
    difficultyId: resolvedDifficulty,
    levelId: difficultyToLevelId(resolvedDifficulty),
    reasons,
    summary: [
      `난이도 ${RECOMMEND_DIFFICULTY_LABEL(resolvedDifficulty)}`,
      warmupActivityId
        ? `준비운동 · ${findWarmupActivity(warmupActivityId)?.label || warmupActivityId}`
        : "준비운동 생략",
      `교구 · ${getGearCatalogEntry(gearId)?.label || gearId}`,
      gameId ? `게임 · ${findGame(gameId)?.label || gameId}` : "게임 생략",
    ].join(" / "),
  };
}

function RECOMMEND_DIFFICULTY_LABEL(id) {
  return { easy: "쉬움", medium: "보통", hard: "어려움" }[id] || id;
}
