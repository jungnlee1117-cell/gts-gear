import {
  AIRBRIDGE_SCRIPTS,
  GEAR_LABEL as AIRBRIDGE_LABEL,
} from "./airbridgeScriptData.js";
import {
  BALANCE_BOARD_ACTIVITIES,
  BALANCE_BOARD_INTRO,
  BALANCE_BOARD_CLOSING,
  BALANCE_BOARD_SAFETY,
} from "./balanceBoardScriptData.js";
import {
  AIR_CLIMBING_MAT_ACTIVITIES,
  AIR_CLIMBING_MAT_SAFETY,
} from "./airClimbingMatScriptData.js";

export const ITEM_CATEGORIES = {
  AIR: { label: "에어교구", color: "#0891b2" },
  BALL: { label: "공류", color: "#ea580c" },
  BAL: { label: "밸런스", color: "#059669" },
  SPORT: { label: "스포츠", color: "#2563eb" },
  TOOL: { label: "도구류", color: "#7c3aed" },
  DIG: { label: "디지털", color: "#db2777" },
  MAT: { label: "매트/기구", color: "#65a30d" },
  GROUP: { label: "단체놀이", color: "#d97706" },
  STACK: { label: "쌓기", color: "#8b5cf6" },
  TARGET: { label: "표적교구", color: "#0d9488" },
  ETC: { label: "기타교구", color: "#7c3aed" },
};

export const GEAR_CATALOG = [
  {
    id: "air-bridge",
    label: AIRBRIDGE_LABEL,
    desc: "Level 1~3 단계별 8개 섹션 · 대화형 수업 스크립트",
    type: "sections",
    matchPatterns: ["에어브릿지", "에어 브릿지", "air bridge", "airbridge"],
  },
  {
    id: "balance-board",
    label: "밸런스보드",
    desc: "9가지 활동 순서대로 진행 · 난이도별 영어 표현",
    type: "activities",
    matchPatterns: ["밸런스보드", "밸런스 보드", "balance board", "balanceboard"],
  },
  {
    id: "air-climbing-mat",
    label: "에어 둥글 클라이밍 매트",
    desc: "5가지 핵심 활동 · 현장 호흡 대본",
    type: "activities",
    matchPatterns: [
      "에어 둥글",
      "에어둥글",
      "둥글매트",
      "클라이밍매트",
      "클라이밍 매트",
      "air climbing mat",
      "airclimbingmat",
    ],
  },
];

export const ACTIVITY_GEAR_SCRIPTS = {
  "balance-board": {
    intro: BALANCE_BOARD_INTRO,
    activities: BALANCE_BOARD_ACTIVITIES,
    closing: BALANCE_BOARD_CLOSING,
    safety: BALANCE_BOARD_SAFETY,
    introTagSuffix: "마법의 보드",
  },
  "air-climbing-mat": {
    activitiesOnly: true,
    cardLinesFormat: true,
    activities: AIR_CLIMBING_MAT_ACTIVITIES,
    safety: AIR_CLIMBING_MAT_SAFETY,
  },
};

const LEVEL_IDS = ["foundation", "interactive", "inquiry"];

const PHOTO_POSITION_PRESETS = {
  "center top": "50% 0%",
  "center center": "50% 50%",
  "center bottom": "50% 100%",
  "left center": "0% 50%",
  "right center": "100% 50%",
};

export function resolveItemPhotoPosition(item) {
  const raw = item?.photo_position || "50% 50%";
  return PHOTO_POSITION_PRESETS[raw] || raw;
}

function compactText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function countAirbridgeLevel(levelId) {
  return (AIRBRIDGE_SCRIPTS[levelId] ?? []).reduce(
    (sum, section) => sum + section.script.length,
    0,
  );
}

function countActivityGearLevel(gearId, levelId) {
  const data = ACTIVITY_GEAR_SCRIPTS[gearId];
  if (!data) return 0;

  const countScript = script => (script ?? []).reduce(
    (sum, line) => sum + (line.lines?.[levelId] ? 1 : 0),
    0,
  );

  let total = 0;
  if (data.intro?.script) total += countScript(data.intro.script);
  total += data.activities.reduce((sum, act) => sum + countScript(act.script), 0);
  if (data.closing?.script) total += countScript(data.closing.script);
  return total;
}

function countBalanceBoardLevel(levelId) {
  return countActivityGearLevel("balance-board", levelId);
}

function countAirClimbingMatLevel(levelId) {
  return countActivityGearLevel("air-climbing-mat", levelId);
}

const EXPRESSION_COUNTERS = {
  "air-bridge": countAirbridgeLevel,
  "balance-board": countBalanceBoardLevel,
  "air-climbing-mat": countAirClimbingMatLevel,
};

export function normalizeItemCategory(cat) {
  if (cat === "SPC") return "ETC";
  return cat || "ETC";
}

export function getCategoryMeta(cat) {
  const key = normalizeItemCategory(cat);
  if (ITEM_CATEGORIES[key]) return { key, ...ITEM_CATEGORIES[key] };
  return { key, label: cat || "기타", color: "#94a3b8" };
}

export function getExpressionCounts(gearId) {
  const counter = EXPRESSION_COUNTERS[gearId];
  if (!counter) {
    return { foundation: 0, interactive: 0, inquiry: 0 };
  }
  return {
    foundation: counter("foundation"),
    interactive: counter("interactive"),
    inquiry: counter("inquiry"),
  };
}

export function getTotalExpressionCount(gearId) {
  const counts = getExpressionCounts(gearId);
  return counts.foundation + counts.interactive + counts.inquiry;
}

export function matchGearId(item) {
  const haystack = compactText(`${item?.name || ""} ${item?.alias || ""}`);
  if (!haystack) return null;

  for (const gear of GEAR_CATALOG) {
    const matched = gear.matchPatterns.some(pattern => haystack.includes(compactText(pattern)));
    if (matched) return gear.id;
  }
  return null;
}

export function getActivityGearScripts(gearId) {
  return ACTIVITY_GEAR_SCRIPTS[gearId] ?? null;
}

export function getGearCatalogEntry(gearId) {
  return GEAR_CATALOG.find(g => g.id === gearId) ?? null;
}

export function computeGearPickerStats(items) {
  const matchedGearIds = new Set();
  let matchedItemCount = 0;

  for (const item of items) {
    const gearId = matchGearId(item);
    if (gearId) {
      matchedGearIds.add(gearId);
      matchedItemCount += 1;
    }
  }

  const totalExpressions = GEAR_CATALOG.reduce(
    (sum, gear) => sum + getTotalExpressionCount(gear.id),
    0,
  );

  return {
    totalItems: items.length,
    totalScripts: matchedGearIds.size,
    matchedItemCount,
    totalExpressions,
  };
}

export function buildCategoryTabs(items) {
  const counts = new Map();
  for (const item of items) {
    const key = normalizeItemCategory(item.category);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      label: getCategoryMeta(key).label,
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
}

export { LEVEL_IDS };
