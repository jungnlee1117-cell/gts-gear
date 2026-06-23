#!/usr/bin/env node
/**
 * 김하원 더차일드 주간 스케줄 교체 + 방과후 고정50000 label
 *   node scripts/apply-kimhawon-schedule.mjs --dry-run
 *   node scripts/apply-kimhawon-schedule.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const TEACHER_NAME = "김하원";
const INST_NAME = "더차일드";
const FLAT_LABEL = "고정50000";

const REGULAR = [
  { start: "10:30:00", end: "11:00:00", label: "LILA" },
  { start: "11:00:00", end: "11:30:00", label: "LANI" },
  { start: "11:40:00", end: "12:10:00", label: "LUMI" },
  { start: "13:20:00", end: "13:50:00", label: "RILEY" },
  { start: "13:50:00", end: "14:20:00", label: "KAIRO" },
];

const AFTER = [{ start: "15:20:00", end: "16:00:00", label: FLAT_LABEL }];

const TUE_REGULAR = [
  { start: "13:20:00", end: "13:50:00", label: "RILEY" },
  { start: "13:50:00", end: "14:20:00", label: "KAIRO" },
];

/** 2026-05-12 화요일만 3타임 — getSlotsForDate에서 __oneoff: 날짜로 필터 */
const TUE_ONEOFF_MAY12 = {
  start: "14:30:00",
  end: "15:00:00",
  label: "__oneoff:2026-05-12",
};

function buildSlots(institutionId, teacherId) {
  const rows = [];
  const add = (day, list, classType) => {
    for (const s of list) {
      rows.push({
        institution_id: institutionId,
        teacher_id: teacherId,
        day_of_week: day,
        class_type: classType,
        start_time: s.start,
        end_time: s.end,
        label: s.label,
      });
    }
  };
  add(1, REGULAR, "정규");
  add(1, AFTER, "방과후");
  add(2, TUE_REGULAR, "정규");
  add(2, [TUE_ONEOFF_MAY12], "정규");
  add(2, AFTER, "방과후");
  add(3, REGULAR, "정규");
  add(3, AFTER, "방과후");
  add(4, AFTER, "방과후");
  return rows;
}

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
const inst = (await sb.from("institutions").select("id").eq("name", INST_NAME).single()).data;
if (!teacher || !inst) throw new Error("teacher or institution not found");

const existing = (await sb.from("institution_weekly_schedule").select("id,day_of_week,start_time,end_time,label,class_type")
  .eq("teacher_id", teacher.id).eq("institution_id", inst.id)).data ?? [];

const next = buildSlots(inst.id, teacher.id);

console.log(DRY ? "=== DRY RUN ===" : "=== APPLY ===");
console.log(`Delete ${existing.length} slots, insert ${next.length} slots`);
for (const s of next) {
  const d = ["일","월","화","수","목","금","토"][s.day_of_week];
  console.log(`  ${d} ${s.start_time.slice(0,5)}-${s.end_time.slice(0,5)} ${s.class_type} ${s.label || ""}`);
}

if (DRY) process.exit(0);

if (existing.length) {
  const { error } = await sb.from("institution_weekly_schedule")
    .delete()
    .eq("teacher_id", teacher.id)
    .eq("institution_id", inst.id);
  if (error) throw error;
}

const { error: insErr } = await sb.from("institution_weekly_schedule").insert(next);
if (insErr) throw insErr;

const verify = (await sb.from("institution_weekly_schedule").select("day_of_week,start_time,end_time,class_type,label")
  .eq("teacher_id", teacher.id).eq("institution_id", inst.id)
  .order("day_of_week").order("start_time")).data;
console.log("Done —", verify?.length, "slots");
