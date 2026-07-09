/** 수업 난이도 → 교구 대본 레벨 매핑 */
export const LESSON_DIFFICULTIES = [
  { id: "easy", label: "쉬움", desc: "짧은 영어 · 단어 중심 · 쉬운 질문" },
  { id: "medium", label: "보통", desc: "기본 문장 · 짧은 질문" },
  { id: "hard", label: "어려움", desc: "긴 영어 문장 · 열린 질문" },
];

export function difficultyToLevelId(difficultyId) {
  if (difficultyId === "hard") return "interactive";
  return "foundation";
}

export function getDifficultyText(variants, difficultyId, fallback = "") {
  if (!variants) return fallback;
  return variants[difficultyId] || variants.medium || variants.easy || fallback;
}
