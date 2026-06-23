#!/usr/bin/env node
/**
 * 공성주 보조수업 배정: Play by GTS 삼성 센터 → 한남센터
 *   node scripts/apply-gongseongju-hannam-center.mjs --dry-run
 *   node scripts/apply-gongseongju-hannam-center.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const SAMSUNG_ID = "ecec692d-68d2-4dee-a290-9a924d0b27ef";
const HANNAM_NAME = "한남센터";
const TEACHER_NAME = "공성주";

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

const teacher = (await sb.from("teachers").select("id,name").eq("name", TEACHER_NAME).single()).data;
const yang = (await sb.from("teachers").select("id").eq("name", "양의인").single()).data;
if (!teacher) throw new Error("공성주 not found");

let hannam = (await sb.from("institutions").select("id,name").eq("name", HANNAM_NAME).maybeSingle()).data;
const samsung = (await sb.from("institutions").select("id,name").eq("id", SAMSUNG_ID).single()).data;

const samsungAssign = (await sb.from("institution_teacher_assignments").select("*")
  .eq("teacher_id", teacher.id).eq("institution_id", SAMSUNG_ID).maybeSingle()).data;

const samsungSlots = (await sb.from("institution_weekly_schedule").select("id,day_of_week,start_time,end_time,label")
  .eq("teacher_id", teacher.id).eq("institution_id", SAMSUNG_ID)).data ?? [];

const slotIds = samsungSlots.map(s => s.id);
const payrollToFix = slotIds.length
  ? (await sb.from("payroll_entries").select("id,class_date,institution_id,schedule_slot_id")
    .eq("teacher_id", teacher.id)
    .or(`institution_id.eq.${SAMSUNG_ID},schedule_slot_id.in.(${slotIds.join(",")})`)
    .gte("class_date", "2026-05-01")
    .lte("class_date", "2026-06-30")).data ?? []
  : (await sb.from("payroll_entries").select("id,class_date,institution_id,schedule_slot_id")
    .eq("teacher_id", teacher.id).eq("institution_id", SAMSUNG_ID)
    .gte("class_date", "2026-05-01").lte("class_date", "2026-06-30")).data ?? [];

console.log(DRY ? "=== DRY RUN ===" : "=== APPLY ===");
console.log("한남센터 exists:", hannam?.id ?? "will create");
console.log("삼성 센터 assignment:", samsungAssign?.pay_types, "active:", samsungAssign?.is_active);
console.log("Slots to move:", samsungSlots.length);
samsungSlots.forEach(s => {
  const d = ["일","월","화","수","목","금","토"][s.day_of_week];
  console.log(`  ${d} ${s.start_time?.slice(0,5)}-${s.end_time?.slice(0,5)} ${s.label}`);
});
console.log("Payroll entries to fix:", payrollToFix.length);

if (DRY) process.exit(0);

if (!hannam) {
  const { data, error } = await sb.from("institutions").insert({
    name: HANNAM_NAME,
    manager_id: yang?.id ?? null,
    contract_type: "gts_official",
    billing_type: "monthly_fixed",
    is_active: true,
  }).select().single();
  if (error) throw error;
  hannam = data;
  console.log("Created 한남센터:", hannam.id);
}

if (samsungAssign) {
  const { error } = await sb.from("institution_teacher_assignments")
    .update({ is_active: false })
    .eq("id", samsungAssign.id);
  if (error) throw error;
  console.log("Deactivated 삼성 센터 assignment");
}

const { error: assignErr } = await sb.from("institution_teacher_assignments").upsert({
  institution_id: hannam.id,
  teacher_id: teacher.id,
  pay_types: samsungAssign?.pay_types ?? ["센터보조"],
  is_active: true,
}, { onConflict: "institution_id,teacher_id" });
if (assignErr) throw assignErr;
console.log("한남센터 assignment:", (samsungAssign?.pay_types ?? ["센터보조"]).join(", "));

if (samsungSlots.length) {
  const { error: slotErr } = await sb.from("institution_weekly_schedule")
    .update({ institution_id: hannam.id })
    .eq("teacher_id", teacher.id)
    .eq("institution_id", SAMSUNG_ID);
  if (slotErr) throw slotErr;
  console.log("Moved", samsungSlots.length, "weekly slots to 한남센터");
}

if (payrollToFix.length) {
  const ids = payrollToFix.map(e => e.id);
  const { error: peErr } = await sb.from("payroll_entries")
    .update({ institution_id: hannam.id, updated_at: new Date().toISOString() })
    .in("id", ids);
  if (peErr) throw peErr;
  console.log("Updated payroll_entries:", ids.length);
}

const verify = (await sb.from("institution_weekly_schedule").select("id,institutions(name)")
  .eq("teacher_id", teacher.id).eq("institution_id", hannam.id)).data;
console.log("Verify 한남 slots:", verify?.length);
verify?.forEach(s => console.log(" ", s.institutions?.name, s.id));
