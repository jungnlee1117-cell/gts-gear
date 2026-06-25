#!/usr/bin/env node
/**
 * 윤한경 · 프랜시스파커 · 화 방과후 스케줄 수정
 *   node scripts/apply-yoonhankyeong-schedule-fix.mjs --dry-run
 *   node scripts/apply-yoonhankyeong-schedule-fix.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const path = join(ROOT, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      process.env[t.slice(0, i)] = t.slice(i + 1);
    }
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const sb = createClient(url, key);

const teacher = (await sb.from("teachers").select("id,name").eq("name", "윤한경").single()).data;
if (!teacher) throw new Error("윤한경 teacher not found");

const inst = (await sb.from("institutions").select("id,name").ilike("name", "%프랜시스%")).data?.[0];
if (!inst) throw new Error("프랜시스파커 institution not found");

const slots = (await sb.from("institution_weekly_schedule").select("*")
  .eq("teacher_id", teacher.id)
  .eq("institution_id", inst.id)
  .eq("day_of_week", 2)
  .eq("class_type", "방과후")
  .order("start_time")).data ?? [];

console.log("Current slots:", slots.map(s => `${s.start_time?.slice(0, 5)}~${s.end_time?.slice(0, 5)} (${s.id})`));

const slot1 = slots.find(s => s.start_time?.startsWith("14:5") || s.start_time?.startsWith("14:50"));
const slot2 = slots.find(s => s.start_time >= "15:20:00" || s.start_time?.startsWith("15:2"));

if (!slot1 || !slot2) {
  console.error("Expected 2 Tuesday after-school slots, found:", slots.length);
  process.exit(1);
}

const payrollUpdates = (await sb.from("payroll_entries").select("id, class_date, minutes")
  .eq("teacher_id", teacher.id)
  .eq("schedule_slot_id", slot2.id)
  .eq("entry_status", "as_scheduled")
  .eq("minutes", 50)).data ?? [];

console.log(DRY ? "=== DRY RUN ===" : "=== APPLY ===");
console.log("Slot1 → 14:50~15:20 (30min)");
console.log("Slot2 → 15:25~16:10 (45min), payroll 50→45:", payrollUpdates.length, "rows");

if (DRY) process.exit(0);

const { error: e1 } = await sb.from("institution_weekly_schedule")
  .update({ start_time: "14:50:00", end_time: "15:20:00" })
  .eq("id", slot1.id);
if (e1) throw e1;

const { error: e2 } = await sb.from("institution_weekly_schedule")
  .update({ start_time: "15:25:00", end_time: "16:10:00" })
  .eq("id", slot2.id);
if (e2) throw e2;

if (payrollUpdates.length) {
  const { error: pe } = await sb.from("payroll_entries")
    .update({ minutes: 45, updated_at: new Date().toISOString() })
    .in("id", payrollUpdates.map(r => r.id));
  if (pe) throw pe;
}

const verify = (await sb.from("institution_weekly_schedule").select("start_time,end_time")
  .eq("teacher_id", teacher.id)
  .eq("institution_id", inst.id)
  .eq("day_of_week", 2)
  .eq("class_type", "방과후")
  .order("start_time")).data ?? [];

console.log("\nDone. Verified:");
for (const s of verify) {
  console.log(`  ${s.start_time?.slice(0, 5)}~${s.end_time?.slice(0, 5)}`);
}
