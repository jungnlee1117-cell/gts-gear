import {
  fmtLocalDate,
  getMonthGrid,
  isSameDay,
  minutesBetween,
  resolveInstitutionSlotPayType,
  sortSlotsByTime,
  resolveInstitutionSlotBillableMinutes,
} from "./constants.js";
import { expandPatternsForRange } from "./homeVisitPatterns.js";
import { isKoreanHoliday } from "./koreanHolidays.js";

export { getMonthGrid, fmtLocalDate, isSameDay };

export const ENTRY_STATUS = {
  as_scheduled: "as_scheduled",
  custom: "custom",
  skipped: "skipped",
};

export const ENTRY_STATUS_LABEL = {
  as_scheduled: "평소대로",
  custom: "시간 수정",
  skipped: "수업 안 함",
};

/** 특정 날짜에만 노출되는 1회성 슬롯 — label: __oneoff:YYYY-MM-DD */
export const ONEOFF_LABEL_PREFIX = "__oneoff:";

function isOneoffSlotActive(slot, dateStr) {
  if (!slot.label?.startsWith(ONEOFF_LABEL_PREFIX)) return true;
  return dateStr === slot.label.slice(ONEOFF_LABEL_PREFIX.length);
}

function isAfterSchoolDisplaySlot(slot) {
  return slot.class_type === "방과후" || slot.label === "고정50000";
}

/** 상세 패널·급여 목록용 슬롯 표시명 (1교시, 2교시… / 방과후) */
export function plannedSlotDisplayLabel(planned) {
  if (planned.displayLabel) return planned.displayLabel;
  if (planned.source === "home_visit" || planned.patternId) {
    return `가정방문 · ${planned.studentName}`;
  }
  return planned.institutionName || "원";
}

/** 해당 날짜에 주간 스케줄에서 펼쳐진 슬롯 목록 */
export function getSlotsForDate(weeklySlots, date, exceptions = []) {
  const dateStr = fmtLocalDate(date);
  const dow = date.getDay();
  let slots = weeklySlots.filter(s => s.day_of_week === dow && isOneoffSlotActive(s, dateStr));
  const exList = exceptions ?? [];
  if (exList.length) {
    slots = slots.filter(s => {
      const cancelled = exList.some(ex =>
        ex.institution_id === s.institution_id
        && ex.exception_type === "cancelled"
        && ex.exception_date <= dateStr
        && dateStr <= (ex.end_date || ex.exception_date),
      );
      return !cancelled;
    });
  }
  slots = sortSlotsByTime(slots);

  const regularPeriodByInst = new Map();
  return slots.map(slot => {
    const institutionName = slot.institutions?.name ?? "";
    let displayLabel;
    if (isAfterSchoolDisplaySlot(slot)) {
      displayLabel = "방과후";
    } else {
      const n = (regularPeriodByInst.get(slot.institution_id) ?? 0) + 1;
      regularPeriodByInst.set(slot.institution_id, n);
      displayLabel = `${n}교시`;
    }
    return {
      source: "institution",
      slot,
      patternId: null,
      dateStr,
      institutionId: slot.institution_id,
      institutionName,
      displayLabel,
      studentName: null,
      payType: resolveInstitutionSlotPayType(slot),
      startTime: slot.start_time?.slice(0, 5) ?? "",
      endTime: slot.end_time?.slice(0, 5) ?? "",
      scheduledMinutes: resolveInstitutionSlotBillableMinutes(slot),
      location: null,
    };
  });
}

function formatPatternTime(t) {
  return t?.slice(0, 5) ?? "";
}

/** home_visit_patterns 전개 occurrence → 급여/캘린더 planned */
export function homeVisitOccurrenceToPlanned(occ) {
  const pattern = occ.pattern ?? occ;
  const patternId = occ.pattern_id ?? pattern.id;
  const startTime = formatPatternTime(occ.start_time ?? pattern.start_time);
  const endTime = formatPatternTime(occ.end_time ?? pattern.end_time);
  const studentName = occ.student_name ?? pattern.student_name ?? "가정방문";
  return {
    source: "home_visit",
    slot: { id: patternId, ...pattern },
    patternId,
    dateStr: occ.visit_date,
    institutionId: null,
    institutionName: studentName,
    studentName,
    payType: "가정방문",
    startTime,
    endTime,
    scheduledMinutes: minutesBetween(startTime, endTime),
    location: occ.location ?? pattern.location ?? null,
  };
}

