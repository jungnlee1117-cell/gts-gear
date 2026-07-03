export const CHANGE_REASON_PRESETS = [
  "선생님 개인 사정",
  "기관 휴원",
  "공휴일",
  "대체 수업",
];

export const CHANGE_REASON_CUSTOM = "__custom__";

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
