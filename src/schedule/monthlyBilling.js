import { yearMonthFirstDay } from "./constants.js";

/** institution_session_rates / institution_monthly_session_counts 공통 키 */
export const PER_CAPITA_SESSION_TYPE = "인당";

/** YYYY-MM → 직전 달 YYYY-MM */
export function previousYearMonth(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

export function isMonthlyFixedBilling(institution) {
  return institution?.billing_type === "monthly_fixed"
    && institution?.contract_type !== "partner_billing";
}

export function findContractForMonth(contracts, yearMonth, institutionId = null) {
  return contracts.find(c => {
    if (institutionId && c.institution_id !== institutionId) return false;
    return c.year_month?.slice(0, 7) === yearMonth;
  }) ?? null;
}

/** 현재 월 계약 없으면 직전 달 금액을 기본값으로 */
export function getMonthlyContractDraft(contracts, yearMonth, institutionId) {
  const current = findContractForMonth(contracts, yearMonth, institutionId);
  if (current) {
    return {
      contract: current,
      amount: Number(current.contract_amount ?? 0),
      studentCount: current.student_count ?? "",
      externalInstructorCost: Number(current.external_instructor_cost ?? 0),
      source: "saved",
    };
  }
  const prevYm = previousYearMonth(yearMonth);
  const prev = findContractForMonth(contracts, prevYm, institutionId);
  if (prev) {
    return {
      contract: null,
      amount: Number(prev.contract_amount) || 0,
      studentCount: prev.student_count ?? "",
      externalInstructorCost: Number(prev.external_instructor_cost ?? 0),
      source: "previous_month",
      previousYearMonth: prevYm,
    };
  }
  return {
    contract: null,
    amount: 0,
    studentCount: "",
    externalInstructorCost: 0,
    source: "empty",
  };
}

/** 일괄 적용 대상: monthly_fixed + 이번 달 미입력 + 직전 달 있음 */
export function listBulkPrefillTargets(institutions, contracts, yearMonth) {
  const prevYm = previousYearMonth(yearMonth);
  return institutions
    .filter(isMonthlyFixedBilling)
    .filter(inst => !findContractForMonth(contracts, yearMonth, inst.id))
    .map(inst => {
      const prev = findContractForMonth(contracts, prevYm, inst.id);
      if (!prev || prev.contract_amount == null) return null;
      return {
        institution: inst,
        prevContract: prev,
        amount: Number(prev.contract_amount ?? 0),
        studentCount: prev.student_count ?? null,
      };
    })
    .filter(Boolean);
}

export function buildMonthlyContractPayload({
  institutionId,
  yearMonth,
  amount,
  studentCount,
  externalInstructorCost,
  existingId,
}) {
  const payload = {
    institution_id: institutionId,
    year_month: yearMonthFirstDay(yearMonth),
    contract_amount: Number(String(amount).replace(/,/g, "")) || 0,
    student_count: studentCount === "" || studentCount == null
      ? null
      : Number(studentCount),
    external_instructor_cost: Number(String(externalInstructorCost ?? "").replace(/,/g, "")) || 0,
  };
  if (existingId) payload.id = existingId;
  return payload;
}

export function isPerCapitaBilling(institution, sessionRates = [], sessionCounts = []) {
  if (institution?.contract_type === "partner_billing") return false;
  if (institution?.billing_type === "per_capita") return true;
  if ((sessionRates || []).some(
    r => r.institution_id === institution?.id && r.session_type === PER_CAPITA_SESSION_TYPE,
  )) return true;
  return (sessionCounts || []).some(
    c => c.institution_id === institution?.id && c.session_type === PER_CAPITA_SESSION_TYPE,
  );
}

/** 화면 표시용 과금 유형 (DB billing_type + 인당 단가/인원 데이터 반영) */
export function resolveInstitutionBillingType(institution, sessionRates = [], sessionCounts = []) {
  if (institution?.contract_type === "partner_billing") return "manual";
  if (isPerCapitaBilling(institution, sessionRates, sessionCounts)) return "per_capita";
  if (institution?.billing_type === "per_session") return "per_session";
  if (institution?.billing_type === "manual") return "manual";
  return institution?.billing_type || "monthly_fixed";
}

export function getInstitutionRevenueInputMode(institution, sessionRates = [], sessionCounts = []) {
  if (institution?.contract_type === "partner_billing") return "partner";
  if (isPerCapitaBilling(institution, sessionRates, sessionCounts)) return "per_capita";
  if (institution?.billing_type === "per_session") return "per_session";
  return "contract";
}

export function sessionTypesForInstitution(institutionId, sessionRates) {
  const types = new Set(
    (sessionRates || [])
      .filter(r => r.institution_id === institutionId)
      .map(r => r.session_type),
  );
  return [...types].sort();
}

/** 회당 과금 — 이번 달 저장값 없으면 직전 달 횟수를 기본값으로 */
export function getPerSessionDrafts({
  institutionId,
  sessionRates,
  sessionCounts,
  prevSessionCounts,
}) {
  const types = sessionTypesForInstitution(institutionId, sessionRates);
  const current = (sessionCounts || []).filter(c => c.institution_id === institutionId);
  const prev = (prevSessionCounts || []).filter(c => c.institution_id === institutionId);
  const sessions = {};
  const existingIds = {};
  let source = "empty";

  for (const type of types) {
    const cur = current.find(c => c.session_type === type);
    const prevRow = prev.find(c => c.session_type === type);
    if (cur) {
      sessions[type] = String(cur.session_count ?? 0);
      existingIds[type] = cur.id;
      source = "saved";
    } else if (prevRow) {
      sessions[type] = String(prevRow.session_count ?? 0);
      if (source !== "saved") source = "previous_month";
    } else {
      sessions[type] = "0";
    }
  }

  return { sessionTypes: types, sessions, existingIds, source };
}

/** 인당 과금 — 이번 달 인원수 (없으면 직전 달) */
export function getPerCapitaDraft({
  institutionId,
  sessionRates,
  sessionCounts,
  prevSessionCounts,
}) {
  const type = PER_CAPITA_SESSION_TYPE;
  const current = (sessionCounts || []).find(
    c => c.institution_id === institutionId && c.session_type === type,
  );
  const prev = (prevSessionCounts || []).find(
    c => c.institution_id === institutionId && c.session_type === type,
  );
  let headcount = "0";
  let existingId = null;
  let source = "empty";

  if (current) {
    headcount = String(current.session_count ?? 0);
    existingId = current.id;
    source = "saved";
  } else if (prev) {
    headcount = String(prev.session_count ?? 0);
    source = "previous_month";
  }

  const rateRow = (sessionRates || []).find(
    r => r.institution_id === institutionId && r.session_type === type,
  );

  return { headcount, existingId, source, rate: Number(rateRow?.rate_per_session ?? 0) };
}

export function buildBulkRevenueDrafts({
  institutions,
  contracts,
  sessionCounts,
  prevSessionCounts,
  sessionRates,
  yearMonth,
}) {
  const drafts = {};
  for (const inst of institutions) {
    const mode = getInstitutionRevenueInputMode(inst, sessionRates, sessionCounts);
    if (mode === "partner") {
      drafts[inst.id] = { mode: "partner" };
      continue;
    }
    if (mode === "per_session") {
      drafts[inst.id] = {
        mode: "per_session",
        institutionId: inst.id,
        ...getPerSessionDrafts({
          institutionId: inst.id,
          sessionRates,
          sessionCounts,
          prevSessionCounts,
        }),
      };
      continue;
    }
    if (mode === "per_capita") {
      drafts[inst.id] = {
        mode: "per_capita",
        institutionId: inst.id,
        ...getPerCapitaDraft({
          institutionId: inst.id,
          sessionRates,
          sessionCounts,
          prevSessionCounts,
        }),
      };
      continue;
    }
    const draft = getMonthlyContractDraft(contracts, yearMonth, inst.id);
    drafts[inst.id] = {
      mode: "contract",
      institutionId: inst.id,
      amount: draft.source !== "empty" ? String(draft.amount ?? 0) : "",
      existingId: draft.contract?.id ?? null,
      source: draft.source,
      previousYearMonth: draft.previousYearMonth,
    };
  }
  return drafts;
}
