import { getCategoryMeta } from "../gearCategoryData.js";

const RENTAL_STATUS = {
  pending: "대여신청",
  approved: "승인됨",
  rejected: "거절됨",
  rented: "대여중",
  partial_returned: "일부반납",
  returned: "반납완료",
  partial: "진행중",
  completed: "완료",
  cancelled: "취소됨",
};

export function categoryLabel(cat) {
  return getCategoryMeta(cat).label;
}

export function rentalStatusLabel(status) {
  return RENTAL_STATUS[status] || status || "-";
}

export function fmtYmd(value) {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toMonthKey(value) {
  const ymd = fmtYmd(value);
  return ymd ? ymd.slice(0, 7) : null;
}

function returnApprovedQty(riId, rets) {
  return (rets || [])
    .filter(r => r.rental_item_id === riId && r.status === "return_approved")
    .reduce((s, r) => s + (Number(r.quantity) || 0), 0);
}

function rentedQtyForItem(itemId, ris, rets) {
  return (ris || [])
    .filter(r => r.item_id === itemId && ["rented", "partial_returned"].includes(r.status))
    .reduce((s, r) => {
      const held = Math.max(0, (Number(r.quantity) || 0) - returnApprovedQty(r.id, rets));
      return s + held;
    }, 0);
}

function pendingQtyForItem(itemId, ris) {
  return (ris || [])
    .filter(r => r.item_id === itemId && r.status === "pending")
    .reduce((s, r) => s + (Number(r.quantity) || 0), 0);
}

export function buildEquipmentStatusRows(items, ris, rets) {
  return (items || [])
    .slice()
    .sort((a, b) => String(a.code || a.name || "").localeCompare(String(b.code || b.name || ""), "ko"))
    .map(item => {
      const total = Number(item.total_quantity) || 0;
      const rented = rentedQtyForItem(item.id, ris, rets);
      const pending = pendingQtyForItem(item.id, ris);
      const available = Math.max(0, total - rented - pending);
      return {
        교구명: item.name || "-",
        카테고리: categoryLabel(item.category),
        "전체 수량": total,
        "대여 가능 수량": available,
        "대여중 수량": rented,
      };
    });
}

function rentalAt(ri, req) {
  return ri.approved_at || req?.dispatch_start || ri.created_at || req?.created_at;
}

function returnDateForItem(ri, rets) {
  if (ri.status !== "returned") return "";
  const approved = (rets || [])
    .filter(r => r.rental_item_id === ri.id && r.status === "return_approved")
    .map(r => r.approved_at || r.created_at)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a));
  return fmtYmd(approved[0]);
}

export function buildRentalHistoryRows({ ris, reqs, items, teachers, rets, month }) {
  const teacherMap = new Map((teachers || []).map(t => [t.id, t.name]));
  const itemMap = new Map((items || []).map(i => [i.id, i]));
  const reqMap = new Map((reqs || []).map(r => [r.id, r]));

  return (ris || [])
    .filter(ri => !["pending", "rejected", "cancelled"].includes(ri.status))
    .map(ri => {
      const req = reqMap.get(ri.request_id);
      const rentedOn = rentalAt(ri, req);
      return { ri, req, rentedOn };
    })
    .filter(row => {
      if (!month) return true;
      return toMonthKey(row.rentedOn) === month;
    })
    .sort((a, b) => new Date(b.rentedOn || 0) - new Date(a.rentedOn || 0))
    .map(({ ri, req, rentedOn }) => {
      const item = itemMap.get(ri.item_id);
      return {
        선생님명: teacherMap.get(req?.teacher_id) || "-",
        교구명: item?.name || "-",
        대여일: fmtYmd(rentedOn),
        반납예정일: fmtYmd(ri.due_date),
        반납일: returnDateForItem(ri, rets),
        상태: rentalStatusLabel(ri.status),
      };
    });
}

export const EQUIPMENT_STATUS_HEADERS = [
  "교구명",
  "카테고리",
  "전체 수량",
  "대여 가능 수량",
  "대여중 수량",
];

export const RENTAL_HISTORY_HEADERS = [
  "선생님명",
  "교구명",
  "대여일",
  "반납예정일",
  "반납일",
  "상태",
];
