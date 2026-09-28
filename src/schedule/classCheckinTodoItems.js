import { useCallback, useEffect, useState } from "react";
import {
  fetchFinalizedInstitutionIds,
  fetchHomeVisitPatterns,
  fetchPayrollEntries,
  fetchScheduleExceptions,
  fetchTeacherVacations,
  fetchWeeklySchedule,
} from "./api.js";
import { fmtLocalDate, yearMonthKey } from "./constants.js";
import {
  collectUnconfirmedPlanned,
  expandMonthSchedule,
} from "./payrollCalendar.js";
import { filterExceptionsForInstitutions } from "./scheduleExceptions.js";

export const CLASS_CHECKIN_TODO_SOURCE = "class_checkin";
export const CLASS_CHECKIN_LOOKBACK_MONTHS = 3;

export function classCheckinPlannedKey(planned) {
  return `${planned?.source || ""}-${planned?.slot?.id || planned?.patternId || ""}-${planned?.dateStr || ""}`;
}

export function formatClassCheckinTodoLabel(planned, { todayStr } = {}) {
  const place = String(planned?.institutionName || planned?.studentName || "수업").trim();
  const start = String(planned?.startTime || "").slice(0, 5);
  const end = String(planned?.endTime || "").slice(0, 5);
  const time = start && end ? `${start}~${end}` : start || end;
  const dateStr = String(planned?.dateStr || "").slice(0, 10);
  const datePart = dateStr && dateStr !== todayStr
    ? `${Number(dateStr.slice(5, 7))}.${Number(dateStr.slice(8, 10))} `
    : "";
  return `${datePart}${[place, time].filter(Boolean).join(" ")} — 수업 체크 필요`;
}

function shiftYearMonth(yearMonth, delta) {
  const [year, month] = String(yearMonth).split("-").map(Number);
  const date = new Date(year, (month || 1) - 1 + delta, 1);
  return yearMonthKey(date);
}

function yearMonthsBack(count, from = new Date()) {
  const current = yearMonthKey(from);
  return Array.from({ length: count }, (_, index) => shiftYearMonth(current, -(count - 1 - index)));
}

function isOnVacation(vacations, teacherId, dateStr) {
  return (vacations || []).some((row) => (
    row.teacher_id === teacherId
    && String(row.start_date || "").slice(0, 10) <= dateStr
    && String(row.end_date || "").slice(0, 10) >= dateStr
  ));
}

function classHasEnded(planned, today, todayStr) {
  const dateStr = String(planned?.dateStr || "").slice(0, 10);
  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;
  const end = String(planned?.endTime || planned?.startTime || "").slice(0, 5);
  if (!end) return true;
  const [hour, minute] = end.split(":").map(Number);
  return (today.getHours() * 60 + today.getMinutes()) >= ((hour || 0) * 60 + (minute || 0));
}

export function toClassCheckinTodoItem(planned, teacherId, { todayStr } = {}) {
  const dateStr = String(planned.dateStr || "").slice(0, 10);
  const plannedKey = classCheckinPlannedKey(planned);
  return {
    id: `class-checkin:${plannedKey}`,
    source: CLASS_CHECKIN_TODO_SOURCE,
    content: formatClassCheckinTodoLabel(planned, { todayStr }),
    start_date: dateStr,
    due_date: dateStr,
    class_date: dateStr,
    assignee_id: teacherId,
    priority: dateStr < todayStr ? "urgent" : "important",
    is_completed: false,
    created_at: dateStr,
    plannedKey,
    planned,
  };
}

export function isClassCheckinTodo(item) {
  return item?.source === CLASS_CHECKIN_TODO_SOURCE || String(item?.id || "").startsWith("class-checkin:");
}

export async function fetchUnconfirmedClassCheckinItems(teacherId, {
  today = new Date(),
  lookbackMonths = CLASS_CHECKIN_LOOKBACK_MONTHS,
} = {}) {
  if (!teacherId) return [];
  const todayStr = fmtLocalDate(today);
  const months = yearMonthsBack(lookbackMonths, today);
  const fromDate = `${months[0]}-01`;

  const [weekly, visits, exceptions, vacations, ...monthPayloads] = await Promise.all([
    fetchWeeklySchedule(null, teacherId).catch(() => []),
    fetchHomeVisitPatterns({ teacherId }).catch(() => []),
    fetchScheduleExceptions(null, fromDate, todayStr).catch(() => []),
    fetchTeacherVacations({ teacherId, fromDate, toDate: todayStr }).catch(() => []),
    ...months.map(async (yearMonth) => {
      const [entries, finalized] = await Promise.all([
        fetchPayrollEntries({ teacherId, yearMonth }).catch(() => []),
        fetchFinalizedInstitutionIds(yearMonth).catch(() => new Set()),
      ]);
      return { yearMonth, entries: entries || [], finalized: finalized || new Set() };
    }),
  ]);

  const teacherInstitutionIds = new Set(
    (weekly || []).map((slot) => slot.institution_id).filter(Boolean),
  );
  const teacherExceptions = filterExceptionsForInstitutions(exceptions || [], teacherInstitutionIds);
  const entries = monthPayloads.flatMap((row) => row.entries);
  const finalizedByMonth = new Map(monthPayloads.map((row) => [row.yearMonth, row.finalized]));

  const scheduleByDate = {};
  for (const yearMonth of months) {
    const [year, month] = yearMonth.split("-").map(Number);
    Object.assign(
      scheduleByDate,
      expandMonthSchedule(weekly || [], year, month - 1, teacherExceptions, visits || []),
    );
  }

  const unconfirmed = collectUnconfirmedPlanned(scheduleByDate, entries, {
    today,
    dateFilter: (dateStr) => dateStr <= todayStr,
  })
    .filter((planned) => {
      const yearMonth = String(planned.dateStr || "").slice(0, 7);
      if (planned.institutionId && finalizedByMonth.get(yearMonth)?.has(planned.institutionId)) return false;
      if (isOnVacation(vacations, teacherId, planned.dateStr)) return false;
      return classHasEnded(planned, today, todayStr);
    })
    .sort((a, b) => (
      String(a.dateStr).localeCompare(String(b.dateStr))
      || String(a.startTime || "").localeCompare(String(b.startTime || ""))
    ));

  return unconfirmed.map((planned) => toClassCheckinTodoItem(planned, teacherId, { todayStr }));
}

export function useUnconfirmedClassCheckinTodos(teacherId, enabled = true) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled || !teacherId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      setItems(await fetchUnconfirmedClassCheckinItems(teacherId));
    } catch (error) {
      console.warn("class checkin todos", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, teacherId]);

  useEffect(() => { reload(); }, [reload]);

  return { items, loading, reload };
}
