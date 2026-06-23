#!/usr/bin/env node
/**
 * 구글 문서 영어체육 계획안 → monthly_lesson_plans + equipment_name_aliases
 *
 *   node scripts/seed-monthly-lesson-plans.mjs --dry-run
 *   node scripts/seed-monthly-lesson-plans.mjs --force
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSeedSupabase, parseArgs, ROOT } from "./lib/seed-env.mjs";
import {
  downloadLessonPlanText,
  parseLessonPlanDocument,
} from "./lib/lesson-plan-parse.mjs";
import { buildAliasMaps, findUnmatchedEquipment } from "../src/lessonPlan.js";
import { normalizeItemName } from "../src/itemRotation.js";

const { flags } = parseArgs();
const dryRun = flags.has("dry-run");
const force = flags.has("force");
const START_YEAR = 2026;

const aliasesJson = JSON.parse(
  readFileSync(join(ROOT, "supabase/data/equipment_name_aliases.json"), "utf8"),
);

async function main() {
  console.log("구글 문서 다운로드 중...");
  const text = await downloadLessonPlanText();
  const rows = parseLessonPlanDocument(text, START_YEAR);
  console.log(`파싱된 계획안: ${rows.length}건 (3~8월 등 문서에 있는 월)`);

  const sb = createSeedSupabase();
  const { data: weeklyLists } = await sb.from("item_weekly_lists").select("item_name");
  const weeklyKo = [...new Set((weeklyLists || []).map(w => normalizeItemName(w.item_name)).filter(Boolean))];

  const unmatched = findUnmatchedEquipment(rows, aliasesJson, weeklyKo);
  const maps = buildAliasMaps(aliasesJson);

  console.log("\n--- 샘플 (최대 8건) ---");
  rows.slice(0, 8).forEach(r => {
    const ko = maps.enToKo.get(r.equipment_name_en.toUpperCase().replace(/\s+/g, " ")) || "-";
    console.log(`  ${r.year_month.slice(0, 7)} W${r.week_number} ${r.equipment_name_en} → ${ko}`);
  });

  console.log("\n--- alias 없음 ---");
  const noAlias = unmatched.filter(u => u.type === "no_alias");
  if (!noAlias.length) console.log("  없음");
  else noAlias.forEach(u => console.log(`  ${u.year_month?.slice(0, 7)} W${u.week_number}: ${u.equipment_name_en}`));

  console.log("\n--- weekly_lists에 없는 한글명 ---");
  const notWeekly = unmatched.filter(u => u.type === "not_in_weekly_lists");
  if (!notWeekly.length) console.log("  없음");
  else notWeekly.forEach(u => console.log(`  ${u.equipment_name_en} → ${u.item_name_ko}`));

  if (dryRun) {
    console.log("\n[dry-run] DB 변경 없음");
    return;
  }

  for (const t of ["monthly_lesson_plans", "equipment_name_aliases"]) {
    const { error } = await sb.from(t).select("id").limit(1);
    if (error?.code === "42P01") {
      console.error(`\n❌ ${t} 없음 — supabase/monthly_lesson_plans.sql 실행 후 재시도`);
      process.exit(1);
    }
  }

  if (force) {
    await sb.from("monthly_lesson_plans").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await sb.from("equipment_name_aliases").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const { error: aErr } = await sb.from("equipment_name_aliases").upsert(
    aliasesJson.map(({ equipment_name_en, item_name_ko }) => ({
      equipment_name_en: equipment_name_en.trim(),
      item_name_ko: normalizeItemName(item_name_ko),
    })),
    { onConflict: "equipment_name_en" },
  );
  if (aErr) throw aErr;
  console.log(`\n✓ equipment_name_aliases ${aliasesJson.length}건`);

  const { error: pErr } = await sb.from("monthly_lesson_plans").upsert(
    rows.map(r => ({
      year_month: r.year_month,
      week_number: r.week_number,
      equipment_name_en: r.equipment_name_en,
      activity_description: r.activity_description,
      key_expressions: r.key_expressions,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "year_month,week_number" },
  );
  if (pErr) throw pErr;
  console.log(`✓ monthly_lesson_plans ${rows.length}건`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
