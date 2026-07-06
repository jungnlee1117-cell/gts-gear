import { minutesBetween } from "./constants.js";
import { entryPayAmount } from "./settlement.js";

export const ONEOFF_LESSON_COLOR = "#3b82f6";

export function formatOneoffTime(timeStr) {
  return String(timeStr || "").slice(0, 5);
}

export function oneoffLessonMinutes(lesson) {
  return minutesBetween(
    formatOneoffTime(lesson.start_time),
    formatOneoffTime(lesson.end_time),
  );
}

export function oneoffLessonToPlanned(lesson) {
  const startTime = formatOneoffTime(lesson.start_time);
  const endTime = formatOneoffTime(lesson.end_time);
  const instName = lesson.institutions?.name || "원";
  return {
    source: "oneoff",
    slot: { id: lesson.id, institution_id: lesson.institution_id },
    patternId: null,
    dateStr: lesson.lesson_date,
    institutionId: lesson.institution_id,
    institutionName: instName,
    displayLabel: `${instName} · 일회성`,
    studentName: null,
    payType: "정규",
    startTime,
    endTime,
    scheduledMinutes: oneoffLessonMinutes(lesson),
    location: null,
    isOneoffLesson: true,
    oneoffLesson: lesson,
  };
}

export function mergeOneoffLessonsIntoSchedule(scheduleByDate, lessons, { teacherId }) {
  const result = { ...(scheduleByDate || {}) };
  for (const lesson of lessons || []) {
    if (lesson.teacher_id !== teacherId) continue;
    const dateStr = lesson.lesson_date;
    const planned = oneoffLessonToPlanned(lesson);
    result[dateStr] = sortPlannedByTime([...(result[dateStr] || []), planned]);
  }
  return result;
}

function sortPlannedByTime(list) {
  return [...list].sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
}

export function hasOneoffLessonOnDate(lessons, dateStr) {
  return (lessons || []).some(l => l.lesson_date === dateStr);
}

export function sumOneoffCustomPayAdjustments(entries, oneoffLessons, rates) {
  let delta = 0;
  for (const lesson of oneoffLessons || []) {
    if (!lesson.link_payroll || lesson.pay_amount == null || !lesson.payroll_entry_id) continue;
    const entry = (entries || []).find(e => e.id === lesson.payroll_entry_id);
    if (!entry) continue;
    delta += Number(lesson.pay_amount) - entryPayAmount(entry, rates);
  }
  return Math.round(delta);
}
