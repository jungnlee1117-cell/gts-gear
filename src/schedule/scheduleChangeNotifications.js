import { ENTRY_STATUS } from "./payrollCalendar.js";
import { isKoreanHoliday } from "./koreanHolidays.js";
import { isHomeVisitPlanned } from "./constants.js";

export const CHANGE_TYPE_EXTRA_ADDED = "extra_added";

/** 원래 스케줄 표시: '09:50-10:30 정규' / '17:20-18:20 가정방문 (김수호)' */
export function formatOriginalSchedule(planned) {
  const time = `${planned.startTime}-${planned.endTime}`;
  if (isHomeVisitPlanned(planned)) {
    const who = planned.studentName || planned.institutionName;
    return who ? `${time} 가정방문 (${who})` : `${time} 가정방문`;
  }
  return `${time} ${planned.payType}`;
}

/** 실제 처리 표시 */
export function formatActualHandling(planned, { status, minutes, startTime, endTime }) {
  if (status === ENTRY_STATUS.skipped) return "수업 안 함";
  const start = (startTime || planned.startTime || "").slice(0, 5);
  const end = (endTime || "").slice(0, 5);
  if (start && end) {
    return `${start}-${end} ${planned.payType}로 변경`;
  }
  if (minutes && Number(minutes) !== planned.scheduledMinutes) {
    return `${minutes}분으로 변경 (${planned.payType})`;
  }
  return `${planned.payType} 시간 수정`;
}

/** 알림 생성 대상: 주간 슬롯 기반 + 강사가 직접 skipped/custom 입력 */
export function isScheduleDeviant(planned, payload, handlingExtra = {}) {
  if (payload.entry_status === ENTRY_STATUS.skipped) return true;
  if (payload.entry_status !== ENTRY_STATUS.custom) return false;
  const mins = Number(payload.minutes);
  if (mins !== planned.scheduledMinutes) return true;
  const start = (handlingExtra.startTime || "").slice(0, 5);
  const end = (handlingExtra.endTime || "").slice(0, 5);
  const plannedStart = (planned.startTime || "").slice(0, 5);
  const plannedEnd = (planned.endTime || "").slice(0, 5);
  if (start && start !== plannedStart) return true;
  if (end && end !== plannedEnd) return true;
  return false;
}

export function shouldNotifyScheduleChange(planned, payload, handlingExtra = {}) {
  const hasInstitutionSlot = Boolean(payload?.schedule_slot_id);
  const hasHomeVisit = Boolean(payload?.home_visit_pattern_id);
  if (!hasInstitutionSlot && !hasHomeVisit) return false;

  // 공휴일 '수업 안 함'은 시스템 처리 — 알림 제외
  if (payload.entry_status === ENTRY_STATUS.skipped && isKoreanHoliday(planned.dateStr)) {
    return false;
  }

  return isScheduleDeviant(planned, payload, handlingExtra);
}

export function buildScheduleChangeNotificationRow(planned, payload, handlingExtra = {}) {
  const changeReason = handlingExtra.changeReason?.trim() || null;
  return {
    teacher_id: payload.teacher_id,
    institution_id: payload.institution_id || null,
    class_date: payload.class_date,
    schedule_slot_id: payload.schedule_slot_id || null,
    home_visit_pattern_id: payload.home_visit_pattern_id || null,
    pay_type: payload.pay_type || planned.payType || null,
    change_type: payload.entry_status,
    original_schedule: formatOriginalSchedule(planned),
    actual_handling: formatActualHandling(planned, {
      status: payload.entry_status,
      minutes: payload.minutes,
      ...handlingExtra,
    }),
    change_reason: changeReason,
  };
}

/** 알림 행의 수업 유형 (DB pay_type 또는 original_schedule 파싱) */
export function resolveNotificationPayType(item) {
  if (item?.pay_type) return item.pay_type;
  const text = item?.original_schedule || "";
  for (const t of ["가정방문", "센터보조", "방과후", "센터", "정규"]) {
    if (text.endsWith(` ${t}`)) return t;
  }
  return null;
}

/** institution 없으면 개인레슨으로 분류 */
export function isPersonalLessonNotification(item) {
  return !item?.institution_id;
}

export function formatExtraInstitutionLabel(institutionId, institutionName) {
  if (institutionName) return institutionName;
  if (!institutionId) return "개인레슨";
  return "원 미지정";
}

/** 스케줄 외 직접 추가 — 원/유형/시간 표시 */
export function formatExtraAddedHandling({ pay_type, minutes, institutionName, institutionId }) {
  const who = formatExtraInstitutionLabel(institutionId, institutionName);
  const mins = Number(minutes) || 0;
  return `${who} · ${pay_type || "수업"} · ${mins}분`;
}

export function shouldNotifyExtraAdded(payload) {
  if (payload?.schedule_slot_id || payload?.home_visit_pattern_id) return false;
  if (payload?.entry_status !== ENTRY_STATUS.custom) return false;
  return Number(payload.minutes) > 0;
}

export function buildExtraAddedNotificationRow(payload, { institutionName, changeReason } = {}) {
  return {
    teacher_id: payload.teacher_id,
    institution_id: payload.institution_id || null,
    class_date: payload.class_date,
    schedule_slot_id: null,
    home_visit_pattern_id: null,
    pay_type: payload.pay_type || null,
    change_type: CHANGE_TYPE_EXTRA_ADDED,
    original_schedule: "스케줄에 없음",
    actual_handling: formatExtraAddedHandling({
      pay_type: payload.pay_type,
      minutes: payload.minutes,
      institutionName,
      institutionId: payload.institution_id,
    }),
    change_reason: changeReason?.trim() || null,
  };
}
