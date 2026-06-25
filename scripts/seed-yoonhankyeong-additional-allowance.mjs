#!/usr/bin/env node
/**
 * 윤한경 추가수당 100,000원 — 2026-03 ~ 2027-02 (12개월)
 *   node scripts/seed-yoonhankyeong-additional-allowance.mjs --dry-run
 *   node scripts/seed-yoonhankyeong-additional-allowance.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const AMOUNT = 100_000;
const REASON = "추가수당";

const MONTHS = [];
for (let y = 2026; y <= 2027; y++) {
  const startM = y === 2026 ? 3 : 1;
  const endM = y === 2027 ? 2 : 12;
  for (let m = startM; m <= endM; m++) {
    MONTHS.push(`${y}-${String(m).padStart(2, "0")}-01`);
  }
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

const teacher = (await sb.from("teachers").select("id,name").eq("name", "윤한경").single()).data;
if (!teacher) throw new Error("윤한경 teacher not found");

const admin = (await sb.from("teachers").select("id").eq("role", "superadmin").limit(1).single()).data;
if (!admin) throw new Error("superadmin not found for created_by");

const { data: existing } = await sb.from("additional_payments")
  .select("year_month")
  .eq("teacher_id", teacher.id)
  .in("year_month", MONTHS);

const have = new Set((existing || []).map(r => r.year_month));
const toInsert = MONTHS.filter(ym => !have.has(ym)).map(year_month => ({
  teacher_id: teacher.id,
  year_month,
  amount: AMOUNT,
  reason: REASON,
  created_by: admin.id,
}));

console.log(DRY ? "=== DRY RUN ===" : "=== INSERT ===");
console.log(`대상: ${teacher.name}, ${MONTHS.length}개월 (${MONTHS[0]} ~ ${MONTHS[MONTHS.length - 1]})`);
console.log(`이미 있음: ${have.size}건`, [...have].sort());
console.log(`추가 예정: ${toInsert.length}건`);

for (const row of toInsert) {
  console.log(" ", row.year_month.slice(0, 7), REASON, `+${AMOUNT.toLocaleString("ko-KR")}원`);
}

if (DRY || !toInsert.length) process.exit(0);

const { error } = await sb.from("additional_payments").insert(toInsert);
if (error) throw error;

const { data: all } = await sb.from("additional_payments")
  .select("year_month, amount, reason")
  .eq("teacher_id", teacher.id)
  .gte("year_month", MONTHS[0])
  .lte("year_month", MONTHS[MONTHS.length - 1])
  .order("year_month");

console.log("\n완료. 등록된 추가지급:");
for (const r of all || []) {
  console.log(" ", r.year_month.slice(0, 7), r.reason, Number(r.amount).toLocaleString("ko-KR") + "원");
}