export function getHomeVisitsForDate(homeVisitPatterns, date) {
  const dateStr = fmtLocalDate(date);
  const occurrences = expandPatternsForRange(homeVisitPatterns, dateStr, dateStr);
  return occurrences.map(homeVisitOccurrenceToPlanned);
}

function sortPlannedByTime(planned) {
  return [...planned].sort((a, b) => {
    const t = a.startTime.localeCompare(b.startTime);
    if (t !== 0) return t;
    if (a.source !== b.source) return a.source === "institution" ? -1 : 1;
    return (a.institutionName || "").localeCompare(b.institutionName || "");
  });
}

export function getEffectiveSlotStatus(entry, dateStr) {
  if (entry?.entry_status) return entry.entry_status;
  if (isKoreanHoliday(dateStr)) return ENTRY_STATUS.skipped;
  return null;
}

export function isSlotResolved(entries, planned) {
  return Boolean(getEffectiveSlotStatus(findEntryForPlanned(entries, planned), planned.dateStr));
}

export function effectiveSlotStatusLabel(planned, entry) {
  const status = getEffectiveSlotStatus(entry, planned.dateStr);
  if (!status) return "미확인";
  if (status === ENTRY_STATUS.as_scheduled) {
    return `평소대로 · ${planned.scheduledMinutes}분`;
  }
  if (status === ENTRY_STATUS.custom) {
    return `시간 수정 · ${entry.minutes}분`;
  }
  if (status === ENTRY_STATUS.skipped) {
    if (!entry?.entry_status && isKoreanHoliday(planned.dateStr)) {
      return "공휴일 · 수업 없음";
    }
    return entry?.note ? `수업 안 함 · ${entry.note}` : "수업 안 함";
  }
  return ENTRY_STATUS_LABEL[status] ?? "";
}

export function findEntryForPlanned(entries, planned) {
  const { slot, dateStr } = planned;
  if (planned.source === "home_visit" || planned.patternId) {
    return entries.find(e =>
      e.home_visit_pattern_id === planned.patternId && e.class_date === dateStr,
    ) ?? entries.find(e =>
      !e.schedule_slot_id
      && !e.home_visit_pattern_id
      && e.class_date === dateStr
      && e.pay_type === "가정방문"
      && planned.studentName
      && e.note?.includes(planned.studentName),
    ) ?? null;
  }
  return entries.find(e =>
    e.schedule_slot_id === slot.id && e.class_date === dateStr,
  ) ?? entries.find(e =>
    !e.schedule_slot_id
    && !e.home_visit_pattern_id
    && e.class_date === dateStr
    && e.institution_id === slot.institution_id
    && e.pay_type === resolveInstitutionSlotPayType(slot),
  ) ?? null;
}

export function buildEntriesBySlotKey(entries) {
  const map = new Map();
  for (const e of entries) {
    if (e.schedule_slot_id) {
      map.set(`${e.class_date}|${e.schedule_slot_id}`, e);
    }
  }
  return map;
}

/** 월간 모든 예정 수업 (날짜별) — institution_weekly_schedule + home_visit_patterns */
export function expandMonthSchedule(
  weeklySlots,
  year,
  month,
  exceptions = [],
  homeVisitPatterns = [],
) {
  const grid = getMonthGrid(year, month);
  const byDate = {};
  for (const { date, inMonth } of grid) {
    if (!inMonth) continue;
    const dateStr = fmtLocalDate(date);
    const institution = getSlotsForDate(weeklySlots, date, exceptions);
    const homeVisits = getHomeVisitsForDate(homeVisitPatterns, date);
    byDate[dateStr] = sortPlannedByTime([...institution, ...homeVisits]);
  }
  return byDate;
}

/** 매월 이 날짜(포함)부터 해당 월 말일까지 미리 확정 가능 */
export const PAYROLL_EARLY_CONFIRM_DAY = 20;

/** 급여 확정 가능 여부 — 20일 이전은 오늘까지만, 20일 이후엔 이번 달 말일까지 */
export function isDateConfirmable(dateStr, today = new Date()) {
  const todayStr = fmtLocalDate(today);
  if (dateStr <= todayStr) return true;
  if (today.getDate() < PAYROLL_EARLY_CONFIRM_DAY) return false;
  const [y, m] = dateStr.split("-").map(Number);
  return y === today.getFullYear() && m === today.getMonth() + 1;
}

