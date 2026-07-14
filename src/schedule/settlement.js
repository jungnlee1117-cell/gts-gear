/** 원별 월간 정산 계산 */

import { computeManagerThresholdSplitSettlement } from "./thresholdSplitSettlement.js";

/** 회당 단가 — effective_from 기준 최신 단가 */
export function pickSessionRate(rates, sessionType, asOfDate) {
  const matched = (rates || [])
    .filter(r => r.session_type === sessionType && r.effective_from <= asOfDate)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  return Number(matched[0]?.rate_per_session ?? 0);
}

/** 회당 과금 매출 = Σ(횟수 × 단가) */
export function computePerSessionRevenue(sessionCounts, sessionRates, asOfDate) {
  let total = 0;
  for (const row of sessionCounts || []) {
    const count = Number(row.session_count) || 0;
    if (count <= 0) continue;
    const rate = pickSessionRate(sessionRates, row.session_type, asOfDate);
    total += count * rate;
  }
  return Math.round(total);
}

/** 인당 과금 매출 = 인원수 × 인당단가 */
export function computePerCapitaRevenue(sessionCounts, sessionRates, asOfDate, sessionType = "인당") {
  const row = (sessionCounts || []).find(c => c.session_type === sessionType)
    ?? (sessionCounts || [])[0];
  const count = Number(row?.session_count) || 0;
  if (count <= 0) return 0;
  const rate = pickSessionRate(sessionRates, sessionType, asOfDate);
  return Math.round(count * rate);
}

/** billing_type / contract_type에 따른 월 매출 */
export function resolveInstitutionRevenue({
  institution,
  contract,
  sessionCounts,
  sessionRates,
  yearMonth,
}) {
  if (institution?.contract_type === "partner_billing") return 0;
  const asOf = `${yearMonth}-28`;
  if (institution?.billing_type === "per_session") {
    return computePerSessionRevenue(sessionCounts, sessionRates, asOf);
  }
  const perCapita = institution?.billing_type === "per_capita"
    || (sessionRates || []).some(
      r => r.institution_id === institution?.id && r.session_type === "인당",
    )
    || (sessionCounts || []).some(
      c => c.institution_id === institution?.id && c.session_type === "인당",
    );
  if (perCapita) {
    return computePerCapitaRevenue(sessionCounts, sessionRates, asOf);
  }
  return Number(contract?.contract_amount) || 0;
}

export function computeSettlement({
  contractType,
  revenue = 0,
  instructorCost = 0,
  fixedPayoutAmount = 0,
}) {
  const cost = Number(instructorCost) || 0;
  const fixedPayout = Number(fixedPayoutAmount) || 0;

  if (contractType === "partner_billing") {
    return {
      revenue: 0,
      vat: 0,
      revenue_after_vat: 0,
      income_tax: 0,
      revenue_after_tax: 0,
      instructor_cost: cost,
      net_profit: 0,
      manager_share: 0,
      gts_share: 0,
      partner_invoice_amount: cost,
      fixed_payout: 0,
    };
  }

  const rev = Number(revenue) || 0;
  const vat = Math.round(rev * 0.1);
  const revenueAfterVat = rev - vat;

  if (contractType === "manager_personal") {
    return {
      revenue: rev,
      vat,
      revenue_after_vat: revenueAfterVat,
      income_tax: 0,
      revenue_after_tax: revenueAfterVat,
      instructor_cost: cost,
      net_profit: revenueAfterVat,
      manager_share: revenueAfterVat,
      gts_share: 0,
      partner_invoice_amount: 0,
      fixed_payout: 0,
    };
  }

  if (contractType === "manager_fixed_payout") {
    const supplementary = Math.max(0, Number(cost) || 0);
    const totalInstructor = fixedPayout + supplementary;
    const managerPayoutNet = Math.round(fixedPayout * 0.9);
    const netProfit = revenueAfterVat - totalInstructor;
    return {
      revenue: rev,
      vat,
      revenue_after_vat: revenueAfterVat,
      income_tax: 0,
      revenue_after_tax: revenueAfterVat,
      instructor_cost: totalInstructor,
      supplementary_instructor_cost: supplementary,
      net_profit: netProfit,
      manager_share: managerPayoutNet,
      gts_share: netProfit,
      partner_invoice_amount: 0,
      fixed_payout: fixedPayout,
      manager_payout_net: managerPayoutNet,
    };
  }

  if (contractType === "manager_threshold_split") {
    return computeManagerThresholdSplitSettlement(rev, cost);
  }

  // gts_official (기본)
  const incomeTax = Math.round(revenueAfterVat * 0.1);
  const revenueAfterTax = revenueAfterVat - incomeTax;
  const netProfit = revenueAfterTax - cost;
  const half = Math.round(netProfit * 0.5);

  return {
    revenue: rev,
    vat,
    revenue_after_vat: revenueAfterVat,
    income_tax: incomeTax,
    revenue_after_tax: revenueAfterTax,
    instructor_cost: cost,
    net_profit: netProfit,
    manager_share: half,
    gts_share: netProfit - half,
    partner_invoice_amount: 0,
    fixed_payout: 0,
  };
}

