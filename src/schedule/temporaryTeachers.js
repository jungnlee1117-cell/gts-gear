import { yearMonthFirstDay, yearMonthLastDay } from "./constants.js";
import { estimateTeacherPayByEntry } from "./settlement.js";
import { isScheduleSuperAdmin } from "./managerScope.js";
import { fmtLocalDate, getMonthGrid, getSlotsForDate } from "./payrollCalendar.js";

export function formatShortDateRange(start, end) {
  if (!start) return "";
  const fmt = (d) => {
    const parts = String(d).slice(0, 10).split("-");
    return `${Number(parts[1])}/${Number(parts[2])}`;
  };
  if (!end || end === start) return fmt(start);
  return `${fmt(start)}~${fmt(end)}`;
}

export function engagementOverlapsMonth(engagement, yearMonth) {
  const monthStart = yearMonthFirstDay(yearMonth);
  const monthEnd = yearMonthLastDay(yearMonth);
  const start = engagement.engagement_start_date?.slice(0, 10);
  const end = engagement.engagement_end_date?.slice(0, 10) || monthEnd;
  if (!start) return false;
  if (start <= monthEnd && end >= monthStart) return true;
  if (engagement.is_substitute && engagement.substitute_start_date) {
    const subStart = engagement.substitute_start_date.slice(0, 10);
    const subEnd = engagement.substitute_end_date?.slice(0, 10) || monthEnd;
    return subStart <= monthEnd && subEnd >= monthStart;
  }
  return false;
}

export function engagementPeriodInMonth(engagement, yearMonth) {
  const monthStart = yearMonthFirstDay(yearMonth);
  const monthEnd = yearMonthLastDay(yearMonth);
  const engStart = engagement.engagement_start_date?.slice(0, 10) || monthStart;
  const engEnd = engagement.engagement_end_date?.slice(0, 10) || monthEnd;
  const start = engStart > monthStart ? engStart : monthStart;
  const end = engEnd < monthEnd ? engEnd : monthEnd;
  return { start, end };
}

/** 대체 근무 시 대체 기간, 아니면 근무 기간 */
export function payrollPeriodInMonth(engagement, yearMonth) {
  if (engagement.is_substitute && engagement.substitute_start_date) {
    const monthStart = yearMonthFirstDay(yearMonth);
    const monthEnd = yearMonthLastDay(yearMonth);
    const subStart = engagement.substitute_start_date.slice(0, 10);
    const subEnd = engagement.substitute_end_date?.slice(0, 10) || monthEnd;
    const start = subStart > monthStart ? subStart : monthStart;
    const end = subEnd < monthEnd ? subEnd : monthEnd;
    return { start, end };
  }
  return engagementPeriodInMonth(engagement, yearMonth);
}

/** 대체 대상 선생님의 수업 입력(payroll)을 기준으로 횟수·시간 산정 */
export function entriesForEngagement(entries, engagement, yearMonth) {
  const { start, end } = payrollPeriodInMonth(engagement, yearMonth);
  const sourceTeacherId = engagement.is_substitute ? engagement.substitute_teacher_id : null;

  if (sourceTeacherId) {
    return (entries || []).filter(e =>
      e.teacher_id === sourceTeacherId
      && e.institution_id === engagement.institution_id
      && e.class_date >= start
      && e.class_date <= end
      && Number(e.minutes) > 0
      && (!engagement.pay_type || e.pay_type === engagement.pay_type),
    );
  }

  return [];
}

/** 대체 대상 선생님 주간 스케줄 → 해당 기간 예정 수업 (payroll 미입력 시 fallback) */
export function plannedSessionsForEngagement({
  engagement,
  yearMonth,
  weeklySlots = [],
  exceptions = [],
}) {
  const sourceTeacherId = engagement.is_substitute ? engagement.substitute_teacher_id : null;
  if (!sourceTeacherId) return [];

  const { start, end } = payrollPeriodInMonth(engagement, yearMonth);
  const teacherInstSlots = (weeklySlots || []).filter(s =>
    s.teacher_id === sourceTeacherId
    && s.institution_id === engagement.institution_id,
  );
  if (!teacherInstSlots.length) return [];

  const [y, m] = yearMonth.split("-").map(Number);
  const grid = getMonthGrid(y, m - 1);
  const planned = [];

  for (const { date, inMonth } of grid) {
    if (!inMonth) continue;
    const dateStr = fmtLocalDate(date);
    if (dateStr < start || dateStr > end) continue;

    const daySlots = getSlotsForDate(teacherInstSlots, date, exceptions);
    for (const p of daySlots) {
      if (engagement.pay_type && p.payType !== engagement.pay_type) continue;
      planned.push({
        teacher_id: sourceTeacherId,
        institution_id: engagement.institution_id,
        class_date: dateStr,
        pay_type: p.payType,
        minutes: Number(p.scheduledMinutes) || 0,
        schedule_slot_id: p.slot?.id ?? null,
        _fromSchedule: true,
      });
    }
  }

  if (planned.length === 0 && engagement.pay_type) {
    for (const { date, inMonth } of grid) {
      if (!inMonth) continue;
      const dateStr = fmtLocalDate(date);
      if (dateStr < start || dateStr > end) continue;
      const daySlots = getSlotsForDate(teacherInstSlots, date, exceptions);
      for (const p of daySlots) {
        planned.push({
          teacher_id: sourceTeacherId,
          institution_id: engagement.institution_id,
          class_date: dateStr,
          pay_type: p.payType,
          minutes: Number(p.scheduledMinutes) || 0,
          schedule_slot_id: p.slot?.id ?? null,
          _fromSchedule: true,
        });
      }
    }
  }

  return planned.filter(p => p.minutes > 0);
}

