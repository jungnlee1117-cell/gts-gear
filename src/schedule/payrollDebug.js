import {
  ENTRY_STATUS,
  ENTRY_STATUS_LABEL,
  expandMonthSchedule,
  findEntryForPlanned,
  getEffectiveSlotStatus,
  groupPayrollByTypeConfirmed,
} from "./payrollCalendar.js";
import { isKoreanHoliday } from "./koreanHolidays.js";
import { DAY_LABELS, resolveInstitutionSlotPayType } from "./constants.js";

const PAY_TYPES = ["정규", "방과후", "가정방문", "센터", "센터보조"];

function emptyByType() {
  return Object.fromEntries(PAY_TYPES.map(t => [t, 0]));
}

function excludeReasonFor(entry, dateStr) {
  if (!entry?.entry_status) {
    if (isKoreanHoliday(dateStr)) return "공휴일(미입력)";
    return "미확인";
  }
  if (entry.entry_status === ENTRY_STATUS.skipped) return "수업 안 함";
  if (Number(entry.minutes) === 0) return "0분";
  return null;
}

function statusLabel(status) {
  if (!status) return "미확인";
  return ENTRY_STATUS_LABEL[status] ?? status;
}

/** 주간 스케줄 패턴 요약 (요일 × 구분별 예정 분) */
export function summarizeWeeklyPattern(weeklySlots) {
  const byDay = {};
  for (let dow = 0; dow < 7; dow++) {
    byDay[dow] = emptyByType();
  }
  for (const slot of weeklySlots) {
    const dow = slot.day_of_week;
    const type = resolveInstitutionSlotPayType(slot);
    if (dow == null || !PAY_TYPES.includes(type)) continue;
    const start = slot.start_time?.slice(0, 5) ?? "";
    const end = slot.end_time?.slice(0, 5) ?? "";
    const mins = minutesFromTimes(start, end);
    byDay[dow][type] = (byDay[dow][type] || 0) + mins;
  }
  return Object.entries(byDay).map(([dow, byType]) => ({
    dayLabel: DAY_LABELS[Number(dow)],
    dayOfWeek: Number(dow),
    byType,
    total: Object.values(byType).reduce((s, n) => s + n, 0),
  })).filter(row => row.total > 0);
}

