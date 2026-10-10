import { isHomeVisitPlanned, minutesBetween } from "./constants.js";
import {
  CHANGE_REASON_CUSTOM,
  CHANGE_REASON_PRESETS,
  composeSkippedEntryNote,
  composeTimeChangeNote,
  isMakeupReason,
  isPersonalReason,
  isSubstituteReason,
  isTimeChangeReason,
  parseSkippedEntryNote,
  parseTimeChangeNote,
  REASON_MAKEUP,
  REASON_SUBSTITUTE,
  REASON_TIME_CHANGE,
  resolveChangeReason,
  validateChangeReason,
} from "./changeReasonOptions.js";
import { shouldNotifyScheduleChange } from "./scheduleChangeNotifications.js";
import { upsertPayrollSlotWithNotification } from "./payrollSaveWithNotification.js";
import { confirmLongClassMinutes } from "./longClassConfirm.js";
import { ENTRY_STATUS } from "./payrollCalendar.js";

function formatMakeupTime(value) {
  if (!value) return null;
  return String(value).length === 5 ? `${value}:00` : value;
}

/** PayrollTeacherView · 체크인 화면이 같이 쓰는 payroll_entries 저장 payload */
export function buildPayrollSlotPayload(planned, options, { existingEntry, teacherId }) {
  const {
    status,
    minutes,
    note,
    substitute_teacher_id = null,
    is_makeup = false,
    makeup_date = null,
    makeup_start_time = null,
    makeup_end_time = null,
  } = options;
  return {
    id: existingEntry?.id,
    teacher_id: teacherId,
    institution_id: planned.institutionId || null,
    class_date: planned.dateStr,
    pay_type: planned.payType,
    minutes: status === ENTRY_STATUS.skipped ? 0 : Number(minutes),
    entry_status: status,
    schedule_slot_id: isHomeVisitPlanned(planned) ? null : planned.slot.id,
    home_visit_pattern_id: planned.patternId || null,
    note: note?.trim() || null,
    substitute_teacher_id: substitute_teacher_id || null,
    is_makeup: Boolean(is_makeup),
    makeup_date: is_makeup && makeup_date ? String(makeup_date).slice(0, 10) : null,
    makeup_start_time: is_makeup ? formatMakeupTime(makeup_start_time) : null,
    makeup_end_time: is_makeup ? formatMakeupTime(makeup_end_time) : null,
  };
}

export function buildCustomEditState(planned, existing) {
  let changeReasonPreset = "";
  let changeReasonCustom = "";
  let note = existing?.note || "";
  let startTime = planned.startTime;
  let endTime = planned.endTime;
  const timeChange = parseTimeChangeNote(existing?.note);
  if (existing?.substitute_teacher_id) changeReasonPreset = REASON_SUBSTITUTE;
  else if (existing?.is_makeup) changeReasonPreset = REASON_MAKEUP;
  else if (timeChange) {
    changeReasonPreset = REASON_TIME_CHANGE;
    note = timeChange.memo;
    if (timeChange.start) startTime = timeChange.start;
    if (timeChange.end) endTime = timeChange.end;
  } else if (existing?.entry_status === ENTRY_STATUS.skipped) {
    const parsed = parseSkippedEntryNote(existing.note);
    if (CHANGE_REASON_PRESETS.includes(parsed.reason)) {
      changeReasonPreset = parsed.reason;
      note = parsed.memo;
    } else if (parsed.reason) {
      changeReasonPreset = CHANGE_REASON_CUSTOM;
      changeReasonCustom = parsed.reason;
      note = parsed.memo;
    }
  }
  return {
    planned,
    minutes: existing?.entry_status === ENTRY_STATUS.custom
      || existing?.substitute_teacher_id
      || existing?.is_makeup
      ? (existing.minutes || planned.scheduledMinutes)
      : planned.scheduledMinutes,
    startTime,
    endTime,
    note,
    changeReasonPreset,
    changeReasonCustom,
    substituteTeacherId: existing?.substitute_teacher_id || "",
    personalMakeup: existing?.is_makeup ? "yes" : "",
    makeupDate: existing?.makeup_date ? String(existing.makeup_date).slice(0, 10) : "",
    makeupStartTime: existing?.makeup_start_time
      ? String(existing.makeup_start_time).slice(0, 5)
      : planned.startTime,
    makeupEndTime: existing?.makeup_end_time
      ? String(existing.makeup_end_time).slice(0, 5)
      : planned.endTime,
  };
}

export function customEditNeedsChangeReason(customEdit, existingEntry, teacherId) {
  if (!customEdit) return false;
  if (isSubstituteReason(customEdit.changeReasonPreset)
    || isMakeupReason(customEdit.changeReasonPreset)
    || isPersonalReason(customEdit.changeReasonPreset)
    || isTimeChangeReason(customEdit.changeReasonPreset)) {
    return true;
  }
  const savePayload = buildPayrollSlotPayload(customEdit.planned, {
    status: ENTRY_STATUS.custom,
    minutes: Number(customEdit.minutes) || 0,
    note: customEdit.note,
  }, { existingEntry, teacherId });
  const timeExtra = {
    startTime: customEdit.startTime,
    endTime: customEdit.endTime,
  };
  const skipPayload = buildPayrollSlotPayload(customEdit.planned, {
    status: ENTRY_STATUS.skipped,
    minutes: 0,
    note: customEdit.note,
  }, { existingEntry, teacherId });
  return shouldNotifyScheduleChange(customEdit.planned, savePayload, timeExtra)
    || shouldNotifyScheduleChange(customEdit.planned, skipPayload);
}