export function resolveEngagementBillableItems({
  engagement,
  yearMonth,
  entries,
  weeklySlots = [],
  exceptions = [],
}) {
  const fromEntries = entriesForEngagement(entries, engagement, yearMonth);
  if (fromEntries.length > 0) {
    return { items: fromEntries, source: "payroll" };
  }
  const fromSchedule = plannedSessionsForEngagement({
    engagement,
    yearMonth,
    weeklySlots,
    exceptions,
  });
  if (fromSchedule.length > 0) {
    return { items: fromSchedule, source: "schedule" };
  }
  return { items: [], source: "none" };
}

export function billableItemKey(item) {
  return `${item.teacher_id}|${item.class_date}|${item.pay_type}|${item.minutes}|${item.schedule_slot_id ?? ""}`;
}

export const TEMP_TEACHER_PAY_MODE_LABELS = {
  hourly: "시급",
  daily: "일급",
  fixed_total: "총금액",
  per_session: "회당 (구)",
};

export function computeTempTeacherPay(engagement, legacyContext = null) {
  const mode = engagement.pay_mode;
  const rate = Number(engagement.rate_amount) || 0;

  if (mode === "fixed_total") return Math.round(rate);

  if (mode === "daily") {
    return Math.round(rate * (Number(engagement.work_days) || 0));
  }

  if (mode === "hourly") {
    return Math.round(rate * (Number(engagement.work_hours) || 0));
  }

  if (mode === "per_session" && legacyContext) {
    const items = legacyContext.items || [];
    const manual = Number(engagement.manual_session_count);
    const sessionCount = items.length > 0
      ? items.length
      : (Number.isFinite(manual) && manual > 0 ? manual : 0);
    return Math.round(sessionCount * rate);
  }

  return 0;
}

export function formatTempTeacherPaySummary(engagement) {
  const mode = engagement.pay_mode;
  const rate = Number(engagement.rate_amount) || 0;
  const total = computeTempTeacherPay(engagement);

  if (mode === "fixed_total") {
    return { label: `총금액 ${total.toLocaleString("ko-KR")}원`, total };
  }
  if (mode === "daily") {
    const days = Number(engagement.work_days) || 0;
    return { label: `일급 ${rate.toLocaleString("ko-KR")}원 × ${days}일`, total };
  }
  if (mode === "hourly") {
    const hours = Number(engagement.work_hours) || 0;
    return { label: `시급 ${rate.toLocaleString("ko-KR")}원 × ${hours}시간`, total };
  }
  if (mode === "per_session") {
    return { label: `회당 ${rate.toLocaleString("ko-KR")}원 (구)`, total };
  }
  return { label: "—", total: 0 };
}

export function formatTempTeacherPayFormula(engagement) {
  const summary = formatTempTeacherPaySummary(engagement);
  if (engagement.pay_mode === "fixed_total") {
    return `총금액 ${Number(engagement.rate_amount || 0).toLocaleString("ko-KR")}원`;
  }
  return `${summary.label} = ${summary.total.toLocaleString("ko-KR")}원`;
}

export function isTempTeacherPayInputMissing(engagement) {
  const mode = engagement.pay_mode;
  if (mode === "fixed_total") return !(Number(engagement.rate_amount) > 0);
  if (mode === "daily") {
    return !(Number(engagement.rate_amount) > 0 && Number(engagement.work_days) > 0);
  }
  if (mode === "hourly") {
    return !(Number(engagement.rate_amount) > 0 && Number(engagement.work_hours) > 0);
  }
  return false;
}

export function formatTemporaryTeacherSettlementLabel(engagement, institution, teachers) {
  const instName = institution?.name ?? "";
  const tempName = engagement.name ?? "—";
  if (engagement.is_substitute && engagement.substitute_teacher_id) {
    const sub = (teachers || []).find(t => t.id === engagement.substitute_teacher_id);
    const range = formatShortDateRange(
      engagement.substitute_start_date,
      engagement.substitute_end_date,
    );
    return `${instName} - ${sub?.name ?? "—"} 선생님 대체(${range}) - ${tempName} 선생님`;
  }
  return `${instName} - ${tempName} 선생님 (임시)`;
}

