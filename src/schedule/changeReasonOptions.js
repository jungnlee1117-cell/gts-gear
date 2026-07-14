export const CHANGE_REASON_CUSTOM = "__custom__";

/** 대체 수업 — 선생님 선택 후 수업료 이전 */
export const REASON_SUBSTITUTE = "대체수업";

/** 보강 수업 — 보강 날짜/시간 입력 */
export const REASON_MAKEUP = "보강수업";

export const CHANGE_REASON_PRESETS = [
  "선생님 개인 사정",
  "기관 휴원",
  "공휴일",
  REASON_SUBSTITUTE,
  REASON_MAKEUP,
];

export function isSubstituteReason(presetOrReason) {
  const r = String(presetOrReason || "").trim();
  return r === REASON_SUBSTITUTE || r === "대체 수업";
}

export function isMakeupReason(presetOrReason) {
  const r = String(presetOrReason || "").trim();
  return r === REASON_MAKEUP || r === "보강 수업";
}

export function resolveChangeReason(preset, customText) {
  if (preset === CHANGE_REASON_CUSTOM) return String(customText || "").trim();
  if (preset && preset !== CHANGE_REASON_CUSTOM) return preset;
  return String(customText || "").trim();
}

export function validateChangeReason(preset, customText) {
  const reason = resolveChangeReason(preset, customText);
  if (!reason) return "변동 사유를 선택하거나 입력해주세요.";
  return null;
}

export function summarizeChangeReasons(items) {
  const reasons = [...new Set((items || []).map(i => i.change_reason).filter(Boolean))];
  if (!reasons.length) return null;
  if (reasons.length === 1) return reasons[0];
  return `${reasons.length}가지 사유`;
}
