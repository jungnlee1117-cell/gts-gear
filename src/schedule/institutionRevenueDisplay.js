import { BILLING_TYPES, formatWon } from "./constants.js";
import {
  findContractForMonth,
  getInstitutionRevenueInputMode,
  getPerCapitaDraft,
  getPerSessionDrafts,
  getMonthlyContractDraft,
  isMonthlyFixedBilling,
  PER_CAPITA_SESSION_TYPE,
  previousYearMonth,
  resolveInstitutionBillingType,
} from "./monthlyBilling.js";
import {
  computePerCapitaRevenue,
  computePerSessionRevenue,
  pickSessionRate,
} from "./settlement.js";

function formatRateWon(n) {
  return `${Math.round(Number(n) || 0).toLocaleString("ko-KR")}원`;
}

function instCountsFor(institutionId, sessionCounts) {
  return (sessionCounts || []).filter(c => c.institution_id === institutionId);
}

/** 과금 컬럼 — billing_type 라벨 */
export function formatInstitutionBillingLabel(institution, sessionRates = [], sessionCounts = []) {
  const type = resolveInstitutionBillingType(institution, sessionRates, sessionCounts);
  return BILLING_TYPES[type] || type;
}

/** 매출 컬럼 — 계산된 금액 (과금 유형명은 포함하지 않음) */
export function formatInstitutionRevenueLabel({
  institution,
  contracts,
  sessionCounts = [],
  sessionRates = [],
  yearMonth,
}) {
  const mode = getInstitutionRevenueInputMode(institution, sessionRates, sessionCounts);

  if (mode === "partner") return "—";

  if (mode === "per_capita") {
    const asOf = `${yearMonth}-28`;
    const instCounts = instCountsFor(institution.id, sessionCounts);
    const instRates = sessionRates.filter(r => r.institution_id === institution.id);
    const row = instCounts.find(c => c.session_type === PER_CAPITA_SESSION_TYPE);
    if (row) {
      const count = Number(row.session_count) || 0;
      const rate = pickSessionRate(instRates, PER_CAPITA_SESSION_TYPE, asOf);
      const total = computePerCapitaRevenue(instCounts, instRates, asOf);
      return `${formatRateWon(rate)}×${count}명=${formatWon(total)}`;
    }
    const prevYm = previousYearMonth(yearMonth);
    const hasPrev = (sessionCounts || []).some(c =>
      c.institution_id === institution.id
      && c.session_type === PER_CAPITA_SESSION_TYPE
      && c.year_month?.slice(0, 7) === prevYm,
    );
    if (hasPrev) return "미입력 (직전달 있음)";
    return "미입력";
  }

  if (mode === "per_session") {
    const asOf = `${yearMonth}-28`;
    const instCounts = instCountsFor(institution.id, sessionCounts)
      .filter(c => c.session_type !== PER_CAPITA_SESSION_TYPE);
    const instRates = sessionRates.filter(r => r.institution_id === institution.id);
    const parts = [];
    let total = 0;

    for (const row of instCounts) {
      const count = Number(row.session_count) || 0;
      if (count <= 0) continue;
      const rate = pickSessionRate(instRates, row.session_type, asOf);
      const subtotal = Math.round(count * rate);
      total += subtotal;
      parts.push({
        sessionType: row.session_type,
        text: `${formatRateWon(rate)}×${count}회`,
        subtotal,
      });
    }

    if (parts.length > 0) {
      if (parts.length === 1 && !parts[0].sessionType.includes(" ")) {
        return `${parts[0].text}=${formatWon(total)}`;
      }
      const detail = parts.map(p => (
        p.sessionType ? `${p.sessionType} ${p.text}` : p.text
      )).join(" + ");
      return `${detail}=${formatWon(total)}`;
    }
    return "미입력";
  }

  if (isMonthlyFixedBilling(institution)) {
    const current = findContractForMonth(contracts, yearMonth, institution.id);
    if (current) {
      return formatWon(current.contract_amount);
    }
    const prev = findContractForMonth(contracts, previousYearMonth(yearMonth), institution.id);
    if (prev) return "미입력 (직전달 있음)";
    return "미입력";
  }

  return "—";
}

export function isInstitutionRevenuePending({
  institution,
  contracts,
  sessionCounts = [],
  sessionRates = [],
  yearMonth,
}) {
  const mode = getInstitutionRevenueInputMode(institution, sessionRates, sessionCounts);
  if (mode === "partner") return false;

  if (mode === "contract" && isMonthlyFixedBilling(institution)) {
    return !findContractForMonth(contracts, yearMonth, institution.id);
  }

  if (mode === "per_session") {
    const instCounts = instCountsFor(institution.id, sessionCounts)
      .filter(c => c.session_type !== PER_CAPITA_SESSION_TYPE);
    return instCounts.length === 0;
  }

  if (mode === "per_capita") {
    const instCounts = instCountsFor(institution.id, sessionCounts);
    return !instCounts.some(c => c.session_type === PER_CAPITA_SESSION_TYPE);
  }

  return false;
}

export function canEditInstitutionRevenue(institution, sessionRates = [], sessionCounts = []) {
  return getInstitutionRevenueInputMode(institution, sessionRates, sessionCounts) !== "partner";
}

/** 수정 모달 초기 draft */
export function buildInstitutionRevenueEditDraft({
  institution,
  contracts,
  sessionCounts,
  prevSessionCounts,
  sessionRates,
  yearMonth,
}) {
  const mode = getInstitutionRevenueInputMode(institution, sessionRates, sessionCounts);

  if (mode === "per_session") {
    return {
      mode: "per_session",
      ...getPerSessionDrafts({
        institutionId: institution.id,
        sessionRates,
        sessionCounts,
        prevSessionCounts,
      }),
    };
  }

  if (mode === "per_capita") {
    return {
      mode: "per_capita",
      ...getPerCapitaDraft({
        institutionId: institution.id,
        sessionRates,
        sessionCounts,
        prevSessionCounts,
      }),
    };
  }

  const draft = getMonthlyContractDraft(contracts, yearMonth, institution.id);
  return {
    mode: "contract",
    amount: draft.source !== "empty" ? String(draft.amount ?? 0) : "",
    existingId: draft.contract?.id ?? null,
    source: draft.source,
    previousYearMonth: draft.previousYearMonth,
  };
}

export function previewPerSessionRevenueFromDraft(draft, institutionId, sessionRates, yearMonth) {
  if (draft?.mode !== "per_session") return 0;
  const asOf = `${yearMonth}-28`;
  const rows = (draft.sessionTypes || []).map(type => ({
    session_type: type,
    session_count: Number(draft.sessions?.[type]) || 0,
  }));
  return computePerSessionRevenue(
    rows,
    sessionRates.filter(r => r.institution_id === institutionId),
    asOf,
  );
}

export function previewPerCapitaRevenueFromDraft(draft, institutionId, sessionRates, yearMonth) {
  if (draft?.mode !== "per_capita") return 0;
  const asOf = `${yearMonth}-28`;
  const count = Number(draft.headcount) || 0;
  const rates = sessionRates.filter(r => r.institution_id === institutionId);
  return computePerCapitaRevenue(
    [{ session_type: PER_CAPITA_SESSION_TYPE, session_count: count }],
    rates,
    asOf,
  );
}
