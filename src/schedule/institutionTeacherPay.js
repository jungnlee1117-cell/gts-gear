import { estimateTeacherPayByEntry } from "./settlement.js";
import { computeTemporaryInstructorCostForInstitution, engagementOverlapsMonth, resolveEngagementBillableItems } from "./temporaryTeachers.js";

function matchInstitutionName(name, pattern) {
  if (!name || !pattern) return false;
  if (pattern instanceof RegExp) return pattern.test(name);
  return String(name).includes(pattern);
}

function teacherByName(teachers, name) {
  return (teachers || []).find(t => t.name === name) ?? null;
}

function entriesForTeacher(entries, teacherId) {
  return (entries || []).filter(e => e.teacher_id === teacherId);
}

/** additional_payments → 기관별 breakdown 매핑 (reason + 기관명 패턴) */
export const INSTITUTION_ADDITIONAL_PAYMENT_RULES = [
  {
    institutionPattern: /수지폴리\s*본관/,
    teacherName: "김종현",
    reasonPattern: /추가금액|수지폴리/,
    label: "추가금액",
  },
  {
    institutionPattern: /프랜시스파커/,
    teacherName: "윤한경",
    reasonPattern: /프랜시스파커/,
    label: "추가수당",
  },
  {
    institutionPattern: /관악\s*slp/i,
    teacherName: "윤한경",
    reasonPattern: /관악/i,
    label: "추가수당",
  },
];

/** 원별 강사료 — 고정급 */
export const INSTITUTION_INSTRUCTOR_RULES = [
  {
    institutionPattern: /광교폴리/,
    teacherName: "오주영",
    mode: "fixed_monthly",
    amount: 2600000,
    label: "고정 계약급",
  },
];

export const LITTLE_INSTITUTION_PATTERN = /리틀/;
export const LITTLE_SUPPLEMENTARY_TEACHER = "공성주";

/** 원별 담당자 몫 고정 조정 (성동ECC 등) */
export const INSTITUTION_MANAGER_SHARE_ADJUSTMENTS = [
  {
    institutionPattern: /성동\s*ecc/i,
    amount: -112000,
  },
];

export function institutionManagerShareAdjustment(institution) {
  const rule = INSTITUTION_MANAGER_SHARE_ADJUSTMENTS.find(r =>
    matchInstitutionName(institution?.name, r.institutionPattern),
  );
  return rule ? Math.round(Number(rule.amount) || 0) : 0;
}

export function applyManagerShareAdjustments(institution, calc) {
  const adj = institutionManagerShareAdjustment(institution);
  if (!adj) return calc;
  return {
    ...calc,
    manager_share: Math.round((Number(calc.manager_share) || 0) + adj),
  };
}

export function findInstitutionInstructorRules(institution) {
  return INSTITUTION_INSTRUCTOR_RULES.filter(r =>
    matchInstitutionName(institution?.name, r.institutionPattern),
  );
}

export function formatInstitutionTeacherAdditionalAllowances(allowances) {
  return (allowances || []).map(a =>
    `${a.teacherName} ${a.reason} ${Number(a.amount).toLocaleString("ko-KR")}원`,
  );
}

export function sumInstitutionCodedAdditionalAllowances(allowances) {
  return (allowances || []).reduce((s, a) => s + Number(a.amount || 0), 0);
}

