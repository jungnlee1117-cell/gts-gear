export const KOREAN_GOAL_IDS = ["3_4", "5", "7"];
export const ENGLISH_GOAL_AGES = ["4", "5", "6", "7"];

export function emptyEnglishGoals() {
  return Object.fromEntries(ENGLISH_GOAL_AGES.map((age) => [age, ""]));
}

export function emptyKoreanGoals() {
  return Object.fromEntries(KOREAN_GOAL_IDS.map((id) => [id, ""]));
}

export function parseStoredPlanGoals(value) {
  const text = String(value || "").trim();
  const empty = {
    english: emptyEnglishGoals(),
    korean: emptyKoreanGoals(),
    legacySharedEnglish: false,
  };
  if (!text) return empty;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const ko = parsed.ko && typeof parsed.ko === "object" ? parsed.ko : {};
      return {
        english: Object.fromEntries(ENGLISH_GOAL_AGES.map((age) => [age, String(parsed[age] || "")])),
        korean: Object.fromEntries(KOREAN_GOAL_IDS.map((id) => [id, String(ko[id] || "")])),
        legacySharedEnglish: false,
      };
    }
  } catch {
    // 연령 구분 전 영어 목표는 한 문장으로 저장되어 있습니다.
  }
  return {
    english: Object.fromEntries(ENGLISH_GOAL_AGES.map((age) => [age, text])),
    korean: emptyKoreanGoals(),
    legacySharedEnglish: true,
  };
}

export function serializePlanGoals(englishGoals, koreanGoals) {
  return JSON.stringify({
    ...emptyEnglishGoals(),
    ...(englishGoals || {}),
    ko: {
      ...emptyKoreanGoals(),
      ...(koreanGoals || {}),
    },
  });
}

export function resolveMonthlyGoal(saved, generated) {
  return String(saved || "").trim() ? saved : (generated || "");
}

export function normalizeGoalText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function isCustomMonthlyGoal(saved, generated) {
  return normalizeGoalText(resolveMonthlyGoal(saved, generated)) !== normalizeGoalText(generated);
}

export function mergeGoalsAfterGearFill(entries, replaceEdited) {
  const goals = {};
  let customCount = 0;
  for (const entry of entries || []) {
    const custom = isCustomMonthlyGoal(entry.saved, entry.currentDefault);
    if (custom) customCount += 1;
    goals[entry.key] = (!custom || replaceEdited)
      ? entry.nextDefault
      : resolveMonthlyGoal(entry.saved, entry.currentDefault);
  }
  return { customCount, goals };
}
