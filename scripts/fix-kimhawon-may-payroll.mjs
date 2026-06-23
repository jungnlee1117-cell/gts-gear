#!/usr/bin/env node
/**
 * 김하원 2026-05 payroll_entries를 현재 institution_weekly_schedule 기준으로 재생성
 * (schedule_slot_id 연결 — 직접추가 오표시·KAIRO 라벨 혼선 방지)
 *
 *   node scripts/fix-kimhawon-may-payroll.mjs --dry-run
 *   node scripts/fix-kimhawon-may-payroll.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { getSlotsForDate } from "../src/schedule/payrollCalendar.js";

const DRY = process.argv.includes("--dry-run");
const TEACHER_NAME = "김하원";
const MONTH_START = "2026-05-01";
const MONTH_END = "2026-05-31";
const SEED_NOTE = "fix-kimhawon-may-payroll slot-linked";

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

const teacher = (await sb.from("teachers").select("id").eq("name", TEACHER_NAME).single()).data;
if (!teacher) throw new Error("teacher not found");

const slots = (await sb.from("institution_weekly_schedule")
  .select("*, institutions(name)")
  .eq("teacher_id", teacher.id)).data ?? [];

const exceptions = (await sb.from("institution_schedule_exceptions").select("*")).data ?? [];

const existing = (await sb.from("payroll_entries")
  .select("id, class_date, pay_type, minutes, schedule_slot_id, created_at")
  .eq("teacher_id", teacher.id)
  .gte("class_date", MONTH_START)
  .lte("class_date", MONTH_END)).data ?? [];

console.log(DRY ? "=== DRY RUN ===" : "=== APPLY ===");
console.log(`Existing May entries: ${existing.length}`);

const teachingDates = [...new Set(existing.map(e => e.class_date))].sort();
if (!teachingDates.length) {
  console.log("No existing May dates — expanding full month from schedule");
  for (let d = 1; d <= 31; d++) {
    const dateStr = `2026-05-${String(d).padStart(2, "0")}`;
    const planned = getSlotsForDate(slots, new Date(`${dateStr}T12:00:00`), exceptions);
    if (planned.length) teachingDates.push(dateStr);
  }
}

const nextEntries = [];
for (const dateStr of teachingDates) {
  const planned = getSlotsForDate(slots, new Date(`${dateStr}T12:00:00`), exceptions);
  for (const p of planned) {
    nextEntries.push({
      teacher_id: teacher.id,
      institution_id: p.institutionId,
      class_date: dateStr,
      pay_type: p.payType,
      minutes: p.scheduledMinutes,
      entry_status: "as_scheduled",
      schedule_slot_id: p.slot.id,
      note: SEED_NOTE,
    });
  }
  const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(`${dateStr}T12:00:00`).getDay()];
  console.log(`${dateStr} (${dow}): ${planned.length} slots → ${planned.map(p => `${p.displayLabel} ${p.startTime}-${p.endTime}`).join(", ")}`);
}

console.log(`\nDelete ${existing.length} → Insert ${nextEntries.length}`);

const regMins = nextEntries.filter(e => e.pay_type === "정규").reduce((s, e) => s + e.minutes, 0);
const afterMins = nextEntries.filter(e => e.pay_type === "방과후").reduce((s, e) => s + e.minutes, 0);
console.log(`Total: 정규 ${regMins}분, 방과후 ${afterMins}분`);

if (DRY) process.exit(0);

const { error: delErr } = await sb.from("payroll_entries")
  .delete()
  .eq("teacher_id", teacher.id)
  .gte("class_date", MONTH_START)
  .lte("class_date", MONTH_END);
if (delErr) throw delErr;

const { error: insErr } = await sb.from("payroll_entries").insert(nextEntries);
if (insErr) throw insErr;

console.log("Done.");
