#!/usr/bin/env node
/**
 * 교구 순환 데이터 시드 + 정합성 점검
 *
 *   node scripts/seed-item-rotation.mjs --dry-run
 *   node scripts/seed-item-rotation.mjs --validate-only
 *   node scripts/seed-item-rotation.mjs --force
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createSeedSupabase, parseArgs, ROOT, envValue } from "./lib/seed-env.mjs";
import {
  isAirProductName,
  letterForTeacherMonth,
  normalizeItemName,
  resolveItemRecord,
  schoolYearMonths,
} from "../src/itemRotation.js";

const { flags } = parseArgs();
const dryRun = flags.has("dry-run");
const validateOnly = flags.has("validate-only");
const force = flags.has("force");
const START_YEAR = 2026;

const weeklyLists = JSON.parse(
  readFileSync(join(ROOT, "supabase/data/item_weekly_lists.json"), "utf8"),
);
const teacherOrder = JSON.parse(
  readFileSync(join(ROOT, "supabase/data/item_rotation_teachers.json"), "utf8"),
);

function expandWeeklyRows() {
  const rows = [];
  for (const [targetType, byLetter] of Object.entries(weeklyLists)) {
    for (const [letter, weeks] of Object.entries(byLetter)) {
      weeks.forEach((itemName, i) => {
        if (!itemName?.trim()) return;
        const weekNumber = i + 1;
        rows.push({
          letter,
          week_number: weekNumber,
          target_type: targetType,
          item_name: normalizeItemName(itemName),
          is_air_product: isAirProductName(itemName, weekNumber),
        });
      });
    }
  }
  return rows;
}

function buildTeachersByName(teachers) {
  const map = new Map((teachers || []).map(t => [t.name, t]));
  for (const [sheetName, dbName] of Object.entries({
    레이첼: "양의인",
    마이크: "오정석",
  })) {
    const teacher = map.get(dbName);
    if (teacher) map.set(sheetName, teacher);
  }
  const superAdminId = envValue("VITE_SUPER_ADMIN_ID");
  const superAdmin = (teachers || []).find(t => t.id === superAdminId)
    || (teachers || []).find(t => t.role === "superadmin");
  if (superAdmin) {
    map.set("정티처", superAdmin);
  }
  return { map, superAdmin };
}

function buildRotationRows(teachersByName) {
  const months = schoolYearMonths(START_YEAR);
  const rows = [];
  const warnings = [];

  teacherOrder.forEach((name, teacherIndex) => {
    const teacher = teachersByName.get(name);
    if (!teacher) {
      warnings.push(`강사 없음 (순환표 스킵): ${name}`);
      return;
    }
    months.forEach((ym, monthIndex) => {
      rows.push({
        teacher_id: teacher.id,
        teacher_name: name,
        year_month: `${ym}-01`,
        assigned_letter: letterForTeacherMonth(teacherIndex, monthIndex),
      });
    });
  });
  return { rows, warnings };
}

function findDuplicateItemsInMonth(rotationRows, weeklyRows) {
  const months = [...new Set(rotationRows.map(r => r.year_month))];
  const dupes = [];

  for (const ym of months) {
    const assignments = rotationRows.filter(r => r.year_month === ym);
    const itemToTeachers = new Map();

    for (const a of assignments) {
      const items = weeklyRows.filter(w => w.letter === a.assigned_letter);
      for (const w of items) {
        const key = `${w.target_type}|${w.item_name}`;
        if (!itemToTeachers.has(key)) itemToTeachers.set(key, []);
        itemToTeachers.get(key).push({
          teacher: a.teacher_name,
          letter: a.assigned_letter,
          week: w.week_number,
          target_type: w.target_type,
        });
      }
    }

    for (const [key, holders] of itemToTeachers) {
      const teachers = [...new Set(holders.map(h => h.teacher))];
      if (teachers.length > 1) {
        const [target_type, item_name] = key.split("|");
        dupes.push({ year_month: ym, item_name, target_type, teachers, holders });
      }
    }
  }
  return dupes;
}

function findUnmatchedItems(weeklyRows, items) {
  const unmatched = [];
  const seen = new Set();
  for (const w of weeklyRows) {
    if (seen.has(w.item_name)) continue;
    seen.add(w.item_name);
    const rec = resolveItemRecord(items, w.item_name);
    if (!rec) unmatched.push(w.item_name);
  }
  return unmatched.sort();
}

async function main() {
  const sb = createSeedSupabase();
  const weeklyRows = expandWeeklyRows();

  const { data: teachers } = await sb.from("teachers").select("id, name, role").eq("active", true);
  const { map: teachersByName, superAdmin } = buildTeachersByName(teachers);
  const { rows: rotationRows, warnings: teacherWarnings } = buildRotationRows(teachersByName);

  if (superAdmin) {
    console.log(`정티처 → ${superAdmin.name} (${superAdmin.id})`);
  }

  const { data: items } = await sb.from("items").select("id, name, alias, total_quantity");
  const unmatched = findUnmatchedItems(weeklyRows, items || []);
  const dupes = findDuplicateItemsInMonth(rotationRows, weeklyRows);

  console.log("=== 교구 순환 시드 미리보기 ===");
  console.log(`주차별 교구 목록: ${weeklyRows.length}행`);
  console.log(`순환 배정: ${rotationRows.length}행 (${teacherOrder.length}명 × 12개월)`);

  if (teacherWarnings.length) {
    console.log("\n--- 강사 매칭 경고 ---");
    teacherWarnings.forEach(w => console.log(" ", w));
  }

  console.log("\n--- 이름 불일치 (items 테이블에 없음) ---");
  if (!unmatched.length) console.log("  없음");
  else unmatched.forEach(n => console.log(" ", n));

  console.log("\n--- 같은 달 중복 교구 (서로 다른 강사) ---");
  if (!dupes.length) console.log("  없음");
  else {
    for (const d of dupes.slice(0, 30)) {
      console.log(`  ${d.year_month.slice(0, 7)} [${d.target_type}] ${d.item_name}`);
      console.log(`    → ${d.teachers.join(", ")}`);
    }
    if (dupes.length > 30) console.log(`  ... 외 ${dupes.length - 30}건`);
  }

  console.log("\n샘플 순환 (2026-06):");
  rotationRows
    .filter(r => r.year_month.startsWith("2026-06"))
    .forEach(r => console.log(`  ${r.teacher_name}: ${r.assigned_letter}`));

  if (validateOnly || dryRun) {
    console.log(dryRun ? "\n[dry-run] DB 변경 없음" : "\n[validate-only] 완료");
    return;
  }

  if (unmatched.length && !force) {
    console.log("\n❌ 이름 불일치가 있습니다. ITEM_NAME_ALIASES 보완 후 --force 로 진행하세요.");
    process.exit(1);
  }

  const tables = ["item_rotation_schedule", "item_weekly_lists", "item_rotation_month_weeks"];
  for (const t of tables) {
    const { count, error } = await sb.from(t).select("id", { count: "exact", head: true });
    if (error?.code === "42P01") {
      console.error(`\n❌ 테이블 ${t} 없음 — supabase/item_rotation.sql 을 먼저 실행하세요.`);
      process.exit(1);
    }
    if (count > 0 && !force) {
      console.error(`\n❌ ${t}에 ${count}건 존재. --force 로 덮어쓰기`);
      process.exit(1);
    }
  }

  if (force) {
    await sb.from("item_rotation_schedule").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await sb.from("item_weekly_lists").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await sb.from("item_rotation_month_weeks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const { error: wErr } = await sb.from("item_weekly_lists").insert(
    weeklyRows.map(({ letter, week_number, target_type, item_name, is_air_product }) => ({
      letter, week_number, target_type, item_name, is_air_product,
    })),
  );
  if (wErr) throw wErr;
  console.log(`✓ item_weekly_lists ${weeklyRows.length}건`);

  const { error: rErr } = await sb.from("item_rotation_schedule").insert(
    rotationRows.map(({ teacher_id, year_month, assigned_letter }) => ({
      teacher_id, year_month, assigned_letter,
    })),
  );
  if (rErr) throw rErr;
  console.log(`✓ item_rotation_schedule ${rotationRows.length}건`);

  const monthWeeksFile = join(ROOT, "supabase/data/item_rotation_month_weeks.json");
  if (existsSync(monthWeeksFile)) {
    const monthWeeksData = JSON.parse(readFileSync(monthWeeksFile, "utf8"));
    const weekRows = [];
    for (const [ym, weeks] of Object.entries(monthWeeksData)) {
      for (const w of weeks) {
        weekRows.push({
          year_month: `${ym}-01`,
          week_number: w.week_number,
          week_start_date: w.week_start_date,
          week_end_date: w.week_end_date,
        });
      }
    }
    if (weekRows.length) {
      const { error: mwErr } = await sb.from("item_rotation_month_weeks").insert(weekRows);
      if (mwErr) throw mwErr;
      console.log(`✓ item_rotation_month_weeks ${weekRows.length}건`);
    }
  }

  console.log("\n완료.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
