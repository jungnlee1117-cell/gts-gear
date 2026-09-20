import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || "",
);

export const QUANTITY_ADJUST_NOTE_PRESETS = [
  "실제 세어보니 달랐음",
  "파손",
  "분실",
  "기타",
];

export function quantityAdjustErrorMessage(error) {
  const msg = String(error?.message || error || "").trim();
  if (!msg) return "수량 변경에 실패했습니다.";
  if (/schema cache|does not exist|42P01|PGRST205|Could not find the function/i.test(msg)) {
    return "재고 변경 기능을 위한 데이터베이스 업데이트가 필요합니다. supabase/item_quantity_adjustments.sql 을 실행해 주세요.";
  }
  return msg;
}

/** 전체 보유 수량(total_quantity) 즉시 수정 + 이력 */
export async function adjustItemTotalQuantity({ itemId, newQuantity, note }) {
  const qty = Number(newQuantity);
  if (!itemId) throw new Error("교구를 찾을 수 없습니다.");
  if (!Number.isInteger(qty) || qty < 0) throw new Error("수량은 0 이상의 정수여야 합니다.");

  const { data, error } = await supabase.rpc("adjust_item_total_quantity", {
    p_item_id: itemId,
    p_new_quantity: qty,
    p_note: note ? String(note).trim() : null,
  });
  if (error) throw error;
  return data;
}

export const INVENTORY_LOG_PREVIEW_LIMIT = 20;

export function formatAdjustmentWhen(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatAdjustmentSubtitle(row) {
  if (!row) return "최근 재고 수량 변경 내역";
  const name = row.items?.name || "교구";
  const teacher = row.teachers?.name;
  const change = `${row.old_quantity} → ${row.new_quantity}`;
  return [name, change, teacher].filter(Boolean).join(" · ");
}

export async function fetchItemQuantityAdjustments({ limit = 400 } = {}) {
  const { data, error } = await supabase
    .from("item_quantity_adjustments")
    .select("id, item_id, teacher_id, old_quantity, new_quantity, note, created_at, items(id, name, code), teachers(id, name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!error && data) return { rows: data, missingTable: false };

  const msg = error?.message || "";
  const missing = error?.code === "42P01" || error?.code === "PGRST205"
    || /schema cache|does not exist/i.test(msg);
  if (missing) return { rows: [], missingTable: true };

  const fallback = await supabase
    .from("item_quantity_adjustments")
    .select("id, item_id, teacher_id, old_quantity, new_quantity, note, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (fallback.error) {
    const fmsg = fallback.error.message || "";
    const fmissing = fallback.error.code === "42P01" || fallback.error.code === "PGRST205"
      || /schema cache|does not exist/i.test(fmsg);
    if (fmissing) return { rows: [], missingTable: true };
    throw fallback.error;
  }
  return { rows: fallback.data || [], missingTable: false };
}
