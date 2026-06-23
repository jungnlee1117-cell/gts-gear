#!/usr/bin/env node
/**
 * 어욱진 2026-05 payroll_entries 재정렬
 * (Sie.K 휴식 15분 DELETE, 송파폴리 방과후 2타임 45→40 UPDATE)
 *   node scripts/apply-eouk-may-payroll-fix.mjs --dry-run
 *   node scripts/apply-eouk-may-payroll-fix.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const MONTH_START = "2026-05-01";
const MONTH_END = "2026-05-31";

const BREAK_SLOT_IDS = [
  "f1cc8ce7-8530-45cd-8153-db8917962f0a", // 월 Sie.K 휴식
  "b10d7662-9ab7-41d5-939c-c11e137e4dab", // 금 Sie.K 휴식
];
const AFTER_SLOT_2_IDS = [
  "4993dee9-6f24-4da6-b65d-24941b3cf2e0", // 화 방과후 2타임
  "9a40b700-ff05-4e10-ade2-7bb546116598", // 목 방과후 2타임
];

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

const teacher = (await sb.from("teachers").select("id,name").eq("name", "어욱진").single()).data;
if (!teacher) throw new Error("어욱진 teacher not found");

// weekly schedule: delete break slots
const breakSlots = (await sb.from("institution_weekly_schedule").select("id,day_of_week,start_time,end_time")
  .eq("teacher_id", teacher.id)
  .in("id", BREAK_SLOT_IDS)).data ?? [];

const entries = (await sb.from("payroll_entries").select("*")
  .eq("teacher_id", teacher.id)
  .gte("class_date", MONTH_START)
  .lte("class_date", MONTH_END)).data ?? [];

const toDelete = entries.filter(e => BREAK_SLOT_IDS.includes(e.schedule_slot_id));
const toUpdate = entries.filter(e =>
  AFTER_SLOT_2_IDS.includes(e.schedule_slot_id)
  && e.entry_status === "as_scheduled"
  && e.minutes === 45,
);

console.log(DRY ? "=== DRY RUN (어욱진 2026-05) ===" : "=== APPLY (어욱진 2026-05) ===");
console.log("Weekly break slots to DELETE:", breakSlots.length);
for (const s of breakSlots) {
  console.log("  slot", s.id.slice(0, 8), "dow", s.day_of_week, s.start_time?.slice(0, 5), "-", s.end_time?.slice(0, 5));
}
console.log("Delete payroll entries (휴식):", toDelete.length, "rows,", toDelete.reduce((s, e) => s + e.minutes, 0), "min");
for (const e of toDelete) {
  console.log("  DELETE", e.class_date, e.schedule_slot_id?.slice(0, 8), e.minutes, "min");
}
console.log("Update 방과후 2타임 45→40:", toUpdate.length, "rows");
for (const e of toUpdate) {
  console.log("  UPDATE", e.class_date, e.schedule_slot_id?.slice(0, 8), "45→40");
}

if (DRY) process.exit(0);

if (breakSlots.length) {
  const { error } = await sb.from("institution_weekly_schedule")
    .delete()
    .in("id", BREAK_SLOT_IDS)
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
    .update({ minutes: 40, updated_at: new Date().toISOString() })
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

const pay = Math.round((reg + aft) * 766.67);
const net = Math.round(pay * 0.967);

console.log("\nDone.");
console.log("Payroll 2026-05: 정규", reg, "방과후", aft, "합", reg + aft);
console.log("예상 급여:", pay.toLocaleString(), "원 / 실수령:", net.toLocaleString(), "원");
