#!/usr/bin/env node
/**
 * 안소연 엘란 금요일 1교시 payroll 백필 + session_counts 조정
 *   node scripts/apply-ansoyoen-friday-payroll-backfill.mjs --dry-run
 *   node scripts/apply-ansoyoen-friday-payroll-backfill.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const NEW_SLOT = "0c8e3e47-a08c-4e6e-aa17-4c4a4a253689";
const TEACHER_NAME = "안소연";
const INST_NAME = "엘란어학원";
const JUNE_FRIDAYS = ["2026-06-05", "2026-06-12", "2026-06-19", "2026-06-26"];
const MAY_FIX_DATES = ["2026-05-08", "2026-05-15"];

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

const toFix = (await sb.from("payroll_entries").select("*")
  .eq("teacher_id", teacher.id)
  .eq("schedule_slot_id", NEW_SLOT)
  .in("class_date", MAY_FIX_DATES)
  .eq("entry_status", "custom")).data ?? [];

const toInsert = [];
for (const d of JUNE_FRIDAYS) {
  const existing = (await sb.from("payroll_entries").select("id")
    .eq("teacher_id", teacher.id)
    .eq("class_date", d)
    .eq("schedule_slot_id", NEW_SLOT)
    .maybeSingle()).data;
  if (!existing) toInsert.push(d);
}

console.log(DRY ? "=== DRY RUN ===" : "=== APPLY ===");
console.log("UPDATE custom→as_scheduled:", toFix.length);
toFix.forEach(e => console.log(" ", e.class_date, e.minutes));

console.log("INSERT June Fridays:", toInsert.length);
toInsert.forEach(d => console.log(" ", d, "30min as_scheduled"));

const mayCounts = (await sb.from("institution_monthly_session_counts").select("*")
  .eq("institution_id", inst.id).eq("year_month", "2026-05-01")).data ?? [];
const juneReg = (await sb.from("institution_monthly_session_counts").select("*")
  .eq("institution_id", inst.id).eq("year_month", "2026-06-01").eq("session_type", "정규").maybeSingle()).data;

console.log("May session_counts:", mayCounts.length ? mayCounts : "none → create 정규 60, 방과후 7");
console.log("June 정규 count:", juneReg?.session_count, "→", (juneReg?.session_count ?? 0) + 4);

const rates = (await sb.from("institution_session_rates").select("*").eq("institution_id", inst.id)).data ?? [];
const regRate = rates.find(r => r.session_type === "정규")?.rate_per_session;
const aftRate = rates.find(r => r.session_type === "방과후")?.rate_per_session;
console.log("Rates: 정규", regRate, "방과후", aftRate);

if (DRY) process.exit(0);

for (const e of toFix) {
  const { error } = await sb.from("payroll_entries")
    .update({ entry_status: "as_scheduled", minutes: 30, updated_at: new Date().toISOString() })
    .eq("id", e.id);
  if (error) throw error;
}

for (const d of toInsert) {
  const { error } = await sb.from("payroll_entries").insert({
    teacher_id: teacher.id,
    institution_id: inst.id,
    class_date: d,
    pay_type: "정규",
    minutes: 30,
    entry_status: "as_scheduled",
    schedule_slot_id: NEW_SLOT,
  });
  if (error) throw error;
}

if (!mayCounts.length) {
  const { error: e1 } = await sb.from("institution_monthly_session_counts").upsert({
    institution_id: inst.id,
    year_month: "2026-05-01",
    session_type: "정규",
    session_count: 60,
    updated_at: new Date().toISOString(),
  }, { onConflict: "institution_id,year_month,session_type" });
  if (e1) throw e1;
  const { error: e2 } = await sb.from("institution_monthly_session_counts").upsert({
    institution_id: inst.id,
    year_month: "2026-05-01",
    session_type: "방과후",
    session_count: 7,
    updated_at: new Date().toISOString(),
  }, { onConflict: "institution_id,year_month,session_type" });
  if (e2) throw e2;
}

if (juneReg?.id) {
  const { error } = await sb.from("institution_monthly_session_counts")
    .update({ session_count: juneReg.session_count + 4, updated_at: new Date().toISOString() })
    .eq("id", juneReg.id);
  if (error) throw error;
}

// Verify
const slotEntries = (await sb.from("payroll_entries").select("class_date, minutes, entry_status")
  .eq("schedule_slot_id", NEW_SLOT).gte("class_date", "2026-05-01").lte("class_date", "2026-06-30")
  .order("class_date")).data ?? [];
console.log("\nNew slot entries:");
slotEntries.forEach(e => console.log(" ", e.class_date, e.minutes, e.entry_status));

const counts = (await sb.from("institution_monthly_session_counts").select("*")
  .eq("institution_id", inst.id).gte("year_month", "2026-05-01").lte("year_month", "2026-06-01")).data ?? [];
console.log("\nSession counts:");
for (const c of counts) {
  const rate = rates.find(r => r.session_type === c.session_type)?.rate_per_session ?? 0;
  console.log(` ${c.year_month} ${c.session_type}: ${c.session_count}회 × ${rate} = ${c.session_count * rate}원`);
}
