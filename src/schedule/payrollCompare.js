import { minutesBetween } from "./constants.js";
import { expandMonthSchedule } from "./payrollCalendar.js";

const PAY_TYPES = ["정규", "방과후", "가정방문", "센터", "센터보조"];

export function compareRowKey(dateStr, payType, institutionName = "") {
  const inst = institutionName && institutionName !== "*" ? institutionName : "*";
  return `${dateStr}|${payType}|${inst}`;
}

/** 일별·구분별 합산 — 기관 무시(date|type) 또는 기관별 */
export function aggregateDailyMinutes(rows, { includedOnly = true, keyInstitution = false } = {}) {
  const map = new Map();
  for (const row of rows) {
    if (includedOnly && row.includedInTotal === false) continue;
    if (includedOnly && row.countedMinutes != null && row.countedMinutes <= 0) continue;
    const minutes = row.countedMinutes ?? row.entryMinutes ?? row.scheduledMinutes ?? row.minutes ?? 0;
    if (Number(minutes) <= 0) continue;
    const inst = keyInstitution ? (row.institutionName || "*") : "*";
    const key = compareRowKey(row.dateStr, row.payType, inst);
    map.set(key, (map.get(key) || 0) + Number(minutes));
  }
  return map;
}

/** payroll_entries 원본 + 슬롯 시간 조인 */
export function buildRawPayrollEntryRows(entries, weeklySlots = []) {
  const slotMap = new Map((weeklySlots || []).map(s => [s.id, s]));

  return [...entries]
    .map(entry => {
      const slot = entry.schedule_slot_id ? slotMap.get(entry.schedule_slot_id) : null;
      const startTime = slot?.start_time?.slice(0, 5) ?? null;
      const endTime = slot?.end_time?.slice(0, 5) ?? null;
      const scheduledMinutes = startTime && endTime
        ? minutesBetween(startTime, endTime)
        : null;
      const includedInTotal = Boolean(entry.entry_status && Number(entry.minutes) > 0);

      return {
        entryId: entry.id,
        dateStr: entry.class_date,
        institutionName: entry.institutions?.name ?? slot?.institutions?.name ?? "",
        payType: entry.pay_type,
        startTime: startTime ?? "—",
        endTime: endTime ?? "—",
        scheduledMinutes,
        entryMinutes: entry.minutes != null ? Number(entry.minutes) : null,
        entryStatus: entry.entry_status ?? null,
        includedInTotal,
        countedMinutes: includedInTotal ? Number(entry.minutes) : 0,
        scheduleSlotId: entry.schedule_slot_id ?? null,
        note: entry.note ?? null,
      };
    })
    .sort((a, b) => {
      const d = a.dateStr.localeCompare(b.dateStr);
      if (d !== 0) return d;
      if (a.startTime === "—") return 1;
      if (b.startTime === "—") return -1;
      return a.startTime.localeCompare(b.startTime);
    });
}

export function mapToDailyRows(map) {
  return [...map.entries()]
    .map(([key, minutes]) => {
      const [dateStr, payType, institutionName] = key.split("|");
      return { dateStr, payType, institutionName: institutionName === "*" ? "" : institutionName, minutes };
    })
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr) || a.payType.localeCompare(b.payType));
}

export function sumByPayType(rowsOrMap, payTypes = ["정규", "방과후"]) {
  const totals = Object.fromEntries(payTypes.map(t => [t, 0]));
  const list = rowsOrMap instanceof Map ? mapToDailyRows(rowsOrMap) : rowsOrMap;
  for (const row of list) {
    if (totals[row.payType] != null) totals[row.payType] += row.minutes;
  }
  return totals;
}

/** 스케줄 기반 이론 일별 (점심 12:00~12:40 슬롯 제외 옵션) */
export function buildScheduleTheoryDaily({
  weeklySlots,
  exceptions = [],
  year,
  month,
  excludeLunchSlot = true,
}) {
  const filtered = excludeLunchSlot
    ? weeklySlots.filter(s => !(s.start_time?.startsWith("12:00") && s.end_time?.startsWith("12:40")))
    : weeklySlots;

  const scheduleByDate = expandMonthSchedule(filtered, year, month, exceptions);
  const map = new Map();

  for (const [dateStr, planned] of Object.entries(scheduleByDate)) {
    for (const p of planned) {
      const key = compareRowKey(dateStr, p.payType, "*");
      map.set(key, (map.get(key) || 0) + p.scheduledMinutes);
    }
  }
  return map;
}