/** 오늘까지 예정된 슬롯 중 entry 없는 날짜 수 */
export function countUnconfirmedDays(scheduleByDate, entries, today = new Date()) {
  let days = 0;
  for (const [dateStr, planned] of Object.entries(scheduleByDate)) {
    if (!isDateConfirmable(dateStr, today) || planned.length === 0) continue;
    const allResolved = planned.every(p => isSlotResolved(entries, p));
    if (!allResolved) days++;
  }
  return days;
}

export function countSkippedEntries(entries) {
  return entries.filter(e => e.entry_status === ENTRY_STATUS.skipped).length;
}

/** 확정된 수업만 급여·합계에 포함 (minutes > 0) */
export function confirmedEntries(entries) {
  return entries.filter(e => e.entry_status && e.minutes > 0);
}

export function groupPayrollByTypeConfirmed(entries) {
  const groups = {};
  for (const t of ["정규", "방과후", "가정방문", "센터", "센터보조"]) groups[t] = 0;
  for (const e of confirmedEntries(entries)) {
    groups[e.pay_type] = (groups[e.pay_type] || 0) + e.minutes;
  }
  return groups;
}

export function uniqueInstitutionIdsForDate(planned) {
  const seen = new Set();
  const ids = [];
  for (const p of planned) {
    const id = p.institutionId;
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/** 캘린더 날짜 칸 점 — 원 + 가정방문(학생별) */
export function uniqueCalendarMarkersForDate(planned) {
  const markers = uniqueInstitutionIdsForDate(planned).map(id => ({
    type: "institution",
    id,
    label: null,
    key: `inst-${id}`,
  }));
  const seen = new Set();
  for (const p of planned) {
    if (p.source !== "home_visit" || !p.patternId || seen.has(p.patternId)) continue;
    seen.add(p.patternId);
    markers.push({
      type: "home_visit",
      id: p.patternId,
      label: p.studentName,
      key: `hv-${p.patternId}`,
    });
  }
  return markers;
}

export function dayConfirmState(planned, entries) {
  if (!planned.length) return "empty";
  let resolved = 0;
  let skipped = 0;
  for (const p of planned) {
    const status = getEffectiveSlotStatus(findEntryForPlanned(entries, p), p.dateStr);
    if (!status) continue;
    resolved++;
    if (status === ENTRY_STATUS.skipped) skipped++;
  }
  if (resolved === 0) return "pending";
  if (resolved < planned.length) return "partial";
  if (skipped === planned.length) return "all_skipped";
  if (skipped > 0) return "mixed";
  return "done";
}

export function isSlotUnconfirmed(entries, planned) {
  return !isSlotResolved(entries, planned);
}

/** 일괄 확정 시 건드리지 않을 슬롯 (개별 수정·수업 안 함·공휴일 기본값) */
export function isSlotBulkProtected(entries, planned) {
  const entry = findEntryForPlanned(entries, planned);
  if (entry?.entry_status === ENTRY_STATUS.custom) return true;
  if (entry?.entry_status === ENTRY_STATUS.skipped) return true;
  if (isKoreanHoliday(planned.dateStr) && !entry?.entry_status) return true;
  return false;
}

/** 스케줄 슬롯 없이 강사가 직접 추가한 payroll entry */
export function isManualExtraEntry(entry) {
  if (!entry?.entry_status) return false;
  if (entry.schedule_slot_id || entry.home_visit_pattern_id) return false;
  return entry.minutes > 0 || entry.entry_status === ENTRY_STATUS.custom;
}

export function findManualExtraEntriesForDate(entries, dateStr, plannedList = []) {
  return entries.filter(e => {
    if (e.class_date !== dateStr || !isManualExtraEntry(e)) return false;
    if (!plannedList.length) return true;
    return !plannedList.some(p => findEntryForPlanned(entries, p)?.id === e.id);
  });
}

export function getWeekDateStrings(anchorDate) {
  const d = new Date(anchorDate);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return fmtLocalDate(x);
  });
}

/** 기간 내 미확인 슬롯 수집 (확정 가능 날짜만, 선택적 날짜 필터) */
export function collectUnconfirmedPlanned(scheduleByDate, entries, {
  today = new Date(),
  dateFilter = null,
} = {}) {
  const list = [];
  for (const [dateStr, planned] of Object.entries(scheduleByDate)) {
    if (!isDateConfirmable(dateStr, today)) continue;
    if (dateFilter && !dateFilter(dateStr)) continue;
    for (const p of planned) {
      if (isSlotUnconfirmed(entries, p)) list.push(p);
    }
  }
  return list;
}
