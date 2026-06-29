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

/** 원별 강사료 — 고정급·추가금 */
export const INSTITUTION_INSTRUCTOR_RULES = [
  {
    institutionPattern: /광교폴리/,
    teacherName: "오주영",
    mode: "fixed_monthly",
    amount: 2600000,
    label: "고정 계약급",
  },
  {
    institutionPattern: /수지폴리\s*본관/,
    teacherName: "김종현",
    mode: "monthly_bonus",
    amount: 100000,
    label: "추가금액",
  },
];

/** 강사 월 추가수당 — 기관별 분리 표시 (윤한경) */
export const TEACHER_INSTITUTION_ADDITIONAL = [
  {
    teacherName: "윤한경",
    items: [
      {
        institutionPattern: /프랜시스/,
        amount: 50000,
        reason: "프랜시스파커 추가수당",
        managerName: "양의인",
      },
      {
        institutionPattern: /관악/,
        amount: 50000,
        reason: "관악SLP 추가수당",
        managerName: "오정석",
      },
    ],
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

export function findCodedTeacherAdditional(teacherName) {
  return TEACHER_INSTITUTION_ADDITIONAL.find(t => t.teacherName === teacherName) ?? null;
}

/** 원별 강사 추가수당 (정산 차감 아님 · 화면 표시용) */
export function institutionCodedAdditionalAllowances(institution) {
  const items = [];
  for (const config of TEACHER_INSTITUTION_ADDITIONAL) {
    for (const item of config.items) {
      if (!matchInstitutionName(institution?.name, item.institutionPattern)) continue;
      items.push({
        teacherName: config.teacherName,
        reason: item.reason,
        amount: item.amount,
      });
    }
  }
  return items;
}

export function formatInstitutionTeacherAdditionalAllowances(allowances) {
  return (allowances || []).map(a =>
    `${a.teacherName} ${a.reason} ${Number(a.amount).toLocaleString("ko-KR")}원`,
  );
}

export function sumInstitutionCodedAdditionalAllowances(allowances) {
  return (allowances || []).reduce((s, a) => s + Number(a.amount || 0), 0);
}

/** 월 1회만 합산되는 강사 보너스 (수지폴리 본관·김종현 등) */
export function monthlyTeacherBonusAmount(teacherName, institutions = null, managedInstitutionIds = null) {
  const rules = INSTITUTION_INSTRUCTOR_RULES.filter(
    r => r.mode === "monthly_bonus" && r.teacherName === teacherName,
  );
  if (!rules.length) return 0;
  if (!institutions || !managedInstitutionIds?.size) {
    return rules.reduce((s, r) => s + r.amount, 0);
  }
  return rules.reduce((sum, rule) => {
    const applies = institutions.some(inst =>
      managedInstitutionIds.has(inst.id)
      && matchInstitutionName(inst.name, rule.institutionPattern),
    );
    return applies ? sum + rule.amount : sum;
  }, 0);
}

export function monthlyTeacherBonusDisplayItems(teacherName, institutions = null, managedInstitutionIds = null) {
  return INSTITUTION_INSTRUCTOR_RULES.filter(
    r => r.mode === "monthly_bonus" && r.teacherName === teacherName,
  ).filter(r => {
    if (!institutions || !managedInstitutionIds?.size) return true;
    return institutions.some(inst =>
      managedInstitutionIds.has(inst.id)
      && matchInstitutionName(inst.name, r.institutionPattern),
    );
  }).map((r, idx) => ({
    id: `monthly-bonus-${teacherName}-${idx}`,
    reason: r.label,
    amount: r.amount,
    coded: true,
  }));
}

/**
 * DB additional_payments + 기관별 코딩 수당 병합 (중복 합산 방지)
 * 윤한경: DB에 통합 10만이 있어도 화면에는 5만+5만으로 표시
 */
export function mergeTeacherAdditionalPayments(teacherName, dbPayments = [], teacherId = null) {
  const coded = findCodedTeacherAdditional(teacherName);
  if (!coded) return dbPayments || [];

  const codedItems = coded.items.map((item, idx) => ({
    id: `coded-additional-${teacherName}-${idx}`,
    teacher_id: teacherId || dbPayments[0]?.teacher_id,
    amount: item.amount,
    reason: item.reason,
    institutionPattern: item.institutionPattern,
    managerName: item.managerName,
    coded: true,
  }));

  const codedTotal = codedItems.reduce((s, p) => s + Number(p.amount || 0), 0);
  const dbTotal = (dbPayments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

  if (dbTotal >= codedTotal && dbTotal > 0) {
    return codedItems.map((item, idx) => ({
      ...item,
      teacher_id: teacherId || dbPayments[0]?.teacher_id,
      id: dbPayments[idx]?.id ?? item.id,
    }));
  }

  if (!dbPayments?.length) return codedItems;
  if (dbTotal > 0 && dbTotal < codedTotal) {
    return codedItems.map(item => ({
      ...item,
      teacher_id: teacherId || dbPayments[0]?.teacher_id,
    }));
  }
  return [...dbPayments, ...codedItems];
}

export function sumMergedAdditionalPayments(mergedPayments) {
  const coded = (mergedPayments || []).filter(p => p.coded);
  if (coded.length) {
    return coded.reduce((s, p) => s + Number(p.amount || 0), 0);
  }
  return (mergedPayments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
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

    if (rule.mode === "monthly_bonus") {
      breakdown.push({
        teacherName: rule.teacherName,
        label: rule.label,
        amount: rule.amount,
        kind: "bonus",
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

  const additionalAllowances = institutionCodedAdditionalAllowances(institution);
  for (const item of additionalAllowances) {
    breakdown.push({
      teacherName: item.teacherName,
      label: item.reason,
      amount: item.amount,
      kind: "teacher_additional",
      superAdminOnly: false,
    });
  }
  const allowanceTotal = sumInstitutionCodedAdditionalAllowances(additionalAllowances);

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
    const name = row.teacher.name;
    const hasDbAdditional = (additionalPayments || []).some(p => p.teacher_id === row.teacher.id);
    const coded = findCodedTeacherAdditional(name);
    const linked = coded?.items?.some(item =>
      (institutions || []).some(inst =>
        idSet.has(inst.id) && matchInstitutionName(inst.name, item.institutionPattern),
      ),
    );
    if (hasDbAdditional || linked) extras.push(row);
  }

  return [...base, ...extras];
}

export function filterAdditionalPaymentsForScope(payments, scopedTeacherIds) {
  const ids = scopedTeacherIds ?? new Set();
  return (payments || []).filter(p => ids.has(p.teacher_id));
}

/** 지역 관리자 — 담당 원에 연결된 코딩 추가수당만 표시 */
export function filterTeacherAdditionalForScope(payments, institutions, managedInstitutionIds) {
  const idSet = managedInstitutionIds ?? new Set();
  return (payments || []).filter(p => {
    if (String(p.id || "").startsWith("monthly-bonus-")) {
      const match = String(p.id).match(/^monthly-bonus-(.+)-\d+$/);
      const teacherName = match?.[1] ?? "";
      return INSTITUTION_INSTRUCTOR_RULES.some(rule =>
        rule.mode === "monthly_bonus"
        && rule.teacherName === teacherName
        && (institutions || []).some(inst =>
          idSet.has(inst.id) && matchInstitutionName(inst.name, rule.institutionPattern),
        ),
      );
    }
    if (!p.coded) return true;
    if (p.institutionPattern) {
      return (institutions || []).some(inst =>
        idSet.has(inst.id) && matchInstitutionName(inst.name, p.institutionPattern),
      );
    }
    return false;
  });
}

export function sumScopedAdditionalPayments(payments) {
  const coded = (payments || []).filter(p => p.coded);
  if (coded.length) {
    return coded.reduce((s, p) => s + Number(p.amount || 0), 0);
  }
  return (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
}
