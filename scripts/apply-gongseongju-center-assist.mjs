#!/usr/bin/env node
/**
 * 공성주 삼성 센터 보조 수업 스케줄 등록
 *   node scripts/apply-gongseongju-center-assist.mjs --dry-run
 *   node scripts/apply-gongseongju-center-assist.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");

const SLOTS = [
  { day: 1, start: "15:30:00", end: "16:30:00", label: "센터보조 1타임" },
  { day: 1, start: "16:30:00", end: "17:30:00", label: "센터보조 2타임" },
  { day: 1, start: "17:30:00", end: "18:30:00", label: "센터보조 3타임" },
  { day: 2, start: "15:30:00", end: "16:30:00", label: "센터보조 1타임" },
  { day: 2, start: "16:30:00", end: "17:30:00", label: "센터보조 2타임" },
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

const teacher = (await sb.from("teachers").select("id,name").eq("name", "공성주").single()).data;
const center = (await sb.from("institutions").select("id,name").eq("name", "Play by GTS 삼성 센터").single()).data;
if (!teacher || !center) throw new Error("teacher or center not found");

const existing = (await sb.from("institution_weekly_schedule").select("id,day_of_week,start_time,end_time,label")
  .eq("teacher_id", teacher.id).eq("institution_id", center.id)).data ?? [];

console.log(DRY ? "=== DRY RUN ===" : "=== APPLY ===");
console.log("Teacher:", teacher.name, "Center:", center.name);
console.log("Existing center slots:", existing.length);
console.log("To add:", SLOTS.length, "slots");

for (const s of SLOTS) {
  const hit = existing.find(e =>
    e.day_of_week === s.day
    && e.start_time === s.start
    && e.end_time === s.end,
  );
  console.log(`  ${["일","월","화","수","목","금","토"][s.day]} ${s.start.slice(0,5)}-${s.end.slice(0,5)} ${s.label}`, hit ? "(exists)" : "(new)");
}

if (DRY) process.exit(0);

const assign = (await sb.from("institution_teacher_assignments").select("pay_types")
  .eq("teacher_id", teacher.id).eq("institution_id", center.id).maybeSingle()).data;
const payTypes = [...new Set([...(assign?.pay_types ?? []), "센터보조"])];
const { error: aErr } = await sb.from("institution_teacher_assignments").upsert({
  institution_id: center.id,
  teacher_id: teacher.id,
  pay_types: payTypes,
  is_active: true,
}, { onConflict: "institution_id,teacher_id" });
if (aErr) throw aErr;
console.log("Assignment pay_types:", payTypes.join(", "));

let inserted = 0;
for (const s of SLOTS) {
  const hit = existing.find(e =>
    e.day_of_week === s.day
    && e.start_time === s.start
    && e.end_time === s.end,
  );
  if (hit) {
    const { error } = await sb.from("institution_weekly_schedule")
      .update({ label: s.label, class_type: "방과후" })
      .eq("id", hit.id);
    if (error) throw error;
    continue;
  }
  const { error } = await sb.from("institution_weekly_schedule").insert({
    institution_id: center.id,
    teacher_id: teacher.id,
    day_of_week: s.day,
    class_type: "방과후",
    start_time: s.start,
    end_time: s.end,
    label: s.label,
  });
  if (error) throw error;
  inserted += 1;
}

const after = (await sb.from("institution_weekly_schedule").select("day_of_week,start_time,end_time,label")
  .eq("teacher_id", teacher.id).eq("institution_id", center.id).order("day_of_week").order("start_time")).data;
console.log("Inserted:", inserted);
console.log("Final slots:", after?.length);
after?.forEach(s => {
  const d = ["일","월","화","수","목","금","토"][s.day_of_week];
  console.log(`  ${d} ${s.start_time?.slice(0,5)}-${s.end_time?.slice(0,5)} ${s.label}`);
});
