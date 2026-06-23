/** 스케줄·분 계산과 무관하게 월 총액 고정 (teacherId + YYYY-MM) */
export const FIXED_GROSS_PAY = [
  {
    teacherId: "2b9ea5ac-5694-41a0-aa9c-729c29afa42a", // 김하원
    yearMonth: "2026-05",
    gross: 1740000,
    reason: "5월 확정급 (스케줄 변동)",
  },
];

/** 매월 고정급 + additional_payments 합산 (수업료·분 계산 무시) */
export const FIXED_MONTHLY_SALARY = [
  {
    teacherId: "1edf5e11-75c3-409c-95a3-9ce1020111b7", // 오주영
    baseGross: 2600000,
    label: "고정 계약급",
  },
];

export function findFixedGrossPay(teacherId, yearMonth) {
  const ym = String(yearMonth || "").slice(0, 7);
  return FIXED_GROSS_PAY.find(f => f.teacherId === teacherId && f.yearMonth === ym) ?? null;
}

export function findFixedMonthlySalary(teacherId) {
  return FIXED_MONTHLY_SALARY.find(f => f.teacherId === teacherId) ?? null;
}

/** 추가 지급 합계 */
export function sumAdditionalPayments(payments) {
  return (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
}

/** 수업료 + 추가지급 */
export function totalGrossPay(lessonPay, additionalPayments) {
  return Math.round(Number(lessonPay || 0) + sumAdditionalPayments(additionalPayments));
}

/**
 * 월 예상 총액 (세전)
 * 1) FIXED_GROSS_PAY — 해당 월 전액 고정 (김하원 5월 등)
 * 2) FIXED_MONTHLY_SALARY — 고정급 + additional_payments (오주영)
 * 3) 기본 — 수업료 + additional_payments
 */
export function resolveTeacherMonthlyGross(teacherId, yearMonth, lessonPay, additionalPayments) {
  const fixedMonth = findFixedGrossPay(teacherId, yearMonth);
  if (fixedMonth) return fixedMonth.gross;

  const fixedSalary = findFixedMonthlySalary(teacherId);
  if (fixedSalary) {
    return fixedSalary.baseGross + sumAdditionalPayments(additionalPayments);
  }

  return totalGrossPay(lessonPay, additionalPayments);
}

/** 3.3% 원천징수액 (세전 총액 기준) */
export function withholdingTax333(gross) {
  return Math.round(Number(gross || 0) * 0.033);
}

export function groupAdditionalPaymentsByTeacher(payments) {
  const map = new Map();
  for (const p of payments || []) {
    if (!map.has(p.teacher_id)) map.set(p.teacher_id, []);
    map.get(p.teacher_id).push(p);
  }
  return map;
}

export function formatAdditionalPaymentLine(payment) {
  return `${payment.reason} ${Number(payment.amount).toLocaleString("ko-KR")}원`;
}

/** 강사 화면용: '교통비 지원 +100,000원' */
export function formatTeacherAdditionalLine(payment) {
  return `${payment.reason} +${Number(payment.amount).toLocaleString("ko-KR")}원`;
}
