import { timesOverlap } from "./constants.js";

function ymd(value) {
  return value ? String(value).slice(0, 10) : "";
}

function hhmm(value) {
  return value ? String(value).slice(0, 5) : "";
}

/** 적용 기간이 겹치면 true. 시작/종료 빈 값은 무한으로 본다. */
export function dateRangesOverlap(fromA, toA, fromB, toB) {
  const a0 = ymd(fromA) || "0000-01-01";
  const a1 = ymd(toA) || "9999-12-31";
  const b0 = ymd(fromB) || "0000-01-01";
  const b1 = ymd(toB) || "9999-12-31";
  return a0 <= b1 && b0 <= a1;
}

export function findOverlappingInstitutionSlots({
  slots = [],
  institutionId,
  dayOfWeek,
  startTime,
  endTime,
  effectiveFrom,
  effectiveTo,
  excludeSlotIds = [],
} = {}) {
  if (!institutionId || !startTime || !endTime) return [];
  const exclude = new Set((excludeSlotIds || []).filter(Boolean));
  const day = Number(dayOfWeek);
  return (slots || []).filter((slot) => {
    if (!slot?.id || exclude.has(slot.id)) return false;
    if (slot.institution_id !== institutionId) return false;
    if (Number(slot.day_of_week) !== day) return false;
    if (!timesOverlap(startTime, endTime, hhmm(slot.start_time), hhmm(slot.end_time))) return false;
    return dateRangesOverlap(
      effectiveFrom,
      effectiveTo,
      slot.effective_from,
      slot.effective_to,
    );
  });
}

export function formatInstitutionOverlapWarning(slot, teacherNameById = new Map()) {
  const teacher = teacherNameById.get(slot?.teacher_id) || "다른 선생님";
  return `이미 이 시간에 등록된 수업이 있어요 (${teacher} 선생님 ${hhmm(slot?.start_time)}~${hhmm(slot?.end_time)})`;
}
