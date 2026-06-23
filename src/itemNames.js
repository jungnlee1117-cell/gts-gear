/** 교구명 비교용 — 앞뒤 공백 제거, 대소문자 무시 */
export function normalizeItemName(name) {
  return (name || "").trim().toLowerCase();
}

/** 로컬 items 배열에서 이름 중복 탐지 (편집 시 excludeId 제외) */
export function findItemNameConflict(items, name, excludeId = null) {
  const key = normalizeItemName(name);
  if (!key) return null;
  for (const item of items || []) {
    if (excludeId && item.id === excludeId) continue;
    if (normalizeItemName(item.name) === key) return item;
  }
  return null;
}

export function isDuplicateItemNameError(error) {
  const msg = error?.message || "";
  return error?.code === "23505" || msg.includes("items_name_normalized_unique");
}

export const DUPLICATE_ITEM_NAME_MESSAGE = "중복된 이름입니다.";
