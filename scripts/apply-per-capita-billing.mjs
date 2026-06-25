#!/usr/bin/env node
/**
 * 인당과금(per_capita) 적용 + 2026-06 인원수 시드
 *   node scripts/apply-per-capita-billing.mjs --dry-run
 *   node scripts/apply-per-capita-billing.mjs
 *
 * billing_type 제약 미적용 시에도 단가·인원 데이터는 저장합니다.
 * UI는 인당 단가가 있으면 per_capita로 인식합니다.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const YEAR_MONTH = "2026-06-01";
const SESSION_TYPE = "인당";
const EFFECTIVE_FROM = "2025-01-01";

const TARGETS = [
  { name: "텐즈아이어린이집", rate: 25300, headcount: 20 },
  { name: "한신어린이집", rate: 17500, headcount: 34 },
  { name: "아띠어린이집", rate: 22000, headcount: 10 },
  { name: "두리어린이집", rate: 19000, headcount: 23 },
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

const institutions = (await sb.from("institutions").select("id,name,billing_type")
  .in("name", TARGETS.map(t => t.name))).data ?? [];

console.log(DRY ? "=== DRY RUN ===" : "=== APPLY ===");

let billingTypeSkipped = false;

for (const t of TARGETS) {
  const inst = institutions.find(i => i.name === t.name);
  if (!inst) {
    console.error("Not found:", t.name);
    continue;
  }
  const revenue = t.rate * t.headcount;
  console.log(`${t.name}: ${t.headcount}명 × ${t.rate.toLocaleString()}원 = ${revenue.toLocaleString()}원`);

  if (DRY) continue;

  if (inst.billing_type !== "per_capita") {
    const { error: uErr } = await sb.from("institutions")
      .update({ billing_type: "per_capita", updated_at: new Date().toISOString() })
      .eq("id", inst.id);
    if (uErr) {
      if (uErr.code === "23514") {
        billingTypeSkipped = true;
        console.log(`  ⚠ billing_type 변경 스킵 (제약 미적용) — 단가·인원만 저장`);
      } else {
        throw uErr;
      }
    }
  }

  const { data: existingRate } = await sb.from("institution_session_rates")
    .select("id")
    .eq("institution_id", inst.id)
    .eq("session_type", SESSION_TYPE)
    .maybeSingle();

  if (existingRate) {
    const { error } = await sb.from("institution_session_rates")
      .update({ rate_per_session: t.rate })
      .eq("id", existingRate.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from("institution_session_rates").insert({
      institution_id: inst.id,
      session_type: SESSION_TYPE,
      rate_per_session: t.rate,
      effective_from: EFFECTIVE_FROM,
    });
    if (error) throw error;
  }

  const { error: cErr } = await sb.from("institution_monthly_session_counts").upsert({
    institution_id: inst.id,
    year_month: YEAR_MONTH,
    session_type: SESSION_TYPE,
    session_count: t.headcount,
    updated_at: new Date().toISOString(),
  }, { onConflict: "institution_id,year_month,session_type" });
  if (cErr) throw cErr;
}

if (!DRY) {
  const verify = (await sb.from("institutions").select("id,name,billing_type")
    .in("name", TARGETS.map(t => t.name))).data ?? [];
  for (const inst of verify) {
    const rates = (await sb.from("institution_session_rates").select("rate_per_session")
      .eq("institution_id", inst.id).eq("session_type", SESSION_TYPE)).data ?? [];
    const counts = (await sb.from("institution_monthly_session_counts").select("session_count")
      .eq("institution_id", inst.id).eq("year_month", YEAR_MONTH).eq("session_type", SESSION_TYPE)).data ?? [];
    const rate = rates[0]?.rate_per_session ?? 0;
    const count = counts[0]?.session_count ?? 0;
    console.log(`✓ ${inst.name} billing=${inst.billing_type} ${count}명×${rate}=${count * rate}`);
  }
  if (billingTypeSkipped) {
    console.log("\n※ billing_type=per_capita 적용은 supabase/schedule_payroll_patch_19_per_capita_billing.sql 실행 후 다시 시도하세요.");
    console.log("  (단가·인원 데이터는 저장됨 — UI에서 인당과금으로 표시됩니다)");
  }
}
