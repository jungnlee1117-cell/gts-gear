import { scheduleSupabase } from "./api.js";

function taxIncomeType(teacher) {
  if (teacher?.name === "오주영") return "계약직";
  return teacher?.contract_type === "regular" ? "계약직" : "위탁수업";
}

export function payrollTaxSnapshotRows(data) {
  const regular = (data?.teacherRows || [])
    .filter((row) => row.teacher?.name !== "김민욱")
    .map((row, index) => ({
      teacher_id: row.teacher.id,
      teacher_name: row.teacher.name,
      income_type: taxIncomeType(row.teacher),
      gross_amount: Math.max(0, Math.round(Number(row.estimatedPay) || 0)),
      sort_order: index,
    }));

  const temporary = (data?.tempTeacherRows || [])
    .filter((row) => (row.teacher?.name || row.tempTeacher?.name) !== "김민욱")
    .map((row, index) => ({
      teacher_id: null,
      teacher_name: row.teacher?.name || row.tempTeacher?.name || "임시 선생님",
      income_type: "위탁수업",
      gross_amount: Math.max(0, Math.round(Number(row.estimatedPay) || 0)),
      sort_order: regular.length + index,
    }));

  return [...regular, ...temporary];
}

async function invoke(action, payload = {}) {
  const { data: sessionData, error: sessionError } = await scheduleSupabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (sessionError || !accessToken) {
    throw new Error("로그인 정보가 만료되었습니다. 다시 로그인해 주세요.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  let response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/payroll-tax-report`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error("세무 엑셀 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.error) {
    const detailed = new Error(
      result?.error || `세무 엑셀 처리에 실패했습니다. (오류 ${response.status})`,
    );
    detailed.code = result?.code || `HTTP_${response.status}`;
    throw detailed;
  }
  return result?.data;
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