export function computeEngagementPayAmount(engagement, entries = [], rates = null) {
  if (engagement.pay_mode === "per_session") {
    const mine = entries || [];
    return computeTempTeacherPay(engagement, { items: mine });
  }
  if (engagement.pay_mode === "hourly" && !engagement.work_hours && (entries || []).length) {
    const ratePerMinute = Number(engagement.rate_amount) / 60;
    if (ratePerMinute > 0) {
      const syntheticRates = entries.map(e => ({
        teacher_id: e.teacher_id,
        pay_type: e.pay_type,
        rate_per_minute: ratePerMinute,
        effective_from: e.class_date,
      }));
      return estimateTeacherPayByEntry(entries, syntheticRates);
    }
  }
  return computeTempTeacherPay(engagement);
}

export function computeTemporaryInstructorCostForInstitution({
  institution,
  entries,
  engagements,
  teachers,
  yearMonth,
  rates,
  weeklySlots = [],
  scheduleExceptions = [],
}) {
  const instEngagements = (engagements || []).filter(e =>
    e.institution_id === institution.id
    && e.is_active !== false
    && engagementOverlapsMonth(e, yearMonth),
  );
  const breakdown = [];
  let total = 0;

  for (const eng of instEngagements) {
    const amount = computeEngagementPayAmount(eng);
    const line = formatTemporaryTeacherSettlementLabel(eng, institution, teachers);
    breakdown.push({
      teacherName: "",
      label: line,
      amount,
      kind: "temporary",
      displayLine: `${line} ${amount.toLocaleString("ko-KR")}원`,
      superAdminOnly: false,
    });
    total += amount;
  }

  return { total: Math.round(total), breakdown };
}

export function canEditTempTeacher(me, record) {
  if (!me?.id || !record) return false;
  if (isScheduleSuperAdmin(me)) return true;
  return record.created_by === me.id;
}

/** 급여 대시보드 — 해당 월 근무(등록·스케줄) 대상 임시 선생님 행 */
export function buildTempTeacherPayrollRows({
  engagements,
  entries,
  rates,
  institutions,
  teachers,
  yearMonth,
  weeklySlots = [],
  scheduleExceptions = [],
}) {
  const instMap = Object.fromEntries((institutions || []).map(i => [i.id, i]));
  const rows = [];

  for (const eng of engagements || []) {
    if (eng.is_active === false) continue;
    if (!engagementOverlapsMonth(eng, yearMonth)) continue;

    const amount = computeEngagementPayAmount(eng);
    const paySummary = formatTempTeacherPaySummary(eng);
    const workHours = Number(eng.work_hours) || 0;
    const workDays = Number(eng.work_days) || 0;

    const institution = instMap[eng.institution_id];
    const substituteTeacher = (teachers || []).find(t => t.id === eng.substitute_teacher_id);
    const payType = eng.pay_type || "정규";
    const byType = { 정규: 0, 방과후: 0, 가정방문: 0, 센터: 0, 센터보조: 0 };
    if (eng.pay_mode === "hourly" && workHours > 0) {
      byType[payType] = Math.round(workHours * 60);
    }

    rows.push({
      isTemporary: true,
      teacher: { id: `temp:${eng.id}`, name: eng.name },
      tempTeacher: eng,
      institution,
      institutionName: institution?.name ?? "—",
      sessionCount: workDays,
      workHours,
      workDays,
      totalMinutes: eng.pay_mode === "hourly" ? Math.round(workHours * 60) : 0,
      estimatedPay: amount,
      payMode: eng.pay_mode,
      rateAmount: Number(eng.rate_amount) || 0,
      payType,
      byType,
      paySummaryLabel: paySummary.label,
      isSubstitute: Boolean(eng.is_substitute),
      substituteTeacherName: substituteTeacher?.name ?? null,
      substitutePeriod: eng.is_substitute
        ? formatShortDateRange(eng.substitute_start_date, eng.substitute_end_date)
        : null,
      engagementPeriod: formatShortDateRange(eng.engagement_start_date, eng.engagement_end_date),
      settlementLabel: formatTemporaryTeacherSettlementLabel(eng, institution, teachers),
      inputMissing: isTempTeacherPayInputMissing(eng),
      unconfirmedDays: 0,
      additionalTotal: 0,
      additionalPayments: [],
    });
  }

  return rows.sort((a, b) => a.teacher.name.localeCompare(b.teacher.name, "ko"));
}

export function filterTempTeacherRowsForScope(rows, me, institutions) {
  if (isScheduleSuperAdmin(me)) return rows || [];
  const managedIds = new Set(
    (institutions || [])
      .filter(i => i.manager_id === me?.id)
      .map(i => i.id),
  );
  return (rows || []).filter(r => managedIds.has(r.tempTeacher?.institution_id));
}
