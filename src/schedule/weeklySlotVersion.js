import { fmtLocalDate, resolveInstitutionSlotPayType } from "./constants.js";

export function weeklySlotSeriesId(slot) {
  return slot?.schedule_series_id || slot?.id || null;
}

export function weeklySlotStatus(slot, today) {
  const from = slot?.effective_from ? String(slot.effective_from).slice(0, 10) : null;
  const to = slot?.effective_to ? String(slot.effective_to).slice(0, 10) : null;
  if (from && from > today) return "upcoming";
  if (to && to < today) return "ended";
  return "current";
}

export function weeklySlotStatusLabel(status) {
  if (status === "upcoming") return "변경 예정";
  if (status === "ended") return "종료";
  return "현재";
}

export function historyRowsForSlot(slots, slot) {
  if (!slot) return [];
  const seriesId = weeklySlotSeriesId(slot);
  return (slots || [])
    .filter((row) => weeklySlotSeriesId(row) === seriesId)
    .sort((a, b) => String(b.effective_from || "").localeCompare(String(a.effective_from || "")));
}

/** 이 선생님의 현재·변경 예정 슬롯. 종료된 행은 이력으로만 본다. */
export function openTeacherSlots(slots, { teacherId, institutionId, today }) {
  return (slots || []).filter((slot) => {
    if (!slot?.teacher_id || slot.teacher_id !== teacherId) return false;
    if (institutionId && slot.institution_id !== institutionId) return false;
    return weeklySlotStatus(slot, today) !== "ended";
  });
}

/**
 * 시간표 수정과 같은 분기.
 * 아직 시작하지 않은 예정 수업이고 적용일이 시작일 이하이면 그 행의 선생님만 고친다.
 * 그 외에는 적용일 전날로 닫고 새 버전을 만든다.
 */
export function slotTeacherChangePlan(slot, effectiveDate, today = fmtLocalDate(new Date())) {
  const date = String(effectiveDate || "").slice(0, 10);
  if (!date) return { ok: false, message: "변경 적용일을 입력해주세요." };
  const from = slot?.effective_from ? String(slot.effective_from).slice(0, 10) : null;
  const to = slot?.effective_to ? String(slot.effective_to).slice(0, 10) : null;
  if (to && date > to) {
    return { ok: false, message: "변경 적용일이 기존 수업 종료일보다 늦습니다." };
  }
  if (from && from >= today && date <= from) {
    return { ok: true, mode: "inplace" };
  }
  if (from && date <= from) {
    return { ok: false, message: `변경 적용일은 기존 시작일(${from}) 이후여야 합니다.` };
  }
  return { ok: true, mode: "version" };
}

export function slotPayType(slot) {
  return resolveInstitutionSlotPayType(slot) || slot?.class_type || "정규";
}

function uniqueTypes(list) {
  const seen = new Set();
  const out = [];
  for (const type of list || []) {
    if (!type || seen.has(type)) continue;
    seen.add(type);
    out.push(type);
  }
  return out;
}

/**
 * 슬롯을 넘긴 뒤 명단 수업유형.
 * 남은 현재·예정 슬롯이 없으면 원래 선생님 명단을 내린다.
 */
export function payTypesAfterSlotTransfer({
  fromPayTypes = [],
  toPayTypes = [],
  transferredTypes = [],
  remainingTypes = [],
  fromHasOpenSlots = false,
}) {
  const transferred = new Set(transferredTypes);
  const remaining = new Set(remainingTypes);
  const fromNext = fromHasOpenSlots
    ? uniqueTypes([
      ...fromPayTypes.filter((type) => !transferred.has(type) || remaining.has(type)),
      ...remaining,
    ])
    : [];
  return {
    deactivateFrom: !fromHasOpenSlots,
    fromPayTypes: fromNext,
    toPayTypes: uniqueTypes([...toPayTypes, ...transferredTypes]),
  };
}
