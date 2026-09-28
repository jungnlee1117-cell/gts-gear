import { fmtLocalDate, yearMonthFirstDay, yearMonthLastDay } from "./constants.js";
import { findEntryForPlanned, isSlotUnconfirmed } from "./payrollCalendar.js";

function dateOnly(value) {
  return String(value || "").slice(0, 10);
}

export function plannedTeacherId(planned) {
  return planned?.oneoffLesson?.teacher_id
    || planned?.slot?.teacher_id
    || null;
}

export function isTeacherOnVacation(vacations, teacherId, dateStr) {
  if (!teacherId || !dateStr) return false;
  return (vacations || []).some((row) => (
    row.teacher_id === teacherId
    && dateOnly(row.start_date) <= dateStr
    && dateOnly(row.end_date) >= dateStr
  ));
}

function isPlannedChecked(entries, planned) {
  if (planned?.isOneoffLesson) {
    const linkedId = planned.oneoffLesson?.payroll_entry_id;
    if (linkedId && (entries || []).some((entry) => entry.id === linkedId && entry.entry_status)) {
      return true;
    }
  }
  return !isSlotUnconfirmed(entries, planned);
}

function teacherHasRealCheck(entries, plannedList) {
  return (plannedList || []).some((planned) => {
    if (planned?.isOneoffLesson) {
      const linkedId = planned.oneoffLesson?.payroll_entry_id;
      if (linkedId && (entries || []).some((entry) => entry.id === linkedId && entry.entry_status)) {
        return true;
      }
    }
    return Boolean(findEntryForPlanned(entries, planned)?.entry_status);
  });
}

function nameOf(teacherId, teachersById, plannedList = []) {
  const fromMap = teachersById.get(teacherId)?.name;
  if (fromMap) return fromMap;
  for (const planned of plannedList) {
    const name = planned.oneoffLesson?.teachers?.name
      || planned.slot?.teachers?.name;
    if (name) return name;
  }
  return "선생님";
}

/**
 * 날짜별 선생님 체크 현황.
 * 예정 수업이 있는 선생님만 대상으로 하고,
 * 공휴일 자동처리만 있는 날은 목록에서 제외한다.
 */
export function buildTeacherCheckByDate({
  scheduleByDate,
  entries = [],
  teachers = [],
  vacations = [],
  teacherId = "",
  institutionId = "",
} = {}) {
  const teachersById = new Map((teachers || []).map((row) => [row.id, row]));
  const byDate = new Map();

  for (const [dateStr, planned] of Object.entries(scheduleByDate || {})) {
    let dayPlanned = planned || [];
    if (institutionId) {
      dayPlanned = dayPlanned.filter((item) => item.institutionId === institutionId);
    }
    const grouped = new Map();
    for (const item of dayPlanned) {
      const id = plannedTeacherId(item);
      if (!id) continue;
      if (teacherId && id !== teacherId) continue;
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(item);
    }

    const checked = [];
    const unchecked = [];
    for (const [id, items] of grouped) {
      if (isTeacherOnVacation(vacations, id, dateStr)) continue;
      const pending = items.filter((item) => !isPlannedChecked(entries, item));
      const person = {
        id,
        name: nameOf(id, teachersById, items),
        total: items.length,
        pending: pending.length,
      };
      if (pending.length) unchecked.push(person);
      else if (teacherHasRealCheck(entries, items)) checked.push(person);
    }

    checked.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    unchecked.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    byDate.set(dateStr, { checked, unchecked });
  }

  return byDate;
}

export function incidentsByDate(rows = []) {
  const map = new Map();
  for (const row of rows || []) {
    const dateStr = dateOnly(row.class_date);
    if (!dateStr) continue;
    if (!map.has(dateStr)) map.set(dateStr, []);
    map.get(dateStr).push(row);
  }
  return map;
}

export function monthDateRange(yearMonth) {
  return {
    fromDate: yearMonthFirstDay(yearMonth),
    toDate: yearMonthLastDay(yearMonth),
  };
}

export function parseYearMonth(yearMonth) {
  const [year, month] = String(yearMonth || "").split("-").map(Number);
  return {
    year: year || new Date().getFullYear(),
    month: (month || 1) - 1,
  };
}

export function defaultSelectedDate(yearMonth, today = new Date()) {
  const todayStr = fmtLocalDate(today);
  if (todayStr.startsWith(yearMonth)) return todayStr;
  return yearMonthLastDay(yearMonth);
}

export function mergeOneoffLessonsForAllTeachers(scheduleByDate, lessons) {
  const result = { ...(scheduleByDate || {}) };
  for (const lesson of lessons || []) {
    const dateStr = dateOnly(lesson.lesson_date);
    if (!dateStr) continue;
    const planned = {
      source: "oneoff",
      slot: { id: lesson.id, institution_id: lesson.institution_id, teacher_id: lesson.teacher_id },
      patternId: null,
      dateStr,
      institutionId: lesson.institution_id,
      institutionName: lesson.institutions?.name || "원",
      displayLabel: `${lesson.institutions?.name || "원"} · 일회성`,
      studentName: null,
      payType: "정규",
      startTime: String(lesson.start_time || "").slice(0, 5),
      endTime: String(lesson.end_time || "").slice(0, 5),
      scheduledMinutes: 0,
      location: null,
      isOneoffLesson: true,
      oneoffLesson: lesson,
    };
    result[dateStr] = [...(result[dateStr] || []), planned];
  }
  return result;
}
