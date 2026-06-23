#!/usr/bin/env node
/**
 * 순환표에 있으나 items 미등록 교구 일괄 등록
 *
 *   node scripts/seed-missing-rotation-items.mjs --dry-run
 *   node scripts/seed-missing-rotation-items.mjs --force
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSeedSupabase, parseArgs, ROOT } from "./lib/seed-env.mjs";
import { normalizeItemName, resolveItemRecord } from "../src/itemRotation.js";

const { flags } = parseArgs();
const dryRun = flags.has("dry-run");
const force = flags.has("force");

const weeklyLists = JSON.parse(
  readFileSync(join(ROOT, "supabase/data/item_weekly_lists.json"), "utf8"),
);

/** 시트 교구명 → 등록 시 items.name (대부분 동일, 필요 시만 지정) */
const REGISTER_AS = {
  "애벌레징검다리": "애벌레 징검다리",
};

function collectSheetNames() {
  const names = new Set();
  for (const byLetter of Object.values(weeklyLists)) {
    for (const weeks of Object.values(byLetter)) {
      weeks.forEach(n => { if (n?.trim()) names.add(normalizeItemName(n)); });
    }
  }
  return [...names].sort();
}

function guessCategory(name) {
  if (/에어/i.test(name)) return "AIR";
  if (/징검|매트|터널|쿠션|밸런스/i.test(name)) return "BAL";
  if (/공|볼/i.test(name)) return "BALL";
  if (/라켓|축구|하키|펜싱|줄넘/i.test(name)) return "SPORT";
  return "ETC";
}

function nextCode(category, items) {
  const prefix = category;
  let max = 0;
  for (const i of items) {
    if (!i.code?.startsWith(`${prefix}-`)) continue;
    const n = parseInt(i.code.slice(prefix.length + 1), 10);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

async function main() {
  const sb = createSeedSupabase();
  const { data: items } = await sb.from("items").select("id, name, alias, code, category");
  const sheetNames = collectSheetNames();
  const missing = sheetNames.filter(n => !resolveItemRecord(items, n));

  console.log("=== 순환표 미등록 교구 ===");
  console.log(`전체 ${sheetNames.length}종 중 미등록 ${missing.length}종\n`);
  if (!missing.length) {
    console.log("등록할 교구 없음");
    return;
  }

  const toInsert = [];
  const pool = [...(items || [])];
  for (const sheetName of missing) {
    const name = REGISTER_AS[sheetName] || sheetName;
    const category = guessCategory(name);
    const code = nextCode(category, pool);
    pool.push({ code, category });
    toInsert.push({
      sheet_name: sheetName,
      code,
      name,
      alias: sheetName !== name ? sheetName : "",
      category,
      total_quantity: 1,
      branch: "사무실",
      status: "available",
    });
    console.log(`  ${sheetName}`);
    console.log(`    → code=${code}, name=${name}, category=${category}`);
  }

  if (dryRun || !force) {
    console.log(dryRun ? "\n[dry-run] DB 변경 없음" : "\n실제 등록: node scripts/seed-missing-rotation-items.mjs --force");
    return;
  }

  const { error } = await sb.from("items").insert(
    toInsert.map(({ code, name, alias, category, total_quantity, branch, status }) => ({
      code, name, alias, category, total_quantity, branch, status,
    })),
  );
  if (error) throw error;
  console.log(`\n✓ items ${toInsert.length}건 등록 완료`);
  console.log("QR 코드는 교구 시스템 > QR관리 또는 각 교구 편집에서 생성하세요.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
