#!/usr/bin/env node
/**
 * 안소연 엘란어학원 방과후 스케줄 16:40→16:20 + 5·6월 payroll 100→80분
 *   node scripts/apply-ansoyoen-payroll-fix.mjs --dry-run
 *   node scripts/apply-ansoyoen-payroll-fix.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const RANGE_START = "2026-05-01";
const RANGE_END = "2026-06-30";

const AFTER_SLOT_IDS = [
  "7ee70007-2f76-4ce0-aafa-2a06b32aa6f4", // 월 엘란 방과후
  "40e7e131-5cf5-48e7-80cb-a5462fe896d3", // 금 엘란 방과후
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

const teacher = (await sb.from("teachers").select("id,name").eq("name", "안소연").single()).data;
if (!teacher) throw new Error("안소연 teacher not found");

const slots = (await sb.from("institution_weekly_schedule").select("id,day_of_week,end_time")
  .eq("teacher_id", teacher.id)
  .in("id", AFTER_SLOT_IDS)).data ?? [];

console.log(DRY ? "=== DRY RUN ===" : "=== APPLY ===");
console.log("Weekly slots to fix end_time→16:20:", slots.length);
for (const s of slots) {
  console.log("  slot", s.id.slice(0, 8), "dow", s.day_of_week, "end", s.end_time?.slice(0, 5));
}

const entries = (await sb.from("payroll_entries").select("*")
  .eq("teacher_id", teacher.id)
  .gte("class_date", RANGE_START)
  .lte("class_date", RANGE_END)).data ?? [];

const toUpdate = entries.filter(e =>
  AFTER_SLOT_IDS.includes(e.schedule_slot_id)
  && e.entry_status === "as_scheduled"
  && e.minutes === 100,
);

console.log("Payroll UPDATE 100→80:", toUpdate.length, "rows");
for (const e of toUpdate) {
  console.log("  UPDATE", e.class_date, e.schedule_slot_id?.slice(0, 8), "100→80");
}

if (DRY) process.exit(0);

for (const slotId of AFTER_SLOT_IDS) {
  const { error } = await sb.from("institution_weekly_schedule")
    .update({ end_time: "16:20:00" })
    .eq("id", slotId)
    .eq("teacher_id", teacher.id);
  if (error) throw error;
}

for (const e of toUpdate) {
  const { error } = await sb.from("payroll_entries")
    .update({ minutes: 80, updated_at: new Date().toISOString() })
    .eq("id", e.id);
  if (error) throw error;
}

const after = (await sb.from("payroll_entries").select("pay_type, minutes, entry_status, class_date")
  .eq("teacher_id", teacher.id)
  .gte("class_date", RANGE_START)
  .lte("class_date", RANGE_END)
  .in("schedule_slot_id", AFTER_SLOT_IDS)).data ?? [];

let aft = 0;
for (const e of after.filter(x => x.entry_status && x.minutes > 0 && x.pay_type === "방과후")) {
  aft += e.minutes;
}

console.log("\nDone.");
console.log("방과후 슬롯 entries (5~6월):", after.length, "방과후 합계", aft, "분");
