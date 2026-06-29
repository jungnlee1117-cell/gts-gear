/** Play by GTS 삼성 센터 등 — 부가세 제외 100만원 기준 분배 */
export const MANAGER_THRESHOLD_SPLIT_AMOUNT = 1_000_000;

export const SAMSUNG_CENTER_INSTITUTION_PATTERN = /play\s*by\s*gts\s*삼성\s*센터/i;

function matchInstitutionName(name, pattern) {
  if (!name || !pattern) return false;
  if (pattern instanceof RegExp) return pattern.test(name);
  return String(name).includes(pattern);
}

export function isManagerThresholdSplit(institution) {
  if (!institution) return false;
  if (institution.contract_type === "manager_threshold_split") return true;
  return matchInstitutionName(institution.name, SAMSUNG_CENTER_INSTITUTION_PATTERN);
}

/** DB 미반영 시에도 삼성 센터 정산 규칙 적용 */
export function resolveSettlementContractType(institution) {
  if (isManagerThresholdSplit(institution)) return "manager_threshold_split";
  return institution?.contract_type ?? "gts_official";
}

export function computeManagerThresholdSplitSettlement(revenue = 0, manualInstructorCost = 0) {
  const rev = Number(revenue) || 0;
  const vat = Math.round(rev * 0.1);
  const revenueAfterVat = rev - vat;
  const threshold = MANAGER_THRESHOLD_SPLIT_AMOUNT;
  const instructorCost = Math.max(0, Number(manualInstructorCost) || 0);

  if (revenueAfterVat <= threshold) {
    return {
      revenue: rev,
      vat,
      revenue_after_vat: revenueAfterVat,
      income_tax: 0,
      revenue_after_tax: revenueAfterVat,
      instructor_cost: 0,
      net_profit: 0,
      manager_share: revenueAfterVat,
      gts_share: 0,
      partner_invoice_amount: 0,
      fixed_payout: 0,
      threshold_split_excess: 0,
      threshold_split_remainder: 0,
    };
  }

  const excess = revenueAfterVat - threshold;
  const remainder = Math.max(0, excess - instructorCost);
  const gtsShare = Math.round(remainder * 0.5);
  const managerExcessShare = remainder - gtsShare;
  const managerShare = threshold + managerExcessShare;

  return {
    revenue: rev,
    vat,
    revenue_after_vat: revenueAfterVat,
    income_tax: 0,
    revenue_after_tax: revenueAfterVat,
    instructor_cost: instructorCost,
    net_profit: remainder,
    manager_share: managerShare,
    gts_share: gtsShare,
    partner_invoice_amount: 0,
    fixed_payout: 0,
    threshold_split_excess: excess,
    threshold_split_remainder: remainder,
  };
}

export function buildThresholdSplitSteps(calc) {
  if (!calc) return [];
  const afterVat = Number(calc.revenue_after_vat) || 0;
  const threshold = MANAGER_THRESHOLD_SPLIT_AMOUNT;
  const steps = [];

  steps.push({ label: "매출", amount: calc.revenue });
  steps.push({
    label: "부가세 차감 (−10%)",
    amount: calc.vat,
    hint: `부가세 제외 ${afterVat.toLocaleString("ko-KR")}원`,
  });

  if (afterVat <= threshold) {
    steps.push({
      label: "100만원 이하",
      hint: "전액 담당자 지급 (회사 분배·종소세 없음)",
    });
    steps.push({ label: "담당자 몫", amount: calc.manager_share, highlight: true });
    return steps;
  }

  const excess = Number(calc.threshold_split_excess) || (afterVat - threshold);
  steps.push({
    label: "100만원 초과",
    hint: `100만원 담당자 몫 + 초과분 ${excess.toLocaleString("ko-KR")}원`,
  });
  steps.push({ label: "100만원 담당자 몫", amount: threshold });

  const instructorCost = Number(calc.instructor_cost) || 0;
  if (instructorCost > 0) {
    steps.push({
      label: "인건비 차감 (외부 강사)",
      amount: instructorCost,
      hint: `차감 후 ${(Number(calc.threshold_split_remainder) || 0).toLocaleString("ko-KR")}원`,
    });
  } else {
    steps.push({ label: "인건비 차감", hint: "없음" });
  }

  const remainder = Number(calc.threshold_split_remainder) || 0;
  steps.push({
    label: "잔액 5:5 분배",
    hint: `분배 대상 ${remainder.toLocaleString("ko-KR")}원`,
  });
  steps.push({
    label: "담당자 몫 (합계)",
    amount: calc.manager_share,
    highlight: true,
  });
  steps.push({
    label: "GTS 몫",
    amount: calc.gts_share,
    highlight: true,
  });
  return steps;
}
