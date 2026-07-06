import {
  DAY_LABELS,
  compareByStartTime,
  institutionColor,
  resolveInstitutionSlotPayType,
} from "./constants.js";

/** 월~일 표시 순서 (day_of_week: 0=일 … 6=토) */
export const WEEK_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const INSTITUTION_THEME_PRESETS = {
  green: { bg: "#f9fbfa", border: "#e4ebe7", text: "#5c7368", badge: "#f3f6f4", dot: "#9eb5a8" },
  purple: { bg: "#faf9fb", border: "#eae7ee", text: "#6e6478", badge: "#f5f3f7", dot: "#b0a4bc" },
  blue: { bg: "#f9fafb", border: "#e3e9ef", text: "#5a6678", badge: "#f3f5f8", dot: "#96a8bc" },
  orange: { bg: "#fbfaf9", border: "#ece7e2", text: "#75685c", badge: "#f6f4f2", dot: "#c0ad9c" },
  teal: { bg: "#f9fbfb", border: "#e2ebe8", text: "#5a726c", badge: "#f3f6f5", dot: "#9cb5ad" },
  indigo: { bg: "#f9f9fb", border: "#e5e8ef", text: "#5c6278", badge: "#f4f5f8", dot: "#a2aac0" },
  rose: { bg: "#fbf9f9", border: "#ece5e5", text: "#755c5c", badge: "#f6f3f3", dot: "#c0a4a4" },
  amber: { bg: "#fbfaf8", border: "#eae6df", text: "#726858", badge: "#f6f4f0", dot: "#c0b09c" },
  cyan: { bg: "#f9fbfb", border: "#dfe9eb", text: "#5a6e76", badge: "#f3f6f7", dot: "#9cb0b8" },
  slate: { bg: "#f9fafb", border: "#e5e7eb", text: "#64748b", badge: "#f3f4f6", dot: "#94a3b8" },
};

/** 캡처 디자인 기준 원별 고정 색상 (부분 일치) */
const NAMED_INSTITUTION_THEMES = [
  { keys: ["대치폴리", "수지폴리", "광교폴리", "송파폴리"], theme: "green" },
  { keys: ["힘멜"], theme: "purple" },
  { keys: ["청담에듀"], theme: "blue" },
  { keys: ["리딩플러스"], theme: "orange" },
  { keys: ["Sie.K", "프랜시스파커"], theme: "blue" },
  { keys: ["관악SLP", "부천RISE", "광명slp"], theme: "cyan" },
  { keys: ["리틀", "지니어스", "한남"], theme: "rose" },
  { keys: ["Play by GTS", "삼성 센터", "태그 멤버스"], theme: "indigo" },
  { keys: ["어린이집", "더차일드"], theme: "amber" },
  { keys: ["리비어", "엘란"], theme: "purple" },
];

const FALLBACK_THEME_KEYS = ["green", "blue", "purple", "orange", "teal", "indigo", "rose", "amber", "cyan"];

export function formatSlotTimeRange(start, end) {
  const s = start?.slice(0, 5) ?? "";
  const e = end?.slice(0, 5) ?? "";
  return e ? `${s}~${e}` : s;
}

export function formatPayTypeLabel(payType) {
  switch (payType) {
    case "정규": return "정규 수업";
    case "방과후": return "방과후 수업";
    case "가정방문": return "가정방문";
    case "센터": return "센터";
    case "센터보조": return "센터보조";
    default: return payType || "수업";
  }
}

export function resolveInstitutionThemeKey(name) {
  const n = String(name || "");
  for (const row of NAMED_INSTITUTION_THEMES) {
    if (row.keys.some(k => n.includes(k))) return row.theme;
  }
  return null;
}

export function resolveInstitutionTheme(name, institutionId) {
  const named = resolveInstitutionThemeKey(name);
  if (named) return INSTITUTION_THEME_PRESETS[named];

  let hash = 0;
  const key = institutionId || name || "";
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const themeKey = FALLBACK_THEME_KEYS[Math.abs(hash) % FALLBACK_THEME_KEYS.length];
  return INSTITUTION_THEME_PRESETS[themeKey];
}

