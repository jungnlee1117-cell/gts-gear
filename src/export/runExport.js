import {
  buildEquipmentStatusRows,
  buildRentalHistoryRows,
  EQUIPMENT_STATUS_HEADERS,
  RENTAL_HISTORY_HEADERS,
} from "./gearExport.js";
import {
  fetchTeacherSettlementRows,
  TEACHER_SETTLEMENT_HEADERS,
} from "./teacherSettlement.js";
import { downloadXlsx, exportFilename } from "./xlsxDownload.js";

function yearMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function throwIfError(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data || [];
}

export async function exportEquipmentStatus(supabase, { allPeriod, month }) {
  const monthForFile = allPeriod ? null : (month || yearMonthKey());
  const [items, ris, rets] = await Promise.all([
    throwIfError("교구", await supabase.from("items").select("*").order("code")),
    throwIfError("대여항목", await supabase.from("rental_items").select("*")),
    throwIfError("반납", await supabase.from("return_requests").select("*")),
  ]);

  const rows = buildEquipmentStatusRows(items, ris, rets);
  const filename = exportFilename("equipment-status", { all: allPeriod, month: monthForFile });
  downloadXlsx(EQUIPMENT_STATUS_HEADERS, rows, filename);
}

export async function exportRentalHistory(supabase, { allPeriod, month }) {
  if (!allPeriod && !month) {
    throw new Error("조회 월을 선택하거나 전체 기간을 선택해 주세요.");
  }

  const [items, reqs, ris, rets, teachers] = await Promise.all([
    throwIfError("교구", await supabase.from("items").select("id, name")),
    throwIfError("대여신청", await supabase.from("rental_requests").select("*")),
    throwIfError("대여항목", await supabase.from("rental_items").select("*")),
    throwIfError("반납", await supabase.from("return_requests").select("*")),
    throwIfError("선생님", await supabase.from("teachers").select("id, name")),
  ]);

  const rows = buildRentalHistoryRows({
    ris,
    reqs,
    items,
    teachers,
    rets,
    month: allPeriod ? null : month,
  });

  const filename = exportFilename("rental-history", { all: allPeriod, month });
  downloadXlsx(RENTAL_HISTORY_HEADERS, rows, filename);
}

export async function exportTeacherSettlement(supabase, { allPeriod, month }) {
  if (!allPeriod && !month) {
    throw new Error("조회 월을 선택하거나 전체 기간을 선택해 주세요.");
  }

  const rows = await fetchTeacherSettlementRows(supabase, {
    month,
    all: allPeriod,
  });

  const filename = exportFilename("teacher-settlement", { all: allPeriod, month });
  downloadXlsx(TEACHER_SETTLEMENT_HEADERS, rows, filename);
}

const EXPORT_HANDLERS = {
  "equipment-status": exportEquipmentStatus,
  "rental-history": exportRentalHistory,
  "teacher-settlement": exportTeacherSettlement,
};

export async function runDataExport(supabase, kind, options) {
  const handler = EXPORT_HANDLERS[kind];
  if (!handler) throw new Error("알 수 없는 내보내기 유형입니다.");
  await handler(supabase, options);
}
