/** @typedef {{ id: string, label: string, color: string, icon: string, sort_order: number }} GearCategoryRow */

export const DEFAULT_GEAR_CATEGORIES = [
  { id: "AIR", label: "에어교구", color: "#0891b2", icon: "🎈", sort_order: 1 },
  { id: "BALL", label: "공류", color: "#ea580c", icon: "⚽", sort_order: 2 },
  { id: "BAL", label: "밸런스", color: "#059669", icon: "⚖️", sort_order: 3 },
  { id: "SPORT", label: "스포츠", color: "#2563eb", icon: "🏅", sort_order: 4 },
  { id: "TOOL", label: "도구류", color: "#7c3aed", icon: "🧰", sort_order: 5 },
  { id: "DIG", label: "디지털", color: "#db2777", icon: "💡", sort_order: 6 },
  { id: "MAT", label: "매트/기구", color: "#65a30d", icon: "🟩", sort_order: 7 },
  { id: "GROUP", label: "단체놀이", color: "#d97706", icon: "👥", sort_order: 8 },
  { id: "STACK", label: "쌓기", color: "#8b5cf6", icon: "🏗️", sort_order: 9 },
  { id: "TARGET", label: "표적교구", color: "#0d9488", icon: "🎯", sort_order: 10 },
  { id: "ETC", label: "기타교구", color: "#7c3aed", icon: "⭐", sort_order: 11 },
  { id: "EVENT", label: "이벤트", color: "#ec4899", icon: "🎉", sort_order: 12 },
];

const LABEL_TO_ID = {
  이벤트: "EVENT",
  에어교구: "AIR",
  공류: "BALL",
  밸런스: "BAL",
  스포츠: "SPORT",
  도구류: "TOOL",
  디지털: "DIG",
  "매트/기구": "MAT",
  단체놀이: "GROUP",
  쌓기: "STACK",
  표적교구: "TARGET",
  기타교구: "ETC",
};

export function categoriesToMap(categories) {
  /** @type {Record<string, { label: string, color: string, icon: string }>} */
  const map = {};
  for (const row of categories) {
    map[row.id] = { label: row.label, color: row.color, icon: row.icon };
  }
  return map;
}

export const DEFAULT_GEAR_CATEGORY_MAP = categoriesToMap(DEFAULT_GEAR_CATEGORIES);

export function normalizeCategoryKey(cat) {
  if (cat === "SPC") return "ETC";
  return cat;
}

export function categoryMatchesFilter(itemCategory, filterKey) {
  return normalizeCategoryKey(itemCategory) === filterKey;
}

export function getCategoryMeta(cat, categoryMap = DEFAULT_GEAR_CATEGORY_MAP) {
  const key = normalizeCategoryKey(cat);
  if (categoryMap[key]) return { ...categoryMap[key], key };
  if (cat === "BLOCK") return { key: "BLOCK", label: "블록(구)", color: "#94a3b8", icon: "📦" };
  return { key: key || "?", label: cat || "-", color: "#94a3b8", icon: "?" };
}

export function suggestCategoryId(label, existingIds = []) {
  const trimmed = label.trim();
  if (!trimmed) return "";
  if (LABEL_TO_ID[trimmed]) return LABEL_TO_ID[trimmed];

  const ascii = trimmed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (ascii.length >= 2) {
    let id = ascii.slice(0, 12);
    let n = 1;
    const set = new Set(existingIds);
    while (set.has(id)) {
      id = `${ascii.slice(0, 10)}_${n}`;
      n += 1;
    }
    return id;
  }

  const set = new Set(existingIds);
  let n = 1;
  let id = `CAT_${n}`;
  while (set.has(id)) {
    n += 1;
    id = `CAT_${n}`;
  }
  return id;
}

export function mergeCategoriesWithDefaults(rows) {
  if (!rows?.length) return [...DEFAULT_GEAR_CATEGORIES];
  const byId = Object.fromEntries(rows.map(r => [r.id, r]));
  const merged = rows.map(r => ({ ...r }));
  for (const def of DEFAULT_GEAR_CATEGORIES) {
    if (!byId[def.id]) merged.push({ ...def });
  }
  return merged.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "ko"));
}
