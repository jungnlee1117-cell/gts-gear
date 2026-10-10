export const CHANGE_REASON_CUSTOM = "__custom__";

/** 대체 수업 — 선생님 선택 후 수업료 이전 */
export const REASON_SUBSTITUTE = "대체수업";

/** 보강 수업 — 보강 날짜/시간 입력 */
export const REASON_MAKEUP = "보강수업";

/** 개인 사정 — 수업 안 함 시 보강 여부 선택 */
export const REASON_PERSONAL = "선생님 개인 사정";

/** 같은 날 수업 시각만 바꿈 */
export const REASON_TIME_CHANGE = "시간변경";

export const CHANGE_REASON_PRESETS = [
  REASON_PERSONAL,
  "기관 휴원",
  "공휴일",
  REASON_SUBSTITUTE,
  REASON_TIME_CHANGE,
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

export function isPersonalReason(presetOrReason) {
  const r = String(presetOrReason || "").trim();
  return r === REASON_PERSONAL || r === "선생님 개인사정";
}

export function isTimeChangeReason(presetOrReason) {
  const r = String(presetOrReason || "").trim();
  return r === REASON_TIME_CHANGE || r === "시간 변경";
}

export function composeTimeChangeNote(start, end, memo) {
  const range = `${String(start || "").slice(0, 5)}-${String(end || "").slice(0, 5)}`;
  const head = range.length > 1 ? `${REASON_TIME_CHANGE}${SKIP_NOTE_SEP}${range}` : REASON_TIME_CHANGE;
  const extra = String(memo || "").trim();
  if (!extra || extra === head || extra.startsWith(`${head}${SKIP_NOTE_SEP}`)) return head;
  return `${head}${SKIP_NOTE_SEP}${extra}`;
}

export function parseTimeChangeNote(note) {
  const parsed = parseSkippedEntryNote(note);
  if (!isTimeChangeReason(parsed.reason)) return null;
  const match = String(parsed.memo || "").match(/^(\d{2}:\d{2})-(\d{2}:\d{2})(?: · (.*))?$/);
  if (!match) return { start: "", end: "", memo: parsed.memo || "" };
  return { start: match[1], end: match[2], memo: match[3] || "" };
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

const SKIP_NOTE_SEP = " · ";

/** 수업 안 함 저장 시 payroll_entries.note 에 사유(+선택 메모)를 남긴다 */
export function composeSkippedEntryNote(reason, memo) {
  const r = String(reason || "").trim();
  const m = String(memo || "").trim();
  if (r && m && m !== r && !m.startsWith(`${r}${SKIP_NOTE_SEP}`)) {
    return `${r}${SKIP_NOTE_SEP}${m}`;
  }
  return r || m || null;
}

export function parseSkippedEntryNote(note) {
  const text = String(note || "").trim();
  if (!text) return { reason: "", memo: "" };
  for (const preset of CHANGE_REASON_PRESETS) {
    if (text === preset) return { reason: preset, memo: "" };
    const prefix = `${preset}${SKIP_NOTE_SEP}`;
    if (text.startsWith(prefix)) {
      return { reason: preset, memo: text.slice(prefix.length) };
    }
  }
  const idx = text.indexOf(SKIP_NOTE_SEP);
  if (idx > 0) {
    return { reason: text.slice(0, idx), memo: text.slice(idx + SKIP_NOTE_SEP.length) };
  }
  return { reason: text, memo: "" };
}

export function skippedReasonFromNote(note) {
  return parseSkippedEntryNote(note).reason;
}
