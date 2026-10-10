import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  buildAliasMaps,
  naturalEnglishEquipmentName,
  resolveEnglishFromKorean,
} from "../src/lessonPlan.js";
import {
  buildEnglishActivity,
  buildEnglishPurpose,
  fallbackEnglishPlanText,
  isGenericEnglishActivity,
  isGenericEnglishPurpose,
} from "../src/englishPlanSentences.js";

const ITEM_CATEGORIES = {
  AIR: "에어교구",
  BALL: "공류",
  BAL: "밸런스",
  SPORT: "스포츠",
  TOOL: "도구류",
  DIG: "디지털",
  MAT: "매트/기구",
  GROUP: "단체놀이",
  STACK: "쌓기",
  TARGET: "표적교구",
  ETC: "기타교구",
  EVENT: "이벤트",
};

function rowsOf(path) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return parsed.rows || [];
}

function hasKorean(value) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(String(value || ""));
}

function nameKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function compactKey(value) {
  return nameKey(value).replace(/[\s()（）\-_/·.]/g, "");
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

const items = rowsOf("/tmp/gts-plan-export/items.json");
const aliases = rowsOf("/tmp/gts-plan-export/aliases.json");
const uses = rowsOf("/tmp/gts-plan-export/uses.json");
const aliasMaps = buildAliasMaps(aliases);

const itemsById = new Map(items.map((item) => [item.id, {
  ...item,
  keys: new Set(),
  systemKeys: new Set(),
}]));

for (const item of itemsById.values()) {
  const dbEnglish = [];
  const fromTable = resolveEnglishFromKorean(item.name, aliasMaps);
  if (fromTable && !hasKorean(fromTable)) dbEnglish.push(fromTable);
  const alias = String(item.alias || "").trim();
  if (alias && !hasKorean(alias) && /[A-Za-z]/.test(alias)
    && !dbEnglish.some((name) => nameKey(name) === nameKey(alias))) {
    dbEnglish.push(alias);
  }
  item.dbEnglish = dbEnglish.join(" | ");
  const storedForGenerator = fromTable && !hasKorean(fromTable)
    ? fromTable
    : (alias && !hasKorean(alias) && /[A-Za-z]/.test(alias) ? alias : "");
  item.systemEnglish = naturalEnglishEquipmentName(item.name, storedForGenerator);
  for (const value of [item.name, item.alias, ...dbEnglish]) {
    for (const key of [nameKey(value), compactKey(value)]) {
      if (key) item.keys.add(key);
    }
  }
  for (const value of [item.systemEnglish, naturalEnglishEquipmentName(item.name, "")]) {
    for (const key of [nameKey(value), compactKey(value)]) {
      if (key && !item.keys.has(key)) item.systemKeys.add(key);
    }
  }
}

const primary = new Map();
const system = new Map();
for (const item of itemsById.values()) {
  for (const key of item.keys) {
    if (!primary.has(key)) primary.set(key, new Set());
    primary.get(key).add(item.id);
  }
  for (const key of item.systemKeys) {
    if (item.keys.has(key)) continue;
    if (!system.has(key)) system.set(key, new Set());
    system.get(key).add(item.id);
  }
}

const useById = new Map();
const unmatched = [];
for (const row of uses) {
  const key = nameKey(row.activity_name);
  const compact = compactKey(row.activity_name);
  const count = Number(row.uses) || 0;
  const ids = primary.get(key) || primary.get(compact);
  if (ids?.size) {
    for (const id of ids) useById.set(id, (useById.get(id) || 0) + count);
    continue;
  }
  const systemIds = system.get(key) || system.get(compact);
  if (systemIds?.size === 1) {
    const id = [...systemIds][0];
    useById.set(id, (useById.get(id) || 0) + count);
    continue;
  }
  const prefixHits = [...itemsById.values()].filter((item) => {
    const itemKey = compactKey(item.name);
    if (!compact || !itemKey || compact.length < 2 || itemKey.length < 2) return false;
    return itemKey === compact || itemKey.startsWith(compact) || compact.startsWith(itemKey);
  });
  if (prefixHits.length === 1) {
    useById.set(prefixHits[0].id, (useById.get(prefixHits[0].id) || 0) + count);
    continue;
  }
  unmatched.push({ name: row.activity_name, uses: count, candidates: systemIds?.size || prefixHits.length });
}

const ages = ["5", "6", "7"];
const table = [...itemsById.values()].map((item) => {
  const base = fallbackEnglishPlanText(item.name, item.systemEnglish);
  const suggestion = {
    name: item.name,
    englishName: item.systemEnglish,
    englishActivity: base,
  };
  const activities = Object.fromEntries(ages.map((age) => [
    age,
    buildEnglishActivity(suggestion, age, 0),
  ]));
  const purposes = Object.fromEntries(ages.map((age) => [
    age,
    buildEnglishPurpose(suggestion, age, 0),
  ]));
  const category = ITEM_CATEGORIES[item.category] || String(item.category || "").trim();
  return {
    id: item.id,
    name: item.name,
    englishName: item.dbEnglish,
    category,
    activities,
    purposes,
    activityGeneric: ages.every((age) => isGenericEnglishActivity(activities[age])),
    purposeGeneric: ages.every((age) => isGenericEnglishPurpose(purposes[age])),
    uses: useById.get(item.id) || 0,
  };
}).sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name, "ko"));

const header = [
  "교구 id",
  "한글 이름",
  "영어 이름",
  "카테고리",
  "AGE 5 ACTIVITY",
  "AGE 6 ACTIVITY",
  "AGE 7 ACTIVITY",
  "AGE 5 PURPOSE",
  "AGE 6 PURPOSE",
  "AGE 7 PURPOSE",
  "ACTIVITY 범용 fallback",
  "PURPOSE 범용 fallback",
  "선택 횟수",
];
const lines = [header.join(",")];
for (const row of table) {
  lines.push([
    row.id,
    row.name,
    row.englishName,
    row.category,
    row.activities["5"],
    row.activities["6"],
    row.activities["7"],
    row.purposes["5"],
    row.purposes["6"],
    row.purposes["7"],
    row.activityGeneric ? "예" : "",
    row.purposeGeneric ? "예" : "",
    row.uses,
  ].map(csvCell).join(","));
}

const csv = `\uFEFF${lines.join("\n")}\n`;
const outDir = "/Users/hyungsinjung/Desktop";
mkdirSync(outDir, { recursive: true });
const outPath = `${outDir}/영어_월간계획안_교구문장.csv`;
writeFileSync(outPath, csv);
const genericActivity = table.filter((row) => row.activityGeneric).length;
const genericPurpose = table.filter((row) => row.purposeGeneric).length;
const withEnglish = table.filter((row) => row.englishName).length;
const used = table.filter((row) => row.uses > 0).length;
console.log(JSON.stringify({
  outPath,
  items: table.length,
  withEnglish,
  genericActivity,
  genericPurpose,
  used,
  unmatched,
}, null, 2));