export function customEditSaveMinutes(customEdit) {
  const isMk = isMakeupReason(customEdit?.changeReasonPreset)
    || isPersonalMakeupYes(customEdit);
  let mins = Number(customEdit?.minutes);
  if (isMk) {
    const makeupStart = customEdit.makeupStartTime || customEdit.planned?.startTime;
    const makeupEnd = customEdit.makeupEndTime || customEdit.planned?.endTime;
    mins = minutesBetween(makeupStart, makeupEnd) || mins;
  } else if (isTimeChangeReason(customEdit?.changeReasonPreset)) {
    mins = minutesBetween(customEdit.startTime, customEdit.endTime) || mins;
  }
  return mins;
}

export async function confirmPayrollSlotAsScheduled(planned, {
  existingEntry,
  teacherId,
  skipLongConfirm = false,
}) {
  if (!skipLongConfirm && !confirmLongClassMinutes(planned.scheduledMinutes)) return null;
  const payload = buildPayrollSlotPayload(planned, {
    status: ENTRY_STATUS.as_scheduled,
    minutes: planned.scheduledMinutes,
  }, { existingEntry, teacherId });
  return upsertPayrollSlotWithNotification(planned, payload);
}

export function isPersonalMakeupYes(customEdit) {
  return isPersonalReason(customEdit?.changeReasonPreset)
    && customEdit?.personalMakeup === "yes";
}

export async function saveCustomPayrollSlot(customEdit, { existingEntry, teacherId }) {
  const planned = customEdit.planned;
  const isSub = isSubstituteReason(customEdit.changeReasonPreset);
  const isMk = isMakeupReason(customEdit.changeReasonPreset)
    || isPersonalMakeupYes(customEdit);
  const isTime = isTimeChangeReason(customEdit.changeReasonPreset);

  if (isSub) {
    if (!customEdit.substituteTeacherId) throw new Error("대체선생님을 선택해주세요.");
    if (customEdit.substituteTeacherId === teacherId) {
      throw new Error("본인은 대체선생님으로 선택할 수 없습니다.");
    }
  }
  if (isMk) {
    if (!customEdit.makeupDate) throw new Error("보강 날짜를 입력해주세요.");
    const makeupStart = customEdit.makeupStartTime || planned.startTime;
    const makeupEnd = customEdit.makeupEndTime || planned.endTime;
    if (!makeupStart || !makeupEnd) {
      throw new Error("보강 시작·종료 시간을 입력해주세요.");
    }
    if (makeupStart >= makeupEnd) {
      throw new Error("보강 종료 시간은 시작 시간보다 늦어야 합니다.");
    }
    customEdit = { ...customEdit, makeupStartTime: makeupStart, makeupEndTime: makeupEnd };
  }
  if (isTime) {
    if (!customEdit.startTime || !customEdit.endTime) {
      throw new Error("변경된 시간을 입력해주세요.");
    }
    if (customEdit.startTime >= customEdit.endTime) {
      throw new Error("변경된 종료 시간은 시작 시간보다 늦어야 합니다.");
    }
  }

  const mins = customEditSaveMinutes(customEdit);
  if (!mins || mins <= 0) throw new Error("1분 이상 입력해주세요.");
  if (!confirmLongClassMinutes(mins)) return null;

  const payload = buildPayrollSlotPayload(planned, {
    status: ENTRY_STATUS.custom,
    minutes: mins,
    note: isTime
      ? composeTimeChangeNote(customEdit.startTime, customEdit.endTime, customEdit.note)
      : customEdit.note,
    substitute_teacher_id: isSub ? customEdit.substituteTeacherId : null,
    is_makeup: isMk,
    makeup_date: isMk ? customEdit.makeupDate : null,
    makeup_start_time: isMk ? customEdit.makeupStartTime : null,
    makeup_end_time: isMk ? customEdit.makeupEndTime : null,
  }, { existingEntry, teacherId });

  const handlingExtra = {
    startTime: isMk ? customEdit.makeupStartTime : customEdit.startTime,
    endTime: isMk ? customEdit.makeupEndTime : customEdit.endTime,
  };
  const needsReason = customEditNeedsChangeReason(customEdit, existingEntry, teacherId)
    || shouldNotifyScheduleChange(planned, payload, handlingExtra);
  if (needsReason) {
    const reasonErr = validateChangeReason(
      customEdit.changeReasonPreset,
      customEdit.changeReasonCustom,
    );
    if (reasonErr) throw new Error(reasonErr);
    handlingExtra.changeReason = resolveChangeReason(
      customEdit.changeReasonPreset,
      customEdit.changeReasonCustom,
    );
  }

  return upsertPayrollSlotWithNotification(planned, payload, handlingExtra);
}

export async function skipPayrollSlot(customEdit, { existingEntry, teacherId }) {
  if (isPersonalReason(customEdit?.changeReasonPreset)) {
    if (!customEdit.personalMakeup) {
      throw new Error("보강수업 진행 여부를 선택해주세요.");
    }
    if (customEdit.personalMakeup === "yes") {
      return saveCustomPayrollSlot(customEdit, { existingEntry, teacherId });
    }
  }
  const reasonErr = validateChangeReason(
    customEdit.changeReasonPreset,
    customEdit.changeReasonCustom,
  );
  if (reasonErr) throw new Error(reasonErr);
  const changeReason = resolveChangeReason(
    customEdit.changeReasonPreset,
    customEdit.changeReasonCustom,
  );
  const planned = customEdit.planned;
  const payload = buildPayrollSlotPayload(planned, {
    status: ENTRY_STATUS.skipped,
    minutes: 0,
    note: composeSkippedEntryNote(changeReason, customEdit.note),
  }, { existingEntry, teacherId });
  return upsertPayrollSlotWithNotification(planned, payload, { changeReason });
}
