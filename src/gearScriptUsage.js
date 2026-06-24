const USAGE_KEY = "gts_gear_script_usage";

export function recordGearScriptUsage(itemId) {
  if (!itemId || typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[itemId] = new Date().toISOString();
    localStorage.setItem(USAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getGearScriptLastUsed(itemId) {
  if (!itemId || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[itemId] || null;
  } catch {
    return null;
  }
}

export function formatLastUsedLabel(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. 사용`;
}
