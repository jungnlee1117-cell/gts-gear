/**
 * 선생님별 이번 주 배정 교구 vs 실제 대여 비교
 */
import {
  assignedLetterForMonth,
  getWeekItemsForLetter,
  normalizeItemName,
  resolveItemRecord,
  resolveRotationSchedules,
} from "./itemRotation.js";
import { buildCurrentRentals } from "./teacherGearStatus.js";

export const ROTATION_RENTAL_STATUS = {
  ok: "ok",
  mismatch: "mismatch",
  missing: "missing",
};

export const ROTATION_RENTAL_STATUS_META = {
  ok: { id: "ok", label: "정상", filterLabel: "정상" },
  mismatch: { id: "mismatch", label: "다른 교구 대여", filterLabel: "다른교구" },
  missing: { id: "missing", label: "아직 대여 안 함", filterLabel: "미대여" },
};

export const ROTATION_RENTAL_FILTERS = [
  { id: "all", label: "전체" },
  { id: "ok", label: "정상" },
  { id: "mismatch", label: "다른교구" },
  { id: "missing", label: "미대여" },
];

function assignedEntriesFromGear(gear, items) {
  if (!gear) return [];
  const names = [];
  if (gear.merged && gear.item_name) names.push(gear.item_name);
  else if (gear.parts?.length) names.push(...gear.parts.map((p) => p.name).filter(Boolean));
  else if (gear.item_name) names.push(gear.item_name);

  const seen = new Set();
  const entries = [];
  for (const name of names) {
    const item = resolveItemRecord(items, name);
    const label = item?.name || name;
    const key = item?.id || `name:${normalizeItemName(label)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ name: label, itemId: item?.id || null });
  }
  return entries;
}

function rentalKey(row) {
  if (row.itemId) return row.itemId;
  return `name:${normalizeItemName(row.itemName)}`;
}

function assignedKeySet(assigned) {
  const keys = new Set();
  for (const a of assigned) {
    if (a.itemId) keys.add(a.itemId);
    keys.add(`name:${normalizeItemName(a.name)}`);
  }
  return keys;
}

function rentalMatchesAssigned(rental, assignedKeys) {
  if (rental.itemId && assignedKeys.has(rental.itemId)) return true;
  return assignedKeys.has(`name:${normalizeItemName(rental.itemName)}`);
}

export function resolveRotationRentalStatus(assigned, rentals) {
  if (!rentals.length) return ROTATION_RENTAL_STATUS.missing;
  if (!assigned.length) return ROTATION_RENTAL_STATUS.mismatch;
  const assignedKeys = assignedKeySet(assigned);
  const hasForeign = rentals.some((r) => !rentalMatchesAssigned(r, assignedKeys));
  return hasForeign ? ROTATION_RENTAL_STATUS.mismatch : ROTATION_RENTAL_STATUS.ok;
}

export function formatGearNames(entries) {
  if (!entries?.length) return "—";
  return [...new Set(entries.map((e) => e.name).filter(Boolean))].join(" · ");
}

/**
 * @returns {Array<{
 *   teacherId: string,
 *   teacherName: string,
 *   assignedNames: string,
 *   rentedNames: string,
 *   rentedHighlight: boolean,
 *   status: string,
 *   letter: string|null,
 * }>}
 */
export function buildTeacherRotationRentalRows({
  teachers,
  schedules,
  weeklyLists,
  monthWeeks,
  items,
  reqs,
  ris,
  rets,
  weekSlot,
  startYear,
}) {
  if (!weekSlot) return [];

  const monthKey = String(weekSlot.year_month || "").slice(0, 7);
  const weekNumber = weekSlot.week_number;
  const list = (teachers || []).filter((t) => t?.id && t.active !== false && t.role !== "superadmin");

  const rows = [];
  for (const teacher of list) {
    const teacherSchedules = resolveRotationSchedules(schedules, teacher, startYear);
    const letter = assignedLetterForMonth(teacherSchedules, teacher, monthKey);
    if (!letter) continue;

    const gear = getWeekItemsForLetter(weeklyLists, letter, weekNumber);
    const assigned = assignedEntriesFromGear(gear, items);
    if (!assigned.length) continue;

    const rentals = buildCurrentRentals(teacher, reqs || [], ris || [], items || [], rets || []);
    const status = resolveRotationRentalStatus(assigned, rentals);

    rows.push({
      teacherId: teacher.id,
      teacherName: teacher.name || "—",
      letter,
      assignedNames: formatGearNames(assigned),
      rentedNames: formatGearNames(rentals.map((r) => ({ name: r.itemName }))),
      rentedHighlight: status === ROTATION_RENTAL_STATUS.mismatch,
      status,
    });
  }

  rows.sort((a, b) => {
    const rank = { mismatch: 0, missing: 1, ok: 2 };
    const d = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
    if (d) return d;
    return String(a.teacherName).localeCompare(String(b.teacherName), "ko");
  });

  return rows;
}
