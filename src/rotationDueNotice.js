/**
 * 대여 승인 직후 반납 기한 푸시.
 * 반납일은 순환 주차 시작 전날이라, 이미 시작된·지난 주차를 넣으면 과거 날짜가 나간다.
 */

export function earliestRotationConflictByItem(conflicts, { afterYmd } = {}) {
  const today = afterYmd ? String(afterYmd).slice(0, 10) : "";
  const byItem = new Map();
  for (const c of conflicts || []) {
    if (!c.itemName || !c.weekStart) continue;
    const weekStart = String(c.weekStart).slice(0, 10);
    if (today && weekStart <= today) continue;
    const prev = byItem.get(c.itemId || c.itemName);
    if (!prev || weekStart < String(prev.weekStart).slice(0, 10)) {
      byItem.set(c.itemId || c.itemName, c);
    }
  }
  return [...byItem.values()];
}
