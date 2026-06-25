#!/usr/bin/env node
/**
 * 공다연 · 대치폴리 · 월 방과후 2슬롯 삭제 + payroll_entries 정리
 *   node scripts/apply-gongdayeon-monday-after-delete.mjs --dry-run
 *   node scripts/apply-gongdayeon-monday-after-delete.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");

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

const teacher = (await sb.from("teachers").select("id,name").eq("name", "공다연").single()).data;
if (!teacher) throw new Error("공다연 teacher not found");

const inst = (await sb.from("institutions").select("id,name").ilike("name", "%대치%")).data?.[0];
if (!inst) throw new Error("대치폴리 institution not found");

const slots = (await sb.from("institution_weekly_schedule").select("id, start_time, end_time")
  .eq("teacher_id", teacher.id)
  .eq("institution_id", inst.id)
  .eq("day_of_week", 1)
  .eq("class_type", "방과후")
  .in("start_time", ["15:00:00", "15:45:00"])
  .order("start_time")).data ?? [];

if (slots.length !== 2) {
  console.error("Expected 2 Monday after-school slots, found:", slots.length, slots);
  process.exit(1);
}

const slotIds = slots.map(s => s.id);
const entries = (await sb.from("payroll_entries").select("id, class_date, minutes, entry_status, schedule_slot_id")
  .eq("teacher_id", teacher.id)
  .in("schedule_slot_id", slotIds)
  .order("class_date")).data ?? [];

console.log(DRY ? "=== DRY RUN ===" : "=== APPLY ===");
console.log(`Teacher: ${teacher.name}, Institution: ${inst.name}`);
for (const s of slots) {
  console.log(`  Delete slot: ${s.start_time?.slice(0, 5)}~${s.end_time?.slice(0, 5)} (${s.id})`);
}
console.log(`Delete payroll_entries: ${entries.length} rows (${entries.reduce((sum, e) => sum + e.minutes, 0)} min)`);
for (const e of entries) {
  console.log(`  ${e.class_date} ${e.minutes}min ${e.entry_status} (${e.schedule_slot_id.slice(0, 8)}…)`);
}

if (DRY) process.exit(0);

if (entries.length) {
  const { error: peErr } = await sb.from("payroll_entries")
    .delete()
    .in("id", entries.map(e => e.id));
  if (peErr) throw peErr;
}

const { error: slotErr } = await sb.from("institution_weekly_schedule")
  .delete()
  .in("id", slotIds)
  .eq("teacher_id", teacher.id);
if (slotErr) throw slotErr;

const remaining = (await sb.from("institution_weekly_schedule").select("day_of_week, class_type, start_time, end_time")
  .eq("teacher_id", teacher.id)
  .order("day_of_week")
  .order("start_time")).data ?? [];

const leftoverPe = (await sb.from("payroll_entries").select("id")
  .eq("teacher_id", teacher.id)
  .in("schedule_slot_id", slotIds)).data ?? [];

console.log("\nDone.");
console.log("Remaining weekly slots:", remaining.length);
for (const s of remaining) {
  const day = ["", "월", "화", "수", "목", "금", "토", "일"][s.day_of_week];
  console.log(`  ${day} ${s.class_type} ${s.start_time?.slice(0, 5)}~${s.end_time?.slice(0, 5)}`);
}
console.log("Leftover payroll entries for deleted slots:", leftoverPe.length);
