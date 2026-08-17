/**
 * 이번 달 내 교구 — 교구명 / 선생님 검색
 */
import {
  assignedLetterForMonth,
  formatWeekRange,
  getMonthRotationAssignments,
  getWeekItemsForLetter,
  normalizeItemName,
  resolveItemRecord,
  resolveRotationSchedules,
} from "./itemRotation.js";
import { monthLabel } from "./lessonPlan.js";

function matchesGearQuery(query, row, items) {
  const q = normalizeItemName(query);
  if (!q) return false;
  const resolved = resolveItemRecord(items, row.item_name);
  const candidates = [
    row.item_name,
    resolved?.name,
    resolved?.alias,
    resolved?.code,
  ].filter(Boolean);
  return candidates.some((name) => {
    const n = normalizeItemName(name);
    return n.includes(q) || String(name).toLowerCase().includes(query.trim().toLowerCase());
  });
}

function teachersForLetter({ letter, viewMonth, allSchedules, teachers, startYear }) {
  const monthKey = String(viewMonth).slice(0, 7);
  const seen = new Set();
  const out = [];

  for (const teacher of teachers || []) {
    if (!teacher?.id || teacher.role === "superadmin") continue;
    const teacherSchedules = (allSchedules || []).filter((s) => s.teacher_id === teacher.id);
    const resolved = resolveRotationSchedules(teacherSchedules, teacher, startYear);
    const assigned = assignedLetterForMonth(resolved, teacher, monthKey);
    if (assigned !== letter) continue;
    if (seen.has(teacher.id)) continue;
    seen.add(teacher.id);
    out.push(teacher);
  }

  for (const row of getMonthRotationAssignments(allSchedules, viewMonth)) {
    if (row.assigned_letter !== letter) continue;
    const teacher = (teachers || []).find((t) => t.id === row.teacher_id);
    if (!teacher || seen.has(teacher.id)) continue;
    seen.add(teacher.id);
    out.push(teacher);
  }

  out.sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
  return out;
}

/** @returns {Array<object>} */
export function searchGearAssignmentsForMonth({
  query,
  viewMonth,
  allSchedules,
  weeklyLists,
  monthWeeks,
  teachers,
  items,
  startYear,
}) {
  const q = String(query || "").trim();
  if (!q) return [];

  const monthPrefix = String(viewMonth).slice(0, 7);
  const lettersInMonth = [...new Set(
    getMonthRotationAssignments(allSchedules, viewMonth).map((a) => a.assigned_letter),
  )];

  for (const teacher of teachers || []) {
    const letter = assignedLetterForMonth(
      resolveRotationSchedules(
        (allSchedules || []).filter((s) => s.teacher_id === teacher.id),
        teacher,
        startYear,
      ),
      teacher,
      monthPrefix,
    );
    if (letter && !lettersInMonth.includes(letter)) lettersInMonth.push(letter);
  }

  const weeksMap = new Map(
    (monthWeeks || [])
      .filter((w) => String(w.year_month).startsWith(monthPrefix))
      .map((w) => [w.week_number, w]),
  );

  const results = [];
  const seen = new Set();

  for (const letter of lettersInMonth) {
    for (const row of weeklyLists || []) {
      if (row.letter !== letter) continue;
      if (!matchesGearQuery(q, row, items)) continue;

      const key = `${letter}|${row.week_number}|${row.target_type}|${normalizeItemName(row.item_name)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const mw = weeksMap.get(row.week_number);
      const teacherList = teachersForLetter({
        letter,
        viewMonth,
        allSchedules,
        teachers,
        startYear,
      });

      results.push({
        itemName: row.item_name,
        letter,
        weekNumber: row.week_number,
        targetType: row.target_type,
        teacherNames: teacherList.map((t) => t.name),
        dateRange: mw ? formatWeekRange(mw.week_start_date, mw.week_end_date) : null,
        simpleActivity: row.simple_activity || null,
      });
    }
  }

  results.sort((a, b) => {
    const byName = a.itemName.localeCompare(b.itemName, "ko");
    if (byName) return byName;
    if (a.letter !== b.letter) return a.letter.localeCompare(b.letter);
    return a.weekNumber - b.weekNumber;
  });

  return results;
}

/** @returns {{ letter: string|null, rows: object[], monthLabel: string }} */
export function buildTeacherMonthAssignmentSummary({
  teacher,
  viewMonth,
  schedules,
  weeklyLists,
  monthWeeks,
  startYear,
}) {
  if (!teacher?.id) {
    return { letter: null, rows: [], monthLabel: monthLabel(viewMonth) };
  }

  const resolved = resolveRotationSchedules(schedules, teacher, startYear);
  const letter = assignedLetterForMonth(resolved, teacher, viewMonth);
  if (!letter) {
    return { letter: null, rows: [], monthLabel: monthLabel(viewMonth) };
  }

  const monthPrefix = String(viewMonth).slice(0, 7);
  const weeksMap = new Map(
    (monthWeeks || [])
      .filter((w) => String(w.year_month).startsWith(monthPrefix))
      .map((w) => [w.week_number, w]),
  );
  const weekNumbers = weeksMap.size
    ? [...weeksMap.keys()].sort((a, b) => a - b)
    : [1, 2, 3, 4, 5];

  const rows = weekNumbers.map((wn) => {
    const gear = getWeekItemsForLetter(weeklyLists, letter, wn);
    const mw = weeksMap.get(wn);
    let gearLabel = "—";
    if (gear?.merged) gearLabel = gear.displayName || gear.item_name;
    else if (gear?.parts?.length) {
      gearLabel = gear.parts.map((p) => `${p.label}: ${p.name}`).join(" · ");
    } else if (gear?.item_name) gearLabel = gear.item_name;

    return {
      weekNumber: wn,
      dateRange: mw ? formatWeekRange(mw.week_start_date, mw.week_end_date) : null,
      gearLabel,
    };
  }).filter((r) => r.gearLabel !== "—");

  return { letter, rows, monthLabel: monthLabel(viewMonth) };
}

export const ROTATION_SEARCH_MODES = [
  { id: "gear", label: "교구로 찾기" },
  { id: "teacher", label: "선생님으로 찾기" },
];