export function resolveScheduleItemTheme(item) {
  if (item.source === "home_visit") return INSTITUTION_THEME_PRESETS.teal;
  if (item.payType === "센터" || item.payType === "센터보조") {
    return INSTITUTION_THEME_PRESETS.indigo;
  }
  return resolveInstitutionTheme(item.name, item.colorKey);
}

export function institutionSlotToWeeklyItem(slot, studentCountByInstitution = {}) {
  const payType = resolveInstitutionSlotPayType(slot);
  const institutionId = slot.institution_id;
  return {
    id: `inst-${slot.id}`,
    source: "institution",
    day_of_week: Number(slot.day_of_week),
    start_time: slot.start_time,
    end_time: slot.end_time,
    name: slot.institutions?.name || "원",
    payType,
    subLabel: slot.label?.trim() || null,
    colorKey: institutionId,
    studentCount: studentCountByInstitution[institutionId] ?? null,
    raw: slot,
  };
}

export function homeVisitPatternToWeeklyItem(pattern) {
  if (pattern.status !== "active") return null;
  return {
    id: `hv-${pattern.id}`,
    source: "home_visit",
    day_of_week: Number(pattern.day_of_week),
    start_time: pattern.start_time,
    end_time: pattern.end_time,
    name: pattern.student_name?.trim() || "가정방문",
    payType: "가정방문",
    subLabel: pattern.location?.trim() || null,
    colorKey: pattern.id,
    studentCount: 1,
    raw: pattern,
  };
}

export function buildUnifiedWeeklyItems(
  institutionSlots = [],
  homeVisitPatterns = [],
  studentCountByInstitution = {},
) {
  const items = [];
  for (const slot of institutionSlots) {
    items.push(institutionSlotToWeeklyItem(slot, studentCountByInstitution));
  }
  for (const pattern of homeVisitPatterns) {
    const item = homeVisitPatternToWeeklyItem(pattern);
    if (item) items.push(item);
  }
  return items.sort(compareByStartTime);
}

export function groupWeeklyItemsByDay(items) {
  const map = {};
  for (const dow of WEEK_DISPLAY_ORDER) map[dow] = [];
  for (const item of items) {
    const dow = Number(item.day_of_week);
    if (Number.isInteger(dow) && dow in map) {
      map[dow].push(item);
    }
  }
  for (const dow of WEEK_DISPLAY_ORDER) {
    map[dow] = [...map[dow]].sort(compareByStartTime);
  }
  return map;
}

export function uniqueDayInstitutionBadges(dayItems) {
  const badges = [];
  const seen = new Set();

  for (const item of dayItems) {
    if (item.source === "home_visit") {
      const key = `hv:${item.colorKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      badges.push({
        key,
        name: `가정방문 · ${item.name}`,
        theme: resolveScheduleItemTheme(item),
        isHomeVisit: true,
      });
      continue;
    }

    const key = `inst:${item.colorKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    badges.push({
      key,
      name: item.name,
      theme: resolveScheduleItemTheme(item),
      isHomeVisit: false,
    });
  }

  return badges;
}

export function buildUnifiedScheduleLegend(items) {
  const legend = [];
  const seen = new Set();

  for (const item of items) {
    const key = item.source === "home_visit"
      ? `hv:${item.colorKey}`
      : `inst:${item.colorKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const theme = resolveScheduleItemTheme(item);
    legend.push({
      key,
      label: item.source === "home_visit" ? `가정방문 · ${item.name}` : item.name,
      color: theme.dot,
    });
  }

  return legend.sort((a, b) => a.label.localeCompare(b.label, "ko"));
}

export function weekDayLabel(dow) {
  return DAY_LABELS[dow] ?? "?";
}

/** institution_monthly_contracts → institution_id: student_count */
export function mapStudentCountsByInstitution(contracts = [], yearMonth) {
  const ym = String(yearMonth || "").slice(0, 7);
  const map = {};
  for (const c of contracts) {
    const key = String(c.year_month || "").slice(0, 7);
    if (key !== ym) continue;
    if (c.student_count != null) map[c.institution_id] = c.student_count;
  }
  return map;
}

/** @deprecated use resolveScheduleItemTheme */
export function scheduleItemColor(item) {
  return resolveScheduleItemTheme(item).dot || institutionColor(item.colorKey);
}
