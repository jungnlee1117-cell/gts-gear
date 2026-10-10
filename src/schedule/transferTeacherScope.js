import { resolveInstitutionSlotPayType } from "./constants.js";

export const TRANSFER_CLASS_TYPES = ["정규", "방과후", "어린이집", "가정방문", "센터", "센터보조", "참관수업"];

export function slotStillActiveOnOrAfter(slot, transferDate) {
  const to = slot.effective_to ? String(slot.effective_to).slice(0, 10) : null;
  if (to && to < transferDate) return false;
  return true;
}

export function resolveTransferClassType(slot) {
  return resolveInstitutionSlotPayType(slot) || slot?.class_type || "정규";
}

/** 한 선생님 행이 이 기관에서 맡고 있는 수업 유형. */
export function classTypesHeldByTeacher(assignment, weeklySlots, onDate) {
  const types = new Set();
  for (const type of assignment?.pay_types || []) {
    if (TRANSFER_CLASS_TYPES.includes(type)) types.add(type);
  }
  for (const slot of weeklySlots || []) {
    if (slot.teacher_id !== assignment?.teacher_id) continue;
    if (!slotStillActiveOnOrAfter(slot, onDate)) continue;
    types.add(resolveTransferClassType(slot));
  }
  return TRANSFER_CLASS_TYPES.filter((type) => types.has(type));
}

export function matchingSlotsForTransfer(slots, {
  classType,
  fromTeacherId = null,
  toTeacherId,
  transferDate,
}) {
  return (slots || []).filter((slot) => {
    if (resolveTransferClassType(slot) !== classType) return false;
    if (!slotStillActiveOnOrAfter(slot, transferDate)) return false;
    if (!slot.teacher_id || slot.teacher_id === toTeacherId) return false;
    if (fromTeacherId && slot.teacher_id !== fromTeacherId) return false;
    return true;
  });
}
