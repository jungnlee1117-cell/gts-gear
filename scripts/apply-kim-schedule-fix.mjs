#!/usr/bin/env node
/**
 * 김종현 주간 스케줄 수정 + 6/1~6/18 payroll_entries 재정렬
 *   node scripts/apply-kim-schedule-fix.mjs --dry-run
 *   node scripts/apply-kim-schedule-fix.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");

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
  .gte("class_date", "2026-06-01")
  .lte("class_date", "2026-06-18")).data ?? [];

const toDelete = entries.filter(e => REMOVED_SLOT_IDS.includes(e.schedule_slot_id));
const toUpdate = entries.filter(e =>
  AFTER_SLOT_IDS.includes(e.schedule_slot_id)
  && e.entry_status === "as_scheduled"
  && e.minutes === 85,
);

console.log(DRY ? "=== DRY RUN ===" : "=== APPLY ===");
console.log("Delete payroll entries:", toDelete.length, "rows,", toDelete.reduce((s, e) => s + e.minutes, 0), "min");
console.log("Update after-school 85→80:", toUpdate.length, "rows");

if (DRY) {
  console.log("\nWould update after-school slots end_time → 16:20:00");
  console.log("Would delete weekly slots:", REMOVED_SLOT_IDS.length);
  process.exit(0);
}

for (const id of AFTER_SLOT_IDS) {
  const { error } = await sb.from("institution_weekly_schedule")
    .update({ end_time: "16:20:00" })
    .eq("id", id)
    .eq("teacher_id", teacher.id);
  if (error) throw error;
}

for (const id of REMOVED_SLOT_IDS) {
  const { error } = await sb.from("institution_weekly_schedule")
    .delete()
    .eq("id", id)
    .eq("teacher_id", teacher.id);
  if (error) throw error;
}

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
  .gte("class_date", "2026-06-01")
  .lte("class_date", "2026-06-18")).data ?? [];

let reg = 0;
let aft = 0;
for (const e of after.filter(x => x.entry_status && x.minutes > 0)) {
  if (e.pay_type === "정규") reg += e.minutes;
  if (e.pay_type === "방과후") aft += e.minutes;
}

const slotsLeft = (await sb.from("institution_weekly_schedule").select("id, day_of_week, class_type, start_time, end_time")
  .eq("teacher_id", teacher.id)).data ?? [];

console.log("\nDone.");
console.log("Weekly slots remaining:", slotsLeft.length);
console.log("Payroll 6/1~6/18 confirmed: 정규", reg, "방과후", aft, "합", reg + aft);