/** CSV: class_date,pay_type,minutes[,institution_name] */
export function parseReferencePayrollCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const header = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const idx = name => header.findIndex(h => h === name || h.toLowerCase() === name);

  const colDate = idx("class_date") >= 0 ? idx("class_date") : idx("date") >= 0 ? idx("date") : idx("날짜");
  const colType = idx("pay_type") >= 0 ? idx("pay_type") : idx("구분");
  const colMin = idx("minutes") >= 0 ? idx("minutes") : idx("분");
  const colInst = idx("institution_name") >= 0 ? idx("institution_name") : idx("institution") >= 0 ? idx("institution") : idx("기관");

  const rows = [];
  const start = colDate >= 0 ? 1 : 0;

  for (const line of lines.slice(start)) {
    const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    const dateStr = normalizeDate(cols[colDate >= 0 ? colDate : 0]);
    const payType = cols[colType >= 0 ? colType : 1] || "정규";
    const minutes = parseMinutes(cols[colMin >= 0 ? colMin : 2]);
    const institutionName = colInst >= 0 ? cols[colInst] : "";
    if (!dateStr || minutes <= 0 || !PAY_TYPES.includes(payType)) continue;
    rows.push({ dateStr, payType, minutes, institutionName });
  }
  return rows;
}

function normalizeDate(raw) {
  const s = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.](\d{1,2})$/);
  if (m) return `2026-${String(Number(m[1])).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
  const m2 = s.match(/^2026[/.](\d{1,2})[/.](\d{1,2})$/);
  if (m2) return `2026-${String(Number(m2[1])).padStart(2, "0")}-${String(Number(m2[2])).padStart(2, "0")}`;
  return null;
}

function parseMinutes(raw) {
  const n = Number(String(raw || "").replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function referenceRowsToMap(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = compareRowKey(row.dateStr, row.payType, "*");
    map.set(key, (map.get(key) || 0) + row.minutes);
  }
  return map;
}

const COMPARE_STATUS = {
  match: "일치",
  missing_system: "시스템 누락",
  extra_system: "시스템만 있음",
  minutes_diff: "분 불일치",
  missing_reference: "원본 없음",
  missing_theory: "이론 없음",
};

/**
 * 일별 3자 비교: 시스템(확정) vs 구글시트 원본 vs 스케줄 이론
 */
export function buildThreeWayComparison({
  systemDaily,
  referenceDaily,
  theoryDaily,
  focusTypes = ["정규", "방과후"],
}) {
  const keys = new Set([
    ...systemDaily.keys(),
    ...referenceDaily.keys(),
    ...theoryDaily.keys(),
  ]);

  const rows = [];
  for (const key of [...keys].sort()) {
    const [dateStr, payType, institutionName] = key.split("|");
    if (!focusTypes.includes(payType)) continue;

    const system = systemDaily.get(key) ?? null;
    const reference = referenceDaily.get(key) ?? null;
    const theory = theoryDaily.get(key) ?? null;

    if (system == null && reference == null && theory == null) continue;

    let status = COMPARE_STATUS.match;
    let issue = null;

    if (reference != null && system == null) {
      status = COMPARE_STATUS.missing_system;
      issue = `원본 ${reference}분인데 시스템에 없음`;
    } else if (reference == null && system != null) {
      status = COMPARE_STATUS.extra_system;
      issue = `시스템 ${system}분인데 원본에 없음`;
    } else if (reference != null && system != null && reference !== system) {
      status = COMPARE_STATUS.minutes_diff;
      issue = `원본 ${reference}분 ≠ 시스템 ${system}분 (차 ${system - reference}분)`;
    } else if (reference != null && theory != null && reference !== theory) {
      status = COMPARE_STATUS.minutes_diff;
      issue = issue || `원본 ${reference}분 ≠ 이론 ${theory}분`;
    } else if (system != null && theory != null && system !== theory && reference == null) {
      status = COMPARE_STATUS.minutes_diff;
      issue = issue || `시스템 ${system}분 ≠ 이론 ${theory}분`;
    }

    rows.push({
      key,
      dateStr,
      payType,
      institutionName: institutionName === "*" ? "" : institutionName,
      systemMinutes: system,
      referenceMinutes: reference,
      theoryMinutes: theory,
      status,
      issue,
      hasMismatch: status !== COMPARE_STATUS.match,
    });
  }

  const mismatchRows = rows.filter(r => r.hasMismatch);
  const summary = {
    systemTotals: sumByPayType(systemDaily, focusTypes),
    referenceTotals: sumByPayType(referenceDaily, focusTypes),
    theoryTotals: sumByPayType(theoryDaily, focusTypes),
    mismatchCount: mismatchRows.length,
    missingInSystem: mismatchRows.filter(r => r.status === COMPARE_STATUS.missing_system),
    extraInSystem: mismatchRows.filter(r => r.status === COMPARE_STATUS.extra_system),
    minutesDiff: mismatchRows.filter(r => r.status === COMPARE_STATUS.minutes_diff),
  };

  return { rows, summary, statusLabels: COMPARE_STATUS };
}
