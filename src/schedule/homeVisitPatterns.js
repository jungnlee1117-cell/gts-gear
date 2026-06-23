import { DAY_LABELS } from "./constants.js";
import { fmtLocalDate } from "./payrollCalendar.js";

function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatTime(t) {
  if (!t) return "";
  return t.slice(0, 5);
}

/** 패턴 한 줄 요약: 매주 수 16:00–17:00 */
export function formatPatternSchedule(pattern) {
  const day = DAY_LABELS[pattern.day_of_week] ?? "?";
  const start = formatTime(pattern.start_time);
  const end = formatTime(pattern.end_time);
  const time = end ? `${start}–${end}` : start;
  return `매주 ${day} ${time}`;
}

export function patternStatusLabel(pattern) {
  if (pattern.status === "ended") return "종료";
  return "진행 중";
}

/** 패턴이 해당 날짜 범위와 겹치는지 */
export function patternOverlapsRange(pattern, fromDate, toDate) {
  const start = pattern.pattern_start_date;
  const end = pattern.pattern_end_date || toDate;
  return start <= toDate && end >= fromDate;
}

/** 한 패턴을 [fromDate, toDate] 구간에서 전개 */
export function expandPattern(pattern, fromDate, toDate) {
  if (!patternOverlapsRange(pattern, fromDate, toDate)) return [];

  const rangeStart = parseDate(fromDate);
  const rangeEnd = parseDate(toDate);
  const patternStart = parseDate(pattern.pattern_start_date);
  const patternEnd = pattern.pattern_end_date
    ? parseDate(pattern.pattern_end_date)
    : rangeEnd;

  const effectiveStart = patternStart > rangeStart ? patternStart : rangeStart;
  const effectiveEnd = patternEnd < rangeEnd ? patternEnd : rangeEnd;

  if (effectiveStart > effectiveEnd) return [];

  const results = [];
  let cur = new Date(effectiveStart);

  while (cur.getDay() !== pattern.day_of_week && cur <= effectiveEnd) {
    cur = addDays(cur, 1);
  }

  while (cur <= effectiveEnd) {
    if (cur >= patternStart && cur <= patternEnd) {
      const dateStr = fmtLocalDate(cur);
      results.push({
        id: `${pattern.id}:${dateStr}`,
        pattern_id: pattern.id,
        visit_date: dateStr,
        start_time: pattern.start_time,
        end_time: pattern.end_time,
        location: pattern.location,
        student_name: pattern.student_name,
        student_birth_date: pattern.student_birth_date,
        parent_contact: pattern.parent_contact,
        note: pattern.note,
        teacher_id: pattern.teacher_id,
        teachers: pattern.teachers,
        pattern,
      });
    }
    cur = addDays(cur, 7);
  }

  return results;
}

/** 여러 패턴을 월간 캘린더용으로 전개 */
export function expandPatternsForRange(patterns, fromDate, toDate) {
  const all = [];
  for (const p of patterns) {
    all.push(...expandPattern(p, fromDate, toDate));
  }
  return all.sort((a, b) => {
    const d = a.visit_date.localeCompare(b.visit_date);
    if (d !== 0) return d;
    return formatTime(a.start_time).localeCompare(formatTime(b.start_time));
  });
}

export function groupOccurrencesByDate(occurrences) {
  const map = {};
  for (const o of occurrences) {
    if (!map[o.visit_date]) map[o.visit_date] = [];
    map[o.visit_date].push(o);
  }
  return map;
}

/** 활성·종료 패턴 중 해당 월과 겹치는 것만 */
export function patternsForCalendarMonth(patterns, fromDate, toDate) {
  return (patterns ?? []).filter(p => patternOverlapsRange(p, fromDate, toDate));
}
