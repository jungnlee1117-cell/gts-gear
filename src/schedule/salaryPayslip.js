import { scheduleSupabase } from "./api.js";

export const PAYSLIP_EARNINGS = [
  "기본급", "상여", "직책수당", "월차수당", "식대", "자가운전보조금", "야간근로수당", "추가근로수당",
];
export const PAYSLIP_DEDUCTIONS = [
  "국민연금", "건강보험", "장기요양보험", "고용보험", "소득세", "지방소득세", "농특세",
];
export const PAYSLIP_DEFAULT_EARNINGS = { 기본급: 2400000, 식대: 200000 };

export const PAYSLIP_DEFAULT_DEDUCTIONS = {
  국민연금: 123500, 건강보험: 93470, 장기요양보험: 12280, 고용보험: 23400, 소득세: 32380, 지방소득세: 3230,
};
export const PAYSLIP_DEFAULT_HIRE_DATE = "2026-03-01";

export function monthFirstDay(yearMonth) {
  return `${String(yearMonth).slice(0, 7)}-01`;
}

export function sumItems(obj) {
  return Object.values(obj || {}).reduce((s, v) => s + (Number(v) || 0), 0);
}

export function payslipNet(payslip) {
  if (!payslip) return null;
  return sumItems(payslip.earnings) - sumItems(payslip.deductions);
}

function previousYearMonth(yearMonth) {
  const [y, m] = String(yearMonth).slice(0, 7).split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function fetchPayslipsForMonth(yearMonth) {
  const { data, error } = await scheduleSupabase
    .from("salary_payslips")
    .select("*")
    .eq("year_month", monthFirstDay(yearMonth));
  if (error) {
    if (/schema cache|does not exist|42P01/i.test(error.message || "")) return [];
    throw error;
  }
  return data || [];
}

export async function fetchPayslip(teacherId, yearMonth) {
  const { data, error } = await scheduleSupabase
    .from("salary_payslips")
    .select("*")
    .eq("teacher_id", teacherId)
    .eq("year_month", monthFirstDay(yearMonth))
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function fetchPreviousPayslip(teacherId, yearMonth) {
  return fetchPayslip(teacherId, previousYearMonth(yearMonth));
}

export async function savePayslip(payload) {
  const { data, error } = await scheduleSupabase
    .from("salary_payslips")
    .upsert(
      { ...payload, updated_at: new Date().toISOString() },
      { onConflict: "teacher_id,year_month" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
