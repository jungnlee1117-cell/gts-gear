import {
  assignedLetterForMonth,
  findNextRotationWeekSlot,
  formatCalendarWeekRange,
  getCalendarWeekRange,
  getWeekItemsForLetter,
  resolveItemRecord,
  resolveRotationSchedules,
  rotationSubjectTeacherId,
  rotationWeekRangeForSlot,
  yearMonthFirstDay,
  schoolYearMonths,
} from "./itemRotation.js";
import { schoolYearStartYear } from "./lessonPlan.js";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const THREE_MONTHS_MS = 90 * 86400000;

function parseLocalDay(value) {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hasRentalStarted(req) {
  if (!req?.dispatch_start) return true;
  const start = parseLocalDay(req.dispatch_start);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !start || start <= today;
}

export function formatShortDate(value) {
  const d = parseLocalDay(value);
  if (!d) return "-";
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

export function formatKoreanClassDate(value) {
  const d = parseLocalDay(value);
  if (!d) return "-";
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${DAY_LABELS[d.getDay()]})`;
}

function heldQtyForRi(ri, rets) {
  if (!["rented", "partial_returned"].includes(ri.status)) return 0;
  const approved = (rets || [])
    .filter(r => r.rental_item_id === ri.id && r.status === "return_approved")
    .reduce((s, r) => s + r.quantity, 0);
  return Math.max(0, ri.quantity - approved);
}

function daysUntilDue(dueDate) {
  const due = parseLocalDay(dueDate);
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((due - today) / 86400000);
}

function normalizeLocation(loc) {
  return String(loc || "").trim().toLowerCase();
}

function gearNamesFromWeek(gear) {
  if (!gear) return [];
  if (gear.merged) return [gear.item_name];
  if (gear.parts?.length) return gear.parts.map(p => p.name);
  return gear.item_name ? [gear.item_name] : [];
}

function enumerateWeekDates(startYmd, endYmd) {
  const start = parseLocalDay(startYmd);
  const end = parseLocalDay(endYmd);
  if (!start || !end) return [];
  const rows = [];
  const cur = new Date(start);
  while (cur <= end) {
    rows.push({
      ymd: toYmd(cur),
      dow: cur.getDay(),
      date: new Date(cur),
    });
    cur.setDate(cur.getDate() + 1);
  }
  return rows;
}

export function buildCurrentRentals(me, reqs, ris, items, rets) {
  return ris
    .filter(ri => {
      const req = reqs.find(r => r.id === ri.request_id);
      return req?.teacher_id === me.id
        && hasRentalStarted(req)
        && ["rented", "partial_returned"].includes(ri.status);
    })
    .map(ri => {
      const held = heldQtyForRi(ri, rets);
      if (held <= 0) return null;
      const req = reqs.find(r => r.id === ri.request_id);
      const item = items.find(i => i.id === ri.item_id);
      return {
        id: ri.id,
        itemId: ri.item_id,
        itemName: item?.name || "-",
        quantity: held,
        rentDate: req?.dispatch_start || ri.approved_at || ri.created_at,
        dueDate: ri.due_date || req?.dispatch_end,
        location: req?.dispatch_location || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const da = parseLocalDay(a.dueDate)?.getTime() ?? 0;
      const db = parseLocalDay(b.dueDate)?.getTime() ?? 0;
      return da - db;
    });
}

export function buildDueReturns(currentRentals) {
  return currentRentals
    .map(row => {
      const diff = daysUntilDue(row.dueDate);
      if (diff === null || diff > 3) return null;
      let status;
      let tone;
      if (diff < 0) {
        status = "반납 지연";
        tone = "danger";
      } else if (diff === 0) {
        status = "오늘 반납";
        tone = "danger";
      } else {
        status = `${diff}일 이내`;
        tone = "warning";
      }
      return { ...row, status, tone, daysLeft: diff };
    })
    .filter(Boolean)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function buildGearRecommendations(me, reqs, ris, items) {
  const cutoff = Date.now() - THREE_MONTHS_MS;
  const teacherUsed = new Set();
  const globalPopularity = new Map();
  const usedAtLocation = new Map();

  for (const req of reqs || []) {
    if (!["approved", "pending"].includes(req.status)) continue;
    const ts = new Date(req.dispatch_start || req.created_at).getTime();
    if (Number.isNaN(ts) || ts < cutoff) continue;

    const loc = normalizeLocation(req.dispatch_location);
    const isMine = req.teacher_id === me.id;

    for (const ri of (ris || []).filter(r => r.request_id === req.id)) {
      globalPopularity.set(ri.item_id, (globalPopularity.get(ri.item_id) || 0) + 1);
      if (isMine) teacherUsed.add(ri.item_id);
      if (loc) {
        if (!usedAtLocation.has(loc)) usedAtLocation.set(loc, new Set());
        usedAtLocation.get(loc).add(ri.item_id);
      }
    }
  }

  const teacherLocations = [...new Set(
    (reqs || [])
      .filter(r => r.teacher_id === me.id && r.dispatch_location)
      .map(r => normalizeLocation(r.dispatch_location)),
  )];

  const recs = [];
  const seen = new Set();

  const popular = [...globalPopularity.entries()]
    .filter(([id, count]) => count >= 2 && !teacherUsed.has(id))
    .sort((a, b) => b[1] - a[1]);

  for (const [itemId] of popular) {
    if (seen.has(itemId)) continue;
    const item = items.find(i => i.id === itemId);
    if (!item) continue;
    recs.push({
      itemId,
      itemName: item.name,
      reason: "다른 기관에서 인기",
      tone: "popular",
    });
    seen.add(itemId);
    if (recs.length >= 3) break;
  }

  for (const item of items) {
    if (recs.length >= 6) break;
    if (seen.has(item.id) || teacherUsed.has(item.id)) continue;

    const usedAtMine = teacherLocations.some(loc => usedAtLocation.get(loc)?.has(item.id));
    if (usedAtMine) continue;

    recs.push({
      itemId: item.id,
      itemName: item.name,
      reason: teacherLocations.length ? "담당 기관 3개월 미사용" : "최근 3개월 미사용",
      tone: "unused",
    });
    seen.add(item.id);
  }

  return recs.slice(0, 6);
}

export function buildNextWeekItems({ schedules, weeklyLists, monthWeeks, weeklySlots, items, me }) {
  const nextSlot = findNextRotationWeekSlot(monthWeeks);
  if (!nextSlot) {
    const { monday } = getCalendarWeekRange(new Date());
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    return { rows: [], weekRange: formatCalendarWeekRange(nextMonday) };
  }

  const monthKey = String(nextSlot.year_month).slice(0, 7);
  const letter = me
    ? assignedLetterForMonth(schedules, me, monthKey)
    : (schedules || []).find(s => s.year_month?.startsWith(monthKey))?.assigned_letter;
  const weekRange = rotationWeekRangeForSlot(nextSlot)
    || formatCalendarWeekRange(new Date(Date.now() + 7 * 86400000));

  if (!letter) return { rows: [], weekRange };

  const gear = getWeekItemsForLetter(weeklyLists, letter, nextSlot.week_number);
  const gearNames = gearNamesFromWeek(gear);
  if (!gearNames.length) {
    return { rows: [], weekRange };
  }

  const cal = nextSlot.week_start_date && nextSlot.week_end_date
    ? { startYmd: nextSlot.week_start_date, endYmd: nextSlot.week_end_date }
    : getCalendarWeekRange(new Date(Date.now() + 7 * 86400000));
  const weekDates = enumerateWeekDates(cal.startYmd, cal.endYmd);
  const sessions = [];
  for (const d of weekDates) {
    for (const slot of weeklySlots || []) {
      if (slot.day_of_week !== d.dow) continue;
      const instName = slot.institutions?.name || slot.institution?.name || null;
      if (!instName) continue;
      sessions.push({
        dateLabel: formatKoreanClassDate(d.ymd),
        institution: instName,
        ymd: d.ymd,
      });
    }
  }

  sessions.sort((a, b) => a.ymd.localeCompare(b.ymd));

  const rows = [];
  for (const sheetName of gearNames) {
    const item = resolveItemRecord(items, sheetName);
    const session = sessions[rows.length % Math.max(sessions.length, 1)] || sessions[0];
    rows.push({
      itemId: item?.id || null,
      itemName: item?.name || sheetName,
      classDate: session?.dateLabel || formatKoreanClassDate(cal.startYmd),
      institution: session?.institution || "수업 일정 확인",
      sheetName,
    });
  }

  return {
    rows,
    weekRange,
  };
}

export async function fetchTeacherGearExtras(supabase, teacherUser) {
  const teacherId = rotationSubjectTeacherId(teacherUser);
  const startYear = schoolYearStartYear();
  const ymKeys = schoolYearMonths(startYear).map(m => yearMonthFirstDay(m));

  const [schedRes, weeklyRes, weeksRes, slotsRes] = await Promise.all([
    supabase.from("item_rotation_schedule")
      .select("year_month, assigned_letter, teacher_id")
      .eq("teacher_id", teacherId)
      .in("year_month", ymKeys),
    supabase.from("item_weekly_lists").select("*").order("week_number"),
    supabase.from("item_rotation_month_weeks")
      .select("*")
      .in("year_month", ymKeys)
      .order("week_number"),
    supabase.from("institution_weekly_schedule")
      .select("day_of_week, institution_id, institutions(name)")
      .eq("teacher_id", teacherId),
  ]);

  if (schedRes.error?.code === "42P01") {
    return { schedules: [], weeklyLists: [], monthWeeks: [], weeklySlots: [], rotationMissing: true };
  }

  return {
    schedules: resolveRotationSchedules(schedRes.data || [], teacherUser, startYear),
    weeklyLists: weeklyRes.error ? [] : (weeklyRes.data || []),
    monthWeeks: weeksRes.error ? [] : (weeksRes.data || []),
    weeklySlots: slotsRes.error ? [] : (slotsRes.data || []),
    rotationMissing: false,
  };
}
