#!/usr/bin/env node
/**
 * per_capita billing_type 제약 적용 + 4개 어린이집 billing_type 업데이트
 *
 * DATABASE_URL 이 .env.local 에 있으면 SQL 패치를 직접 실행합니다.
 * 없으면 Supabase SQL Editor에서 schedule_payroll_patch_19_per_capita_billing.sql 실행 후
 *   node scripts/apply-per-capita-billing.mjs
 *
 *   node scripts/apply-per-capita-constraint.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(Boolean)
    .map(l => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const TARGETS = ["텐즈아이어린이집", "한신어린이집", "아띠어린이집", "두리어린이집"];
const SQL_PATH = "supabase/schedule_payroll_patch_19_per_capita_billing.sql";

async function runSqlViaPg() {
  const dbUrl = env.DATABASE_URL || env.SUPABASE_DB_URL;
  if (!dbUrl) return false;
  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.log("pg 패키지 없음 — npm install pg 후 DATABASE_URL 설정 시 자동 적용 가능");
    return false;
  }
  const sql = readFileSync(SQL_PATH, "utf8");
  const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("✓ SQL 패치 적용 완료 (DATABASE_URL)");
    return true;
  } finally {
    await client.end();
  }
}

const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const sqlOk = await runSqlViaPg();
if (!sqlOk) {
  console.log(`\n⚠ DDL 자동 적용 불가 — Supabase SQL Editor에서 ${SQL_PATH} 실행 필요\n`);
}

const { data: insts } = await sb.from("institutions").select("id,name,billing_type")
  .in("name", TARGETS);

let failed = 0;
for (const inst of insts ?? []) {
  if (inst.billing_type === "per_capita") {
    console.log(`✓ ${inst.name} 이미 per_capita`);
    continue;
  }
  const { error } = await sb.from("institutions")
    .update({ billing_type: "per_capita", updated_at: new Date().toISOString() })
    .eq("id", inst.id);
  if (error) {
    failed += 1;
    console.log(`✗ ${inst.name} billing_type 업데이트 실패:`, error.message);
  } else {
    console.log(`✓ ${inst.name} → per_capita`);
  }
}

if (failed > 0) {
  console.log(`\n${failed}개 원 billing_type 업데이트 실패 — ${SQL_PATH} 실행 후 다시 시도하세요.`);
  process.exit(1);
}