function minutesFromTimes(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

function buildTypeCalculationSteps(rows, byTypeIncluded) {
  return PAY_TYPES.map(payType => {
    const included = rows.filter(r => r.includedInTotal && r.payType === payType);
    const parts = included.map(r => {
      const day = r.dateStr.slice(5);
      return `${day} ${r.countedMinutes}분`;
    });
    const total = byTypeIncluded[payType] || 0;
    return {
      payType,
      total,
      sessionCount: included.length,
      formula: parts.length ? `${parts.join(" + ")} = ${total}분` : "집계 포함 수업 없음",
    };
  }).filter(step => step.total > 0 || step.sessionCount > 0);
}

/**
 * 월간 급여 집계 디버그 리포트.
 * 집계 규칙은 groupPayrollByTypeConfirmed 와 동일 (entry_status && minutes > 0).
 */
export function buildPayrollDebugReport({
  weeklySlots,
  homeVisitPatterns = [],
  entries,
  exceptions = [],
  year,
  month,
}) {
  const scheduleByDate = expandMonthSchedule(
    weeklySlots,
    year,
    month,
    exceptions,
    homeVisitPatterns,
  );
  const rows = [];
  const matchedEntryIds = new Set();

  for (const dateStr of Object.keys(scheduleByDate).sort()) {
    for (const planned of scheduleByDate[dateStr]) {
      const entry = findEntryForPlanned(entries, planned);
      if (entry?.id) matchedEntryIds.add(entry.id);

      const effectiveStatus = getEffectiveSlotStatus(entry, planned.dateStr);
      const countedMinutes = entry?.entry_status && Number(entry.minutes) > 0
        ? Number(entry.minutes)
        : 0;
      const includedInTotal = countedMinutes > 0;
      const excludeReason = includedInTotal ? null : excludeReasonFor(entry, planned.dateStr);

      rows.push({
        source: "schedule",
        dateStr,
        institutionName: planned.institutionName,
        payType: planned.payType,
        startTime: planned.startTime,
        endTime: planned.endTime,
        scheduledMinutes: planned.scheduledMinutes,
        entryStatus: entry?.entry_status ?? null,
        effectiveStatus,
        statusLabel: statusLabel(effectiveStatus),
        entryMinutes: entry?.minutes != null ? Number(entry.minutes) : null,
        countedMinutes,
        includedInTotal,
        excludeReason,
        note: entry?.note ?? null,
        scheduleSlotId: planned.slot.id,
        entryId: entry?.id ?? null,
      });
    }
  }

  for (const entry of entries) {
    if (matchedEntryIds.has(entry.id)) continue;
    const countedMinutes = entry.entry_status && Number(entry.minutes) > 0
      ? Number(entry.minutes)
      : 0;
    const includedInTotal = countedMinutes > 0;
    rows.push({
      source: "manual",
      dateStr: entry.class_date,
      institutionName: entry.institutions?.name ?? "(기관 미지정)",
      payType: entry.pay_type,
      startTime: "—",
      endTime: "—",
      scheduledMinutes: null,
      entryStatus: entry.entry_status ?? null,
      effectiveStatus: entry.entry_status ?? null,
      statusLabel: statusLabel(entry.entry_status),
      entryMinutes: entry.minutes != null ? Number(entry.minutes) : null,
      countedMinutes,
      includedInTotal,
      excludeReason: includedInTotal ? null : excludeReasonFor(entry, entry.class_date),
      note: entry.note ?? null,
      scheduleSlotId: null,
      entryId: entry.id,
    });
  }

  rows.sort((a, b) => {
    const d = a.dateStr.localeCompare(b.dateStr);
    if (d !== 0) return d;
    if (a.startTime === "—") return 1;
    if (b.startTime === "—") return -1;
    return a.startTime.localeCompare(b.startTime);
  });

  const byTypeIncluded = groupPayrollByTypeConfirmed(entries);
  const byTypePlannedSchedule = emptyByType();
  const byTypeExcludedFromSchedule = emptyByType();

  for (const r of rows) {
    if (r.source !== "schedule") continue;
    byTypePlannedSchedule[r.payType] = (byTypePlannedSchedule[r.payType] || 0) + r.scheduledMinutes;
    if (!r.includedInTotal) {
      const lost = r.entryMinutes != null && r.entryStatus === ENTRY_STATUS.custom
        ? r.scheduledMinutes - r.countedMinutes
        : r.scheduledMinutes;
      byTypeExcludedFromSchedule[r.payType] = (byTypeExcludedFromSchedule[r.payType] || 0) + lost;
    }
  }

  const regularTotal = byTypeIncluded.정규 || 0;
  const afterSchoolTotal = byTypeIncluded.방과후 || 0;
  const totalIncluded = Object.values(byTypeIncluded).reduce((s, n) => s + n, 0);

  const excludedScheduleRows = rows.filter(r => r.source === "schedule" && !r.includedInTotal);
  const excludedByReason = {};
  for (const r of excludedScheduleRows) {
    const reason = r.excludeReason || "기타";
    if (!excludedByReason[reason]) excludedByReason[reason] = { count: 0, minutes: 0 };
    excludedByReason[reason].count++;
    excludedByReason[reason].minutes += r.scheduledMinutes;
  }

  return {
    rows,
    weeklyPattern: summarizeWeeklyPattern(weeklySlots),
    summary: {
      aggregationRule: "entry_status가 있고 minutes > 0 인 항목만 합산",
      byTypeIncluded,
      byTypePlannedSchedule,
      byTypeExcludedFromSchedule,
      regularTotal,
      afterSchoolTotal,
      totalIncluded,
      includedSessionCount: rows.filter(r => r.includedInTotal).length,
      excludedScheduleCount: excludedScheduleRows.length,
      unconfirmedCount: excludedScheduleRows.filter(r => r.excludeReason === "미확인").length,
      skippedCount: excludedScheduleRows.filter(r => r.excludeReason === "수업 안 함").length,
      excludedByReason,
      grandTotalFormula: [
        regularTotal > 0 ? `정규 ${regularTotal}분` : null,
        afterSchoolTotal > 0 ? `방과후 ${afterSchoolTotal}분` : null,
        ...PAY_TYPES.filter(t => t !== "정규" && t !== "방과후" && (byTypeIncluded[t] || 0) > 0)
          .map(t => `${t} ${byTypeIncluded[t]}분`),
      ].filter(Boolean).join(" + ") + ` = ${totalIncluded}분`,
    },
    calculationSteps: buildTypeCalculationSteps(rows, byTypeIncluded),
  };
}
