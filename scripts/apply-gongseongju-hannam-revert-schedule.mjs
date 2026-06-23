#!/usr/bin/env node
/**
 * 공성주 한남센터 센터보조 시간 복원
 *   월: 15:30-16:30 / 16:30-17:30 / 17:30-18:30
 *   화: 15:30-16:30 / 16:30-17:30
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const TEACHER_NAME = "공성주";
const INST_NAME = "한남센터";
const JUNE_START = "2026-06-01";
const BILLABLE = 60;

const SLOT_SPECS = [
  { day: 1, label: "센터보조 1타임", start: "15:30:00", end: "16:30:00" },
  { day: 1, label: "센터보조 2타임", start: "16:30:00", end: "17:30:00" },
  { day: 1, label: "센터보조 3타임", start: "17:30:00", end: "18:30:00" },
  { day: 2, label: "센터보조 1타임", start: "15:30:00", end: "16:30:00" },
  { day: 2, label: "센터보조 2타임", start: "16:30:00", end: "17:30:00" },
];

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter(Boolean).map(l => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1)];
  }),
);
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const teacher = (await sb.from("teachers").select("id").eq("name", TEACHER_NAME).single()).data;
const inst = (await sb.from("institutions").select("id").eq("name", INST_NAME).single()).data;
if (!teacher || !inst) throw new Error("teacher or institution not found");

let slots = (await sb.from("institution_weekly_schedule").select("*")
  .eq("teacher_id", teacher.id).eq("institution_id", inst.id).eq("class_type", "방과후")).data ?? [];

const dow = d => ["일", "월", "화", "수", "목", "금", "토"][d];
console.log(DRY ? "=== DRY RUN ===" : "=== APPLY ===");

function findTueSlot(slots, label) {
  if (label === "센터보조 1타임") {
    return slots.find(s => s.day_of_week === 2 && (s.label === "센터보조 1타임" || s.label === "센터보조 1타임×2"));
  }
  return slots.find(s => s.day_of_week === 2 && s.label === label);
}

for (const spec of SLOT_SPECS) {
  let slot = spec.day === 2
    ? findTueSlot(slots, spec.label)
    : slots.find(s => s.day_of_week === spec.day && s.label === spec.label);

  if (!slot && spec.day === 2 && spec.label === "센터보조 2타임") {
    console.log(`  INSERT ${dow(spec.day)} ${spec.label} ${spec.start.slice(0, 5)}-${spec.end.slice(0, 5)}`);
    if (!DRY) {
      const { data, error } = await sb.from("institution_weekly_schedule").insert({
        institution_id: inst.id,
        teacher_id: teacher.id,
        day_of_week: spec.day,
        class_type: "방과후",
        start_time: spec.start,
        end_time: spec.end,
        label: spec.label,
      }).select().single();
      if (error) throw error;
      slot = data;
      slots.push(data);
    }
    continue;
  }

  if (!slot) {
    console.warn(`  MISSING ${dow(spec.day)} ${spec.label}`);
    continue;
  }

  console.log(
    `  UPDATE ${dow(spec.day)} ${spec.label}`,
    `${slot.start_time?.slice(0, 5)}-${slot.end_time?.slice(0, 5)}`,
    `→ ${spec.start.slice(0, 5)}-${spec.end.slice(0, 5)}`,
  );
  if (!DRY) {
    const { error } = await sb.from("institution_weekly_schedule")
      .update({ start_time: spec.start, end_time: spec.end, label: spec.label })
      .eq("id", slot.id);
    if (error) throw error;
  }
}

if (!DRY) {
  slots = (await sb.from("institution_weekly_schedule").select("*")
    .eq("teacher_id", teacher.id).eq("institution_id", inst.id).eq("class_type", "방과후")).data ?? [];
}

const tue1 = findTueSlot(slots, "센터보조 1타임");
const tue2 = slots.find(s => s.day_of_week === 2 && s.label === "센터보조 2타임");

const junePe = (await sb.from("payroll_entries").select("*")
  .eq("teacher_id", teacher.id).eq("institution_id", inst.id)
  .gte("class_date", JUNE_START)).data ?? [];

let peUpdates = 0;
let peInserts = 0;

for (const e of junePe) {
  const slot = slots.find(s => s.id === e.schedule_slot_id)
    ?? (e.schedule_slot_id === tue1?.id ? tue1 : null);
  if (!slot?.label?.startsWith("센터보조")) continue;
  if (e.minutes !== BILLABLE) {
    console.log(`  payroll ${e.class_date} ${slot.label}: ${e.minutes} → ${BILLABLE}분`);
    peUpdates++;
    if (!DRY) {
      const { error } = await sb.from("payroll_entries")
        .update({ minutes: BILLABLE, updated_at: new Date().toISOString() })
        .eq("id", e.id);
      if (error) throw error;
    }
  }
}

if (tue1 && tue2) {
  const refreshed = DRY ? junePe : (await sb.from("payroll_entries").select("*")
    .eq("teacher_id", teacher.id).eq("institution_id", inst.id)
    .gte("class_date", JUNE_START)).data ?? [];
  const tueDates = [...new Set(refreshed.filter(e => e.schedule_slot_id === tue1.id).map(e => e.class_date))];
  for (const dateStr of tueDates) {
    if (refreshed.some(e => e.class_date === dateStr && e.schedule_slot_id === tue2.id)) continue;
    const ref = refreshed.find(e => e.class_date === dateStr && e.schedule_slot_id === tue1.id);
    console.log(`  INSERT payroll ${dateStr} 화 2타임`);
    peInserts++;
    if (!DRY) {
      const { error } = await sb.from("payroll_entries").insert({
        teacher_id: teacher.id,
        institution_id: inst.id,
        class_date: dateStr,
        pay_type: "센터보조",
        minutes: BILLABLE,
        entry_status: ref?.entry_status ?? "as_scheduled",
        schedule_slot_id: tue2.id,
        note: "hannam-revert-schedule",
      });
      if (error) throw error;
    }
  }
}

console.log(`\nPayroll: ${peUpdates} updates, ${peInserts} inserts`);

if (!DRY) {
  const verify = (await sb.from("institution_weekly_schedule").select("day_of_week,start_time,end_time,label")
    .eq("teacher_id", teacher.id).eq("institution_id", inst.id)
    .order("day_of_week").order("start_time")).data;
  console.log("\nVerify:");
  verify?.forEach(s => console.log(`  ${dow(s.day_of_week)} ${s.start_time?.slice(0, 5)}-${s.end_time?.slice(0, 5)} ${s.label}`));
}