export function sumMergedAdditionalPayments(payments) {
  return (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
}

function paymentMatchesInstitutionRule(payment, rule, teacherId) {
  if (!payment || payment.teacher_id !== teacherId) return false;
  const reason = String(payment.reason || "");
  return rule.reasonPattern.test(reason);
}

/** 원·강사·사유 규칙에 맞는 additional_payments → breakdown 항목 */
export function resolveInstitutionAdditionalAllowances({
  institution,
  teachers,
  additionalPayments,
}) {
  const breakdown = [];
  const matchedPaymentIds = new Set();

  for (const rule of INSTITUTION_ADDITIONAL_PAYMENT_RULES) {
    if (!matchInstitutionName(institution?.name, rule.institutionPattern)) continue;
    const teacher = teacherByName(teachers, rule.teacherName);
    if (!teacher) continue;

    for (const payment of additionalPayments || []) {
      if (matchedPaymentIds.has(payment.id)) continue;
      if (!paymentMatchesInstitutionRule(payment, rule, teacher.id)) continue;
      matchedPaymentIds.add(payment.id);
      breakdown.push({
        teacherName: rule.teacherName,
        label: payment.reason || rule.label,
        amount: Math.round(Number(payment.amount) || 0),
        kind: "allowance",
        superAdminOnly: false,
        paymentId: payment.id,
      });
    }
  }

  return breakdown;
}

export function supplementaryInstructorPayAtInstitution({
  institution,
  entries,
  rates,
  teachers,
}) {
  if (!matchInstitutionName(institution?.name, LITTLE_INSTITUTION_PATTERN)) return 0;
  if (institution?.contract_type !== "manager_fixed_payout") return 0;

  const teacher = teacherByName(teachers, LITTLE_SUPPLEMENTARY_TEACHER);
  if (!teacher) return 0;

  const instEntries = entriesForTeacher(
    (entries || []).filter(e => e.institution_id === institution.id),
    teacher.id,
  );
  return estimateTeacherPayByEntry(instEntries, rates);
}

/**
 * 원별 강사료 차감 합계 + 표시용 breakdown
 */
export function computeInstitutionInstructorCost({
  institution,
  entries,
  rates,
  teachers,
  yearMonth,
  additionalPayments = [],
  temporaryEngagements = [],
  weeklySlots = [],
  scheduleExceptions = [],
}) {
  const instEntries = (entries || []).filter(e => e.institution_id === institution.id);

  const tempEngagementsAtInst = yearMonth
    ? (temporaryEngagements || []).filter(e =>
      e.institution_id === institution.id
      && e.is_active !== false
      && engagementOverlapsMonth(e, yearMonth),
    )
    : [];

  const tempEntryKeys = new Set();
  for (const eng of tempEngagementsAtInst) {
    const { items } = resolveEngagementBillableItems({
      engagement: eng,
      yearMonth,
      entries: instEntries,
      weeklySlots,
      exceptions: scheduleExceptions,
    });
    for (const e of items) {
      if (!e._fromSchedule) {
        tempEntryKeys.add(`${e.teacher_id}|${e.class_date}|${e.pay_type}|${e.minutes}`);
      }
    }
  }
  const sessionEntries = tempEntryKeys.size
    ? instEntries.filter(e =>
      !tempEntryKeys.has(`${e.teacher_id}|${e.class_date}|${e.pay_type}|${e.minutes}`),
    )
    : instEntries;

  let sessionPay = institution?.contract_type === "manager_personal"
    ? 0
    : estimateTeacherPayByEntry(sessionEntries, rates);

  const breakdown = [];
  const rules = findInstitutionInstructorRules(institution);

  for (const rule of rules) {
    const teacher = teacherByName(teachers, rule.teacherName);
    if (!teacher) continue;

    if (rule.mode === "fixed_monthly") {
      const teacherEntries = entriesForTeacher(instEntries, teacher.id);
      const entryPay = estimateTeacherPayByEntry(teacherEntries, rates);
      sessionPay = Math.max(0, sessionPay - entryPay);
      breakdown.push({
        teacherName: rule.teacherName,
        label: rule.label,
        amount: rule.amount,
        kind: "fixed",
        superAdminOnly: false,
      });
    }
  }

  const fixedPayout = institution?.contract_type === "manager_fixed_payout"
    ? Number(institution.fixed_payout_amount) || 0
    : 0;

  const supplementaryPay = supplementaryInstructorPayAtInstitution({
    institution,
    entries,
    rates,
    teachers,
  });

  if (supplementaryPay > 0) {
    sessionPay = Math.max(0, sessionPay - supplementaryPay);
    breakdown.push({
      teacherName: LITTLE_SUPPLEMENTARY_TEACHER,
      label: "수업료 (횟수×단가)",
      amount: supplementaryPay,
      kind: "session",
      superAdminOnly: true,
    });
  }

  if (fixedPayout > 0) {
    breakdown.push({
      teacherName: "오정석",
      label: "고정 지급",
      amount: fixedPayout,
      kind: "fixed_payout",
      superAdminOnly: false,
    });
  }

  const allowanceBreakdown = resolveInstitutionAdditionalAllowances({
    institution,
    teachers,
    additionalPayments,
  });
  breakdown.push(...allowanceBreakdown);
  const allowanceTotal = allowanceBreakdown.reduce((s, b) => s + b.amount, 0);

  const temporaryCost = yearMonth
    ? computeTemporaryInstructorCostForInstitution({
      institution,
      entries,
      engagements: temporaryEngagements,
      teachers,
      yearMonth,
      rates,
      weeklySlots,
      scheduleExceptions,
    })
    : { total: 0, breakdown: [] };
  breakdown.push(...temporaryCost.breakdown);

  const ruleFixed = breakdown
    .filter(b => b.kind === "fixed")
    .reduce((s, b) => s + b.amount, 0);
  const ruleBonus = breakdown
    .filter(b => b.kind === "bonus")
    .reduce((s, b) => s + b.amount, 0);

  const total = sessionPay + ruleFixed + ruleBonus + fixedPayout + supplementaryPay
    + allowanceTotal + temporaryCost.total;

  return {
    total: Math.round(total),
    sessionPay: Math.round(sessionPay),
    fixedPayout,
    supplementaryPay: Math.round(supplementaryPay),
    breakdown,
  };
}

export function formatInstructorCostBreakdown(breakdown, { superAdmin = false } = {}) {
  const lines = (breakdown || [])
    .filter(b => superAdmin || !b.superAdminOnly)
    .map(b => b.displayLine ?? `${b.teacherName} ${b.label} ${Number(b.amount).toLocaleString("ko-KR")}원`);
  return lines;
}

/** 지역 관리자 대시보드 — 담당 원·추가수당 연관 강사 포함 */
export function expandScopedTeacherRows({
  teacherRows,
  institutionIds,
  entries,
  additionalPayments,
  institutions,
}) {
  const idSet = institutionIds ?? new Set();
  const base = (teacherRows || []).filter(row => {
    const tid = row.teacher.id;
    return (entries || []).some(e =>
      e.teacher_id === tid && e.institution_id && idSet.has(e.institution_id),
    );
  });
  const seen = new Set(base.map(r => r.teacher.id));
  const extras = [];

  for (const row of teacherRows || []) {
    if (seen.has(row.teacher.id)) continue;
    const hasDbAdditional = (additionalPayments || []).some(
      p => p.teacher_id === row.teacher.id,
    );
    if (hasDbAdditional) extras.push(row);
  }

  return [...base, ...extras];
}

export function filterAdditionalPaymentsForScope(payments, scopedTeacherIds) {
  const ids = scopedTeacherIds ?? new Set();
  return (payments || []).filter(p => ids.has(p.teacher_id));
}

/** 지역 관리자 — 강사별 추가수당 (additional_payments는 teacher_id 기준만) */
export function filterTeacherAdditionalForScope(payments) {
  return payments || [];
}

export function sumScopedAdditionalPayments(payments) {
  return (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
}