/** payroll_entries + pay_rates → 강사료 합계 */
export function sumPayrollCost(entries, ratesByTeacherPayType) {
  let total = 0;
  for (const entry of entries) {
    const key = `${entry.teacher_id}:${entry.pay_type}`;
    const rate = ratesByTeacherPayType[key] ?? 0;
    total += entry.minutes * rate;
  }
  return Math.round(total);
}

/** 해당 날짜 기준 유효 단가 선택.
 *  institutionId가 있으면 기관별 단가 우선, 없으면(또는 미설정이면) 기본 단가(institution_id null). */
export function pickRateForDate(rates, teacherId, payType, classDate, institutionId = null) {
  const candidates = (rates || []).filter(r =>
    r.teacher_id === teacherId
    && r.pay_type === payType
    && r.effective_from <= classDate,
  );
  if (!candidates.length) return 0;

  const sortNewest = (a, b) => b.effective_from.localeCompare(a.effective_from);

  if (institutionId) {
    const specific = candidates
      .filter(r => r.institution_id === institutionId)
      .sort(sortNewest);
    if (specific.length) return Number(specific[0].rate_per_minute) || 0;
  }

  const defaults = candidates
    .filter(r => !r.institution_id)
    .sort(sortNewest);
  return Number(defaults[0]?.rate_per_minute) || 0;
}

export function buildRatesMap(rates, asOfDate) {
  const map = {};
  const byKey = {};
  for (const r of rates) {
    if (r.effective_from > asOfDate) continue;
    const inst = r.institution_id || "";
    const key = `${r.teacher_id}:${r.pay_type}:${inst}`;
    if (!byKey[key] || byKey[key].effective_from < r.effective_from) {
      byKey[key] = r;
    }
  }
  for (const [key, r] of Object.entries(byKey)) {
    map[key] = Number(r.rate_per_minute);
  }
  return map;
}

export function estimateTeacherPay(entries, rates, asOfDate) {
  // 기관별 단가를 쓰려면 entry 단위 계산 사용
  return estimateTeacherPayByEntry(entries, rates);
}

/** 회당 고정 급여(분 무관) — teacher + institution + payType */
const FLAT_PAY_PER_SESSION = [
  {
    teacherId: "2b9ea5ac-5694-41a0-aa9c-729c29afa42a", // 김하원
    institutionId: "53db5c42-8ba7-4e8d-8080-3f7b71f0c8f5", // 더차일드
    payType: "방과후",
    amount: 50000,
  },
];

export const FLAT_PAY_SLOT_LABEL = "고정50000";

function matchesFlatPayRule(entry) {
  if (!entry?.minutes || entry.minutes <= 0) return null;
  const payeeId = entry.substitute_teacher_id || entry.teacher_id;
  return FLAT_PAY_PER_SESSION.find(r =>
    payeeId === r.teacherId
    && entry.institution_id === r.institutionId
    && entry.pay_type === r.payType,
  ) ?? null;
}

/** 항목별 급여 — flat 규칙·슬롯 label 우선, 없으면 분×단가.
 *  substitute_teacher_id가 있으면 대체 선생님 단가로 계산.
 *  기관별 단가 > 기본 단가. */
export function entryPayAmount(entry, rates, slotById = {}) {
  if (!entry?.minutes || entry.minutes <= 0) return 0;
  if (entry.schedule_slot_id) {
    const slot = slotById[entry.schedule_slot_id];
    if (slot?.label === FLAT_PAY_SLOT_LABEL) return 50000;
  }
  const flat = matchesFlatPayRule(entry);
  if (flat) return flat.amount;
  const rateTeacherId = entry.substitute_teacher_id || entry.teacher_id;
  const rate = Number(pickRateForDate(
    rates,
    rateTeacherId,
    entry.pay_type,
    entry.class_date,
    entry.institution_id || null,
  )) || 0;
  return entry.minutes * rate;
}

/** 해당 선생님 급여에 포함될 항목만 (대체 배정 시 원래 선생님 제외) */
export function payRelevantEntries(entries, teacherId) {
  return (entries || []).filter(e => {
    if (!e?.entry_status || !(e.minutes > 0)) return false;
    if (e.substitute_teacher_id) return e.substitute_teacher_id === teacherId;
    return e.teacher_id === teacherId;
  });
}

/** 항목별 class_date 기준 단가 적용 (정확한 급여 계산) */
export function estimateTeacherPayByEntry(entries, rates, slotById = {}, teacherId = null) {
  const list = teacherId ? payRelevantEntries(entries, teacherId) : (entries || []);
  let total = 0;
  for (const e of list) {
    total += entryPayAmount(e, rates, slotById);
  }
  return Math.round(total);
}

export function ratesRowsToMap(rows) {
  const map = {};
  for (const r of rows) {
    const inst = r.institution_id || "";
    map[`${r.teacher_id}:${r.pay_type}:${inst}`] = Number(r.rate_per_minute);
  }
  return map;
}

export function groupPayrollByType(entries) {
  const groups = {};
  for (const t of ["정규", "방과후", "가정방문", "센터", "센터보조"]) {
    groups[t] = 0;
  }
  for (const e of entries) {
    groups[e.pay_type] = (groups[e.pay_type] || 0) + e.minutes;
  }
  return groups;
}
