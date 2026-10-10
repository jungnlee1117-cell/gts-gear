import { readFileSync, writeFileSync } from "node:fs";
import { ITEM_NAME_ALIASES, normalizeItemName, resolveItemRecord } from "../src/itemRotation.js";
import { buildAliasMaps, naturalEnglishEquipmentName, resolveEnglishFromKorean, storedEnglishEquipmentName } from "../src/lessonPlan.js";

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
  return JSON.parse(readFileSync(path, "utf8")).rows || [];
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

const items = rowsOf("/tmp/gts-plan-export/items-mini.json");
const aliases = rowsOf("/tmp/gts-plan-export/aliases.json");
const uses = rowsOf("/tmp/gts-plan-export/uses.json");
const weekly = rowsOf("/tmp/gts-plan-export/weekly.json");
const aliasMaps = buildAliasMaps(aliases);

const nameCounts = new Map();
for (const item of items) {
  const key = nameKey(item.name);
  nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
}

function englishIdentity(item) {
  const fromTable = storedEnglishEquipmentName(resolveEnglishFromKorean(item.name, aliasMaps));
  if (fromTable) return { name: fromTable, source: "별칭 표" };
  const alias = storedEnglishEquipmentName(item.alias);
  if (alias) return { name: alias, source: "영문 별칭" };
  return { name: "", source: "없음" };
}

function categoryLabel(item) {
  return ITEM_CATEGORIES[item.category] || String(item.category || "").trim();
}

function distinction(item) {
  const parts = [];
  if (item.code) parts.push(`코드 ${item.code}`);
  if (item.branch) parts.push(item.branch);
  if (item.alias) parts.push(`별칭 ${item.alias}`);
  const description = String(item.description || "").replace(/\s+/g, " ").trim();
  if (description) parts.push(description.slice(0, 40));
  if (nameCounts.get(nameKey(item.name)) > 1 && item.category) parts.push(categoryLabel(item));
  return parts.join(" · ");
}

const catalog = items.map((item) => {
  const english = englishIdentity(item);
  const generatedEnglish = naturalEnglishEquipmentName(item.name, english.name);
  const keys = new Set();
  for (const value of [item.name, item.alias, english.name]) {
    for (const key of [nameKey(value), compactKey(value)]) {
      if (key) keys.add(key);
    }
  }
  return { ...item, english, generatedEnglish, keys, uniqueUses: 0, ambiguous: false, november: false };
});

const byKey = new Map();
for (const item of catalog) {
  for (const key of item.keys) {
    if (!byKey.has(key)) byKey.set(key, new Set());
    byKey.get(key).add(item);
  }
}

const generatedByKey = new Map();
for (const item of catalog) {
  for (const key of [nameKey(item.generatedEnglish), compactKey(item.generatedEnglish)]) {
    if (!key || item.keys.has(key)) continue;
    if (!generatedByKey.has(key)) generatedByKey.set(key, new Set());
    generatedByKey.get(key).add(item);
  }
}

const CATCH_ALL_LABELS = new Set(["gts activity set"]);
const unmatchedUses = [];

function markUses(hits, count, label) {
  if (hits.length === 1) {
    hits[0].uniqueUses += count;
    return;
  }
  if (hits.length > 1 && !CATCH_ALL_LABELS.has(nameKey(label))) {
    for (const item of hits) item.ambiguous = true;
    return;
  }
  unmatchedUses.push({ name: label, uses: count, candidates: hits.length });
}

for (const row of uses) {
  const key = nameKey(row.activity_name);
  const compact = compactKey(row.activity_name);
  const count = Number(row.uses) || 0;
  const direct = byKey.get(key) || byKey.get(compact);
  if (direct?.size) {
    markUses([...direct], count, row.activity_name);
    continue;
  }
  const generated = generatedByKey.get(key) || generatedByKey.get(compact);
  if (generated?.size) {
    markUses([...generated], count, row.activity_name);
    continue;
  }
  const prefixHits = catalog.filter((item) => {
    const itemKey = compactKey(item.name);
    if (!compact || !itemKey || compact.length < 2 || itemKey.length < 2) return false;
    return itemKey === compact || itemKey.startsWith(compact) || compact.startsWith(itemKey);
  });
  if (prefixHits.length) markUses(prefixHits, count, row.activity_name);
  else unmatchedUses.push({ name: row.activity_name, uses: count, candidates: 0 });
}

function itemsForRotationName(label) {
  const raw = normalizeItemName(label);
  const alias = ITEM_NAME_ALIASES[raw];
  const names = [raw, alias].filter(Boolean).map(normalizeItemName);
  const hits = catalog.filter((item) => names.some((name) => (
    normalizeItemName(item.name) === name || normalizeItemName(item.alias) === name
  )));
  if (hits.length) return hits;
  const resolved = resolveItemRecord(items, label);
  if (!resolved) return [];
  return catalog.filter((item) => item.id === resolved.id);
}

const unmatchedRotation = [];
for (const row of weekly) {
  const hits = itemsForRotationName(row.item_name);
  if (!hits.length) {
    unmatchedRotation.push(row);
    continue;
  }
  for (const item of hits) item.november = true;
}

function useLabel(item) {
  if (item.ambiguous && item.uniqueUses > 0) return `${item.uniqueUses} · 미정`;
  if (item.ambiguous) return "미정";
  return String(item.uniqueUses);
}

function inFileA(item) {
  return item.november || item.uniqueUses > 0 || item.ambiguous;
}

const header = ["교구 id", "한글 이름", "영어 이름", "영어 이름 출처", "카테고리", "선택 횟수", "11월 순환", "구분"];

function toCsv(list) {
  const lines = [header.join(",")];
  for (const item of list) {
    lines.push([
      item.id,
      item.name,
      item.english.name,
      item.english.source,
      categoryLabel(item),
      useLabel(item),
      item.november ? "Y" : "N",
      distinction(item),
    ].map(csvCell).join(","));
  }
  return `\uFEFF${lines.join("\n")}\n`;
}

const fileA = catalog.filter(inFileA).sort((a, b) => (
  Number(b.november) - Number(a.november)
  || (b.uniqueUses + (b.ambiguous ? 1 : 0)) - (a.uniqueUses + (a.ambiguous ? 1 : 0))
  || a.name.localeCompare(b.name, "ko")
));
const fileB = catalog.filter((item) => !inFileA(item)).sort((a, b) => a.name.localeCompare(b.name, "ko"));

const outA = "/Users/hyungsinjung/Desktop/영어문장_작성대상_A_11월순환_및_선택.csv";
const outB = "/Users/hyungsinjung/Desktop/영어문장_작성대상_B_나머지.csv";
writeFileSync(outA, toCsv(fileA));
writeFileSync(outB, toCsv(fileB));

const duplicateNames = [...nameCounts.entries()].filter(([, count]) => count > 1);
console.log(JSON.stringify({
  fileA: fileA.length,
  fileAEmptyEnglish: fileA.filter((item) => !item.english.name).length,
  fileANovember: fileA.filter((item) => item.november).length,
  fileB: fileB.length,
  novemberItems: catalog.filter((item) => item.november).length,
  ambiguous: catalog.filter((item) => item.ambiguous).map((item) => item.name),
  duplicateNames,
  unmatchedUses,
}, null, 2));
