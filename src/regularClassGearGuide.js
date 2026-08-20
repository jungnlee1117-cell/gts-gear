/**
 * 정규수업 시간표 + 교구 순환 기반 참고 안내 (이번 주·다음 주)
 */
import { formatYmdShort } from "./kstDate.js";
import { schoolYearStartYear } from "./lessonPlan.js";
import {
  assignedLetterForMonth,
  findCurrentRotationWeekSlot,
  findNextRotationWeekSlot,
  getCalendarWeekRange,
  getWeekItemsForLetter,
  normalizeItemName,
  resolveItemRecord,
  resolveRotationSchedules,
} from "./itemRotation.js";

function parseYmd(value) {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isRegularClassSlot(slot) {
  const t = String(slot?.class_type || slot?.label || "").trim();
  return t === "정규" || t.includes("정규");
}

function slotEffectiveOn(slot, ymd) {
  if (slot?.effective_from && ymd < slot.effective_from) return false;
  if (slot?.effective_to && ymd > slot.effective_to) return false;
  return true;
}

function assignedEntriesFromGear(gear, items) {
  if (!gear) return [];
  const names = [];
  if (gear.merged && gear.item_name) names.push(gear.item_name);
  else if (gear.parts?.length) names.push(...gear.parts.map(p => p.name).filter(Boolean));
  else if (gear.item_name) names.push(gear.item_name);

  const seen = new Set();
  const entries = [];
  for (const name of names) {
    const item = resolveItemRecord(items, name);
    const label = item?.name || name;
    const key = item?.id || `name:${normalizeItemName(label)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ name: label, itemId: item?.id || null, sheetName: name });
  }
  return entries;
}

export function groupWeeklySlotsByTeacher(slots) {
  const map = new Map();
  for (const slot of slots || []) {
    if (!slot?.teacher_id) continue;
    if (!map.has(slot.teacher_id)) map.set(slot.teacher_id, []);
    map.get(slot.teacher_id).push(slot);
  }
  return map;
}

function weekCalendarRange(weekSlot, weekOffset, now) {
  if (weekSlot?.week_start_date && weekSlot?.week_end_date) {
    return { startYmd: weekSlot.week_start_date, endYmd: weekSlot.week_end_date };
  }
  const { monday } = getCalendarWeekRange(now);
  const base = new Date(monday);
  base.setDate(base.getDate() + weekOffset * 7);
  return getCalendarWeekRange(base);
}

function regularSessionsInWeek(weeklySlots, startYmd, endYmd) {
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  if (!start || !end) return [];

  const sessions = [];
  const cur = new Date(start);
  while (cur <= end) {
    const ymd = toYmd(cur);
    const dow = cur.getDay();
    for (const slot of weeklySlots || []) {
      if (Number(slot.day_of_week) !== dow) continue;
      if (!isRegularClassSlot(slot)) continue;
      if (!slotEffectiveOn(slot, ymd)) continue;
      const institution = slot.institutions?.name || slot.institution?.name || null;
      sessions.push({ ymd, dow, institution });
    }
    cur.setDate(cur.getDate() + 1);
  }
  sessions.sort((a, b) => a.ymd.localeCompare(b.ymd));
  return sessions;
}

function formatSessionDateRange(sessions) {
  if (!sessions.length) return "-";
  const dates = [...new Set(sessions.map(s => s.ymd))].sort();
  if (dates.length === 1) return formatYmdShort(dates[0]);
  return `${formatYmdShort(dates[0])} ~ ${formatYmdShort(dates[dates.length - 1])}`;
}

/**
 * @returns {Map<string, Array<{ key, text, type, timing, teacherId? }>>}
 */
export function buildRegularClassGuideByItem({
  teachers,
  rotationSchedules,
  weeklyLists,
  monthWeeks,
  weeklySlotsAll,
  items,
  now = new Date(),
  startYear = schoolYearStartYear(now),
}) {
  const currentSlot = findCurrentRotationWeekSlot(monthWeeks, now);
  const nextSlot = findNextRotationWeekSlot(monthWeeks, now);
  const slotsByTeacher = groupWeeklySlotsByTeacher(weeklySlotsAll);
  const activeTeachers = (teachers || []).filter(
    t => t?.id && t.active !== false && t.role !== "superadmin",
  );

  const guideEntries = [];

  for (const weekSpec of [
    { slot: currentSlot, offset: 0, label: "this" },
    { slot: nextSlot, offset: 1, label: "next" },
  ]) {
    if (!weekSpec.slot) continue;
    const monthKey = String(weekSpec.slot.year_month || "").slice(0, 7);
    const weekNumber = weekSpec.slot.week_number;
    const { startYmd, endYmd } = weekCalendarRange(weekSpec.slot, weekSpec.offset, now);

    for (const teacher of activeTeachers) {
      const teacherRotationRows = (rotationSchedules || []).filter(s => s.teacher_id === teacher.id);
      const teacherSchedules = resolveRotationSchedules(teacherRotationRows, teacher, startYear);
      const letter = assignedLetterForMonth(teacherSchedules, teacher, monthKey);
      if (!letter) continue;

      const gear = getWeekItemsForLetter(weeklyLists, letter, weekNumber);
      const assigned = assignedEntriesFromGear(gear, items);
      if (!assigned.length) continue;

      const teacherSlots = slotsByTeacher.get(teacher.id) || [];
      const sessions = regularSessionsInWeek(teacherSlots, startYmd, endYmd);
      if (!sessions.length) continue;

      const dateLabel = formatSessionDateRange(sessions);
      const teacherName = teacher.name || "—";

      for (const entry of assigned) {
        if (!entry.itemId) continue;
        guideEntries.push({
          itemId: entry.itemId,
          teacherId: teacher.id,
          key: `reg-${teacher.id}-${weekSpec.label}-${entry.itemId}`,
          text: `${teacherName} 선생님 정규수업 예정 (${dateLabel})`,
          type: "regular_class",
          timing: weekSpec.offset === 0 ? "current" : "future",
          sortAt: sessions[0].ymd,
        });
      }
    }
  }

  const byItem = new Map();
  for (const entry of guideEntries) {
    if (!byItem.has(entry.itemId)) byItem.set(entry.itemId, []);
    byItem.get(entry.itemId).push(entry);
  }

  for (const [itemId, lines] of byItem) {
    lines.sort((a, b) => {
      const dateDiff = String(a.sortAt || "").localeCompare(String(b.sortAt || ""));
      if (dateDiff) return dateDiff;
      return a.text.localeCompare(b.text, "ko");
    });
    byItem.set(itemId, lines.map(({ key, text, type, timing, teacherId }) => ({
      key,
      text,
      type,
      timing,
      teacherId,
    })));
  }

  return byItem;
}

/** 연체 알림용 — 해당 교구를 이번/다음 주 정규수업에 필요로 하는 선생님 */
export function findUpcomingRegularClassTeachersForItem({
  teachers,
  rotationSchedules,
  weeklyLists,
  monthWeeks,
  weeklySlotsAll,
  items,
  itemId,
  itemName,
  excludeTeacherId = null,
  now = new Date(),
  startYear = schoolYearStartYear(now),
}) {
  const guideByItem = buildRegularClassGuideByItem({
    teachers,
    rotationSchedules,
    weeklyLists,
    monthWeeks,
    weeklySlotsAll,
    items,
    now,
    startYear,
  });

  const targetItemIds = new Set();
  if (itemId && guideByItem.has(itemId)) targetItemIds.add(itemId);
  if (!targetItemIds.size && itemName) {
    for (const [id] of guideByItem) {
      const item = items?.find(i => i.id === id);
      if (item && normalizeItemName(item.name) === normalizeItemName(itemName)) {
        targetItemIds.add(id);
      }
    }
  }

  const seen = new Set();
  const results = [];
  for (const id of targetItemIds) {
    for (const line of guideByItem.get(id) || []) {
      if (!line.teacherId) continue;
      if (excludeTeacherId && line.teacherId === excludeTeacherId) continue;
      if (seen.has(line.teacherId)) continue;
      seen.add(line.teacherId);
      const teacher = (teachers || []).find(t => t.id === line.teacherId);
      results.push({
        teacherId: line.teacherId,
        teacherName: teacher?.name || "—",
      });
    }
  }
  return results;
}
