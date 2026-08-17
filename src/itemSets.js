import { normalizeItemName } from "./itemNames.js";

function returnApprovedQty(riId, rets = []) {
  return (rets || [])
    .filter(r => r.rental_item_id === riId && r.status === "return_approved")
    .reduce((s, r) => s + r.quantity, 0);
}

function heldQtyForRi(ri, rets = []) {
  if (!["rented", "partial_returned"].includes(ri?.status)) return 0;
  return Math.max(0, (ri.quantity || 0) - returnApprovedQty(ri.id, rets));
}

/** 장바구니·대여 항목 고유 키 */
export function cartLineKey(c) {
  if (c?.set_id && c?.component_name) {
    return `set:${c.set_id}:${c.component_name}`;
  }
  return `item:${c?.item_id}`;
}

export function findSetById(itemSets, setId) {
  return (itemSets || []).find(s => String(s.id) === String(setId)) || null;
}

export function findSetComponent(set, componentName) {
  return (set?.components || []).find(c => c.name === componentName) || null;
}

/** 세트 하위 품목 가용 수량 */
export function setComponentAvailQty(setId, componentName, totalQty, ris, rets = []) {
  const rented = (ris || [])
    .filter(r =>
      r.set_id === setId
      && r.component_name === componentName
      && ["rented", "partial_returned"].includes(r.status),
    )
    .reduce((s, r) => s + heldQtyForRi(r, rets), 0);
  const pending = (ris || [])
    .filter(r => r.set_id === setId && r.component_name === componentName && r.status === "pending")
    .reduce((s, r) => s + r.quantity, 0);
  return Math.max(0, (totalQty || 0) - rented - pending);
}

export function setAvailComponentCount(set, ris, rets = []) {
  return (set?.components || []).filter(
    c => setComponentAvailQty(set.id, c.name, c.total_quantity, ris, rets) > 0,
  ).length;
}

export function setHasAnyAvail(set, ris, rets = []) {
  return setAvailComponentCount(set, ris, rets) > 0;
}

export function attachComponentsToSets(sets, components) {
  const bySet = new Map();
  for (const c of components || []) {
    if (!bySet.has(c.set_id)) bySet.set(c.set_id, []);
    bySet.get(c.set_id).push(c);
  }
  return (sets || []).map(s => ({
    ...s,
    components: (bySet.get(s.id) || []).sort(
      (a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name, "ko"),
    ),
  }));
}

export function rentalItemLabel(ri, items, itemSets) {
  if (ri?.set_id && ri?.component_name) {
    const set = findSetById(itemSets, ri.set_id);
    return set ? `${set.name} · ${ri.component_name}` : ri.component_name;
  }
  return (items || []).find(i => i.id === ri?.item_id)?.name || "-";
}

export function nextSetCode(category, sets, { excludeId } = {}) {
  const prefix = category;
  const re = new RegExp(`^${prefix}-(\\d+)$`, "i");
  let max = 0;
  (sets || []).forEach(s => {
    if (excludeId && s.id === excludeId) return;
    const m = s.code?.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export function findSetNameConflict(itemSets, name, excludeId = null) {
  const key = normalizeItemName(name);
  if (!key) return null;
  for (const set of itemSets || []) {
    if (excludeId && set.id === excludeId) continue;
    if (normalizeItemName(set.name) === key) return set;
  }
  return null;
}

export function isDuplicateSetNameError(error) {
  const msg = error?.message || "";
  return error?.code === "23505" && msg.includes("item_sets_name");
}

export const DUPLICATE_SET_NAME_MESSAGE = "중복된 세트 이름입니다.";

export function validateSetComponents(components) {
  const rows = (components || []).map(c => ({
    name: (c.name || "").trim(),
    total_quantity: parseInt(c.total_quantity, 10) || 0,
  })).filter(c => c.name);
  if (!rows.length) return { ok: false, message: "하위 품목을 1개 이상 추가하세요." };
  const names = new Set();
  for (const row of rows) {
    const key = normalizeItemName(row.name);
    if (names.has(key)) return { ok: false, message: `중복 품목명: ${row.name}` };
    names.add(key);
    if (row.total_quantity < 0) return { ok: false, message: `${row.name} 수량은 0 이상이어야 합니다.` };
  }
  return { ok: true, components: rows };
}
