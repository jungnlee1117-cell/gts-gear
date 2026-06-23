#!/usr/bin/env node
/**
 * 김하원 2026-05 확정급 1,740,000원 (additional_payments 기록)
 *   node scripts/set-kimhawon-may-fixed-pay.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { envValue } from "./lib/seed-env.mjs";

const YEAR_MONTH = "2026-05-01";
const AMOUNT = 1740000;
const REASON = "5월 확정급 (스케줄 변동)";

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

const teacher = (await sb.from("teachers").select("id").eq("name", "김하원").single()).data;
if (!teacher) throw new Error("김하원 not found");

const adminId = envValue("VITE_SUPER_ADMIN_ID")
  || (await sb.from("teachers").select("id").eq("role", "superadmin").limit(1).single()).data?.id;
if (!adminId) throw new Error("superadmin id required");

const { data: existing } = await sb.from("additional_payments")
  .select("id, amount, reason")
  .eq("teacher_id", teacher.id)
  .eq("year_month", YEAR_MONTH);

const dup = existing?.find(p => p.reason === REASON);
if (dup) {
  if (Number(dup.amount) === AMOUNT) {
    console.log("Already set:", AMOUNT.toLocaleString(), "원");
    process.exit(0);
  }
  const { error } = await sb.from("additional_payments")
    .update({ amount: AMOUNT })
    .eq("id", dup.id);
  if (error) throw error;
  console.log("Updated additional_payments →", AMOUNT.toLocaleString(), "원");
} else {
  const { error } = await sb.from("additional_payments").insert({
    teacher_id: teacher.id,
    year_month: YEAR_MONTH,
    amount: AMOUNT,
    reason: REASON,
    created_by: adminId,
  });
  if (error) throw error;
  console.log("Inserted additional_payments →", AMOUNT.toLocaleString(), "원");
}

const tax = Math.round(AMOUNT * 0.033);
const net = Math.round(AMOUNT * 0.967);
console.log("\n=== 5월 급여 (확정) ===");
console.log("세전(예상 급여):", AMOUNT.toLocaleString(), "원");
console.log("원천징수 3.3%:", tax.toLocaleString(), "원");
console.log("실수령액 (3.3% 제외):", net.toLocaleString(), "원");
