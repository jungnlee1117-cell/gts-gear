#!/usr/bin/env node
/**
 * 안소연 리비어 수요일 점심(11:10~12:40) 정규 슬롯 제거 + payroll 삭제
 *   node scripts/apply-ansoyoen-wed-lunch-fix.mjs --dry-run
 *   node scripts/apply-ansoyoen-wed-lunch-fix.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const LUNCH_SLOT_ID = "7822ed18-efb8-43f5-8736-c22c085995b5";
const RANGE_START = "2026-05-01";
const RANGE_END = "2026-06-30";

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

const slot = (await sb.from("institution_weekly_schedule").select("*")
  .eq("id", LUNCH_SLOT_ID)
  .eq("teacher_id", teacher.id)
  .maybeSingle()).data;

const toDelete = (await sb.from("payroll_entries").select("*")
  .eq("teacher_id", teacher.id)
  .eq("schedule_slot_id", LUNCH_SLOT_ID)
  .gte("class_date", RANGE_START)
  .lte("class_date", RANGE_END)
  .order("class_date")).data ?? [];

console.log(DRY ? "=== DRY RUN ===" : "=== APPLY ===");
console.log("점심 슬롯 (11:10~12:40):", slot
  ? `${slot.start_time?.slice(0, 5)}~${slot.end_time?.slice(0, 5)} ${slot.class_type}`
  : "already removed");
console.log("Payroll DELETE:", toDelete.length, "rows");
for (const e of toDelete) {
  console.log("  DELETE", e.class_date, e.minutes, "min", e.entry_status);
}

if (DRY) process.exit(0);

if (slot) {
  const { error } = await sb.from("institution_weekly_schedule")
    .delete()
    .eq("id", LUNCH_SLOT_ID)
    .eq("teacher_id", teacher.id);
  if (error) throw error;
}

for (const e of toDelete) {
  const { error } = await sb.from("payroll_entries").delete().eq("id", e.id);
  if (error) throw error;
}

const wedSlots = (await sb.from("institution_weekly_schedule").select("start_time,end_time,class_type")
  .eq("teacher_id", teacher.id)
  .eq("day_of_week", 3)
  .order("start_time")).data ?? [];

console.log("\nDone. 수요일 정규 슬롯:", wedSlots.length, "개");
for (const s of wedSlots) {
  console.log(" ", s.start_time?.slice(0, 5), "~", s.end_time?.slice(0, 5), s.class_type);
}

const wedPay = (await sb.from("payroll_entries").select("class_date,minutes,schedule_slot_id")
  .eq("teacher_id", teacher.id)
  .gte("class_date", RANGE_START)
  .lte("class_date", RANGE_END)).data ?? [];

let wedTotal = 0;
for (const e of wedPay) {
  const d = new Date(`${e.class_date}T12:00:00`);
  if (d.getDay() === 3 && e.minutes > 0) wedTotal += e.minutes;
}
console.log("5~6월 수요일 payroll 합계:", wedTotal, "분");
