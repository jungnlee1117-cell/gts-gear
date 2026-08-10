#!/usr/bin/env node
/**
 * 2026-07 기관별 추가금 DB 보정
 *   윤한경: 합산 '추가수당' → 프랜시스파커 5만 + 관악SLP 5만
 *   김종현: 잘못 시드된 '추가금액' 제거 (수지폴리 귀속 = 교통비지원)
 *
 *   node scripts/apply-july-2026-institution-additional.mjs --dry-run
 *   node scripts/apply-july-2026-institution-additional.mjs
 */

import { createSeedSupabase } from "./lib/seed-env.mjs";

const DRY = process.argv.includes("--dry-run");
const YEAR_MONTH = "2026-07-01";

const sb = createSeedSupabase();

const admin = (await sb.from("teachers").select("id").eq("role", "superadmin").limit(1).single()).data;
const kim = (await sb.from("teachers").select("id,name").eq("name", "김종현").single()).data;
const yoon = (await sb.from("teachers").select("id,name").eq("name", "윤한경").single()).data;

if (!admin?.id) throw new Error("superadmin not found");
if (!kim?.id) throw new Error("김종현 not found");
if (!yoon?.id) throw new Error("윤한경 not found");

const { data: before } = await sb.from("additional_payments")
  .select("amount, reason, teachers!additional_payments_teacher_id_fkey(name)")
  .eq("year_month", YEAR_MONTH)
  .in("teacher_id", [kim.id, yoon.id])
  .order("reason");

console.log(DRY ? "=== DRY RUN ===" : "=== APPLY ===");
console.log("Before (김종현·윤한경 2026-07):");
for (const p of before || []) {
  console.log(`  ${p.teachers?.name} | ${p.reason} | ${Number(p.amount).toLocaleString()}`);
}
if (!before?.length) console.log("  (none)");

const { data: kimExtra } = await sb.from("additional_payments")
  .select("id")
  .eq("teacher_id", kim.id)
  .eq("year_month", YEAR_MONTH)
  .eq("reason", "추가금액");

const { data: yoonLump } = await sb.from("additional_payments")
  .select("id")
  .eq("teacher_id", yoon.id)
  .eq("year_month", YEAR_MONTH)
  .eq("reason", "추가수당");

const toInsert = [
  { teacher_id: yoon.id, year_month: YEAR_MONTH, amount: 50000, reason: "프랜시스파커 추가수당", created_by: admin.id },
  { teacher_id: yoon.id, year_month: YEAR_MONTH, amount: 50000, reason: "관악SLP 추가수당", created_by: admin.id },
];

const { data: existing } = await sb.from("additional_payments")
  .select("teacher_id, reason")
  .eq("year_month", YEAR_MONTH)
  .eq("teacher_id", yoon.id);

const have = new Set((existing || []).map(r => `${r.teacher_id}|${r.reason}`));
const inserts = toInsert.filter(r => !have.has(`${r.teacher_id}|${r.reason}`));

console.log("\nDelete kim '추가금액':", kimExtra?.length || 0, "row(s)");
console.log("Delete yoon lump '추가수당':", yoonLump?.length || 0, "row(s)");
console.log("Insert:", inserts.length, "row(s)");
for (const r of inserts) {
  console.log(`  ${yoon.name} | ${r.reason} +${r.amount.toLocaleString()}`);
}

if (DRY) process.exit(0);

if (kimExtra?.length) {
  const { error } = await sb.from("additional_payments")
    .delete()
    .eq("teacher_id", kim.id)
    .eq("year_month", YEAR_MONTH)
    .eq("reason", "추가금액");
  if (error) throw error;
}

if (yoonLump?.length) {
  const { error } = await sb.from("additional_payments")
    .delete()
    .eq("teacher_id", yoon.id)
    .eq("year_month", YEAR_MONTH)
    .eq("reason", "추가수당");
  if (error) throw error;
}

if (inserts.length) {
  const { error } = await sb.from("additional_payments").insert(inserts);
  if (error) throw error;
}

const { data: after } = await sb.from("additional_payments")
  .select("amount, reason, teachers!additional_payments_teacher_id_fkey(name)")
  .eq("year_month", YEAR_MONTH)
  .in("teacher_id", [kim.id, yoon.id])
  .order("reason");

console.log("\nAfter (김종현·윤한경 2026-07):");
for (const p of after || []) {
  console.log(`  ${p.teachers?.name} | ${p.reason} | ${Number(p.amount).toLocaleString()}`);
}
