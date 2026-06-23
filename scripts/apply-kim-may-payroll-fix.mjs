#!/usr/bin/env node
/**
 * 김종현 2026-05 payroll_entries 재정렬
 * (점심 DELETE, 화요일 방과후 DELETE, 방과후 85→80 UPDATE)
 *   node scripts/apply-kim-may-payroll-fix.mjs --dry-run
 *   node scripts/apply-kim-may-payroll-fix.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const MONTH_START = "2026-05-01";
const MONTH_END = "2026-05-31";

const LUNCH_SLOT_IDS = [
  "bde10002-016b-4f8f-bd2c-771e46aa9aa9",
  "daa6e376-9113-4daf-8260-2e2d1c9d97b1",
  "2f9ff774-43b5-426c-a893-313e07878e08",
];
const TUE_AFTER_SLOT_ID = "0cede120-a1c4-44fc-af3e-82fc01a334de";
const AFTER_SLOT_IDS = [
  "b1b4f4d7-b2ea-43b5-97ef-98c723e59a22",
  "ab712c35-59c0-446e-9187-42d84cb1231f",
];
const REMOVED_SLOT_IDS = [...LUNCH_SLOT_IDS, TUE_AFTER_SLOT_ID];

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(Boolean)
    .map(l => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const teacher = (await sb.from("teachers").select("id,name").eq("name", "김종현").single()).data;
if (!teacher) throw new Error("김종현 teacher not found");

const entries = (await sb.from("payroll_entries").select("*")
  .eq("teacher_id", teacher.id)
  .gte("class_date", MONTH_START)
  .lte("class_date", MONTH_END)).data ?? [];

const toDelete = entries.filter(e => REMOVED_SLOT_IDS.includes(e.schedule_slot_id));
const toUpdate = entries.filter(e =>
  AFTER_SLOT_IDS.includes(e.schedule_slot_id)
  && e.entry_status === "as_scheduled"
  && e.minutes === 85,
);

console.log(DRY ? "=== DRY RUN (2026-05) ===" : "=== APPLY (2026-05) ===");
console.log("Delete payroll entries:", toDelete.length, "rows,", toDelete.reduce((s, e) => s + e.minutes, 0), "min");
if (toDelete.length) {
  for (const e of toDelete) {
    console.log("  DELETE", e.class_date, e.schedule_slot_id?.slice(0, 8), e.minutes, "min");
  }
}
console.log("Update after-school 85→80:", toUpdate.length, "rows");
if (toUpdate.length) {
  for (const e of toUpdate) {
    console.log("  UPDATE", e.class_date, e.schedule_slot_id?.slice(0, 8), "85→80");
  }
}

if (DRY) process.exit(0);

if (toDelete.length) {
  const { error } = await sb.from("payroll_entries")
    .delete()
    .in("id", toDelete.map(e => e.id));
  if (error) throw error;
}

for (const e of toUpdate) {
  const { error } = await sb.from("payroll_entries")
    .update({ minutes: 80, updated_at: new Date().toISOString() })
    .eq("id", e.id);
  if (error) throw error;
}

const after = (await sb.from("payroll_entries").select("pay_type, minutes, entry_status")
  .eq("teacher_id", teacher.id)
  .gte("class_date", MONTH_START)
  .lte("class_date", MONTH_END)).data ?? [];

let reg = 0;
let aft = 0;
for (const e of after.filter(x => x.entry_status && x.minutes > 0)) {
  if (e.pay_type === "정규") reg += e.minutes;
  if (e.pay_type === "방과후") aft += e.minutes;
}

console.log("\nDone.");
console.log("Payroll 2026-05 confirmed: 정규", reg, "방과후", aft, "합", reg + aft);
console.log("구글시트 목표: 정규 2480 / 방과후 560 / 합 3040");
