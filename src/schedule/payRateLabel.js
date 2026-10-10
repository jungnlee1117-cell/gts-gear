/** 저장된 강사 단가를 화면 문구로 바꿉니다. */
export function formatStoredRate(rate, formatWon) {
  if (!rate) return null;
  if (rate.rate_unit === "revenue_share") {
    const pct = sharePercentLabel(rate.share_ratio);
    return pct ? `매출 연동 ${pct}%` : "매출 연동";
  }
  if (rate.rate_unit === "session") {
    return `${formatWon(rate.rate_per_session)}/회`;
  }
  return `${formatWon(rate.rate_per_minute * 60)}/시간 (${formatWon(rate.rate_per_minute)}/분)`;
}

export function sharePercentLabel(ratio) {
  const n = Number(ratio);
  if (!Number.isFinite(n) || n <= 0) return null;
  const pct = Math.round(n * 1000) / 10;
  return Number.isInteger(pct) ? String(pct) : String(pct);
}

/** 목록 헤더용. 기본 단가가 같은 배분율이면 한 줄로 모읍니다. */
export function revenueShareListLabel(rates = []) {
  const rows = rates.filter(r => r?.rate_unit === "revenue_share" && !r.institution_id);
  if (!rows.length) return null;
  const labels = [...new Set(rows.map(r => sharePercentLabel(r.share_ratio)))];
  if (labels.length === 1 && labels[0]) return `매출 연동 ${labels[0]}%`;
  return "매출 연동";
}
