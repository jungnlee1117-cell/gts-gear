import { scheduleSupabase } from "./api.js";

function taxIncomeType(teacher) {
  return teacher?.contract_type === "regular" ? "계약직" : "위탁수업";
}

export function payrollTaxSnapshotRows(data) {
  const regular = (data?.teacherRows || []).map((row, index) => ({
    teacher_id: row.teacher.id,
    teacher_name: row.teacher.name,
    income_type: taxIncomeType(row.teacher),
    gross_amount: Math.max(0, Math.round(Number(row.estimatedPay) || 0)),
    sort_order: index,
  }));

  const temporary = (data?.tempTeacherRows || []).map((row, index) => ({
    teacher_id: null,
    teacher_name: row.teacher?.name || row.tempTeacher?.name || "임시 선생님",
    income_type: "위탁수업",
    gross_amount: Math.max(0, Math.round(Number(row.estimatedPay) || 0)),
    sort_order: regular.length + index,
  }));

  return [...regular, ...temporary];
}

async function invoke(action, payload = {}) {
  const { data, error } = await scheduleSupabase.functions.invoke("payroll-tax-report", {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.data;
}

export async function savePayrollTaxSnapshot(yearMonth, dashboardData) {
  return invoke("save_snapshot", {
    year_month: yearMonth,
    rows: payrollTaxSnapshotRows(dashboardData),
  });
}

function downloadBase64Xlsx(base64, filename) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadPayrollTaxReport(yearMonth, dashboardData) {
  await savePayrollTaxSnapshot(yearMonth, dashboardData);
  const result = await invoke("download", { year_month: yearMonth });
  downloadBase64Xlsx(result.file_base64, result.filename);
  return result;
}

export async function uploadPayrollTaxReportToDrive(yearMonth, dashboardData) {
  await savePayrollTaxSnapshot(yearMonth, dashboardData);
  return invoke("upload_drive", { year_month: yearMonth });
}
