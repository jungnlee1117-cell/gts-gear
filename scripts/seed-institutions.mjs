#!/usr/bin/env node
/**
 * institutions CSV → Supabase 일괄 입력
 *
 * 사용법:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-institutions.mjs
 *   node scripts/seed-institutions.mjs --dry-run
 *   node scripts/seed-institutions.mjs --csv path/to/file.csv
 *
 * 환경변수 (프로젝트 루트 .env.local / .env — 스크립트가 자동 로드):
 *   SUPABASE_URL 또는 VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 옵션:
 *   --dry-run     DB 쓰기 없이 매핑 결과만 출력
 *   --csv <path>  CSV 경로 (기본: supabase/data/institutions_최종.csv)
 *   --skip-may    5월 참고 매출(institution_monthly_contracts) 입력 생략
 *   --debug-env   .env 로드 상태 출력 (키 값은 앞 12자만)
 */

import { config as loadDotenv } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ENV_LOCAL_PATH = join(ROOT, ".env.local");
const ENV_PATH = join(ROOT, ".env");

// Node는 Vite와 달리 .env.local을 자동 로드하지 않음 → dotenv로 명시 로드
// override: true → shell에 빈 문자열로 잡혀 있어도 .env.local 값으로 덮어씀
if (existsSync(ENV_LOCAL_PATH)) {
  loadDotenv({ path: ENV_LOCAL_PATH, override: true, quiet: true });
}
if (existsSync(ENV_PATH)) {
  loadDotenv({ path: ENV_PATH, quiet: true });
}

/** trim 후 빈 문자열은 undefined 취급 */
function envValue(key) {
  const v = process.env[key];
  return v?.trim() ? v.trim() : undefined;
}

function debugEnvLoad() {
  console.log("[seed env debug]");
  console.log("  ROOT:", ROOT);
  console.log("  cwd:", process.cwd());
  console.log("  .env.local:", existsSync(ENV_LOCAL_PATH) ? ENV_LOCAL_PATH : "(없음)");
  console.log("  VITE_SUPABASE_URL:", envValue("VITE_SUPABASE_URL") ? "loaded" : "missing");
  console.log("  SUPABASE_URL:", envValue("SUPABASE_URL") ? "loaded" : "missing");
  const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
  console.log(
    "  SUPABASE_SERVICE_ROLE_KEY:",
    key ? `${key.slice(0, 12)}… (${key.length} chars)` : "missing",
  );
  if (process.env.SUPABASE_SERVICE_ROLE_KEY !== undefined && !key) {
    console.log("  ⚠ process.env에 키는 있지만 빈 문자열입니다 — .env.local 값을 확인하세요");
  }
}
const DEFAULT_CSV = join(ROOT, "supabase/data/institutions_최종.csv");
const EFFECTIVE_FROM = "2025-01-01";

const SESSION_RATES_BY_NAME = {
  "광교폴리": [{ session_type: "정규", rate_per_session: 45000 }],
  "리비어어학원": [{ session_type: "정규", rate_per_session: 47400 }],
  "엘란어학원": [
    { session_type: "정규", rate_per_session: 36000 },
    { session_type: "방과후", rate_per_session: 47000 },
  ],
  "텐즈아이어린이집": [{ session_type: "인당", rate_per_session: 25300 }],
  "한신어린이집": [{ session_type: "인당", rate_per_session: 17500 }],
  "아띠어린이집": [{ session_type: "인당", rate_per_session: 22000 }],
  "두리어린이집": [{ session_type: "인당", rate_per_session: 19000 }],
};

const FIXED_PAYOUT_BY_NAME = {
  "리틀(=리틀어학원)": {
    amount: 416000,
    recipientNames: ["오정석", "마이크", "Mike"],
  },
};

const MANAGER_ALIASES = {
  "양의인": ["양의인"],
  "레이첼": ["레이첼", "양의인"],
  "오정석": ["오정석"],
  "마이크": ["마이크", "Mike", "오정석"],
  "김민욱": ["김민욱"],
  "오정석(파트너)": ["오정석"],
  "정형신(회사)": ["정형신"],
  "오정석/정형신(회사)": ["오정석"],
};

function parseArgs(argv) {
  const args = { dryRun: false, debugEnv: false, csv: DEFAULT_CSV, skipMay: false, update: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--debug-env") args.debugEnv = true;
    else if (a === "--skip-may") args.skipMay = true;
    else if (a === "--update") args.update = true;
    else if (a === "--csv" && argv[i + 1]) args.csv = resolve(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").slice(0, 900));
      process.exit(0);
    }
  }
  return args;
}

function parseCsv(content) {
  const lines = content.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length < 7) continue;
    const note = parts.length > 7 ? parts.slice(7).join(",").trim() : "";
    const [
      name,
      managerRaw,
      contractType,
      billingTypeRaw,
      rateInfo,
      mayRevenueRaw,
      mayInstructorRaw,
    ] = parts.slice(0, 7).map(s => s.trim());
    rows.push({
      name,
      managerRaw,
      contractType,
      billingTypeRaw,
      rateInfo,
      mayRevenueRaw,
      mayInstructorRaw,
      note,
    });
  }
  return rows;
}

function mapBillingType(raw, contractType) {
  if (contractType === "partner_billing" || raw === "no_revenue_tracking") return "manual";
  if (raw === "per_session") return "per_session";
  if (raw === "per_capita") return "per_capita";
  return "monthly_fixed";
}

function parseReferenceAmount(raw) {
  if (!raw || raw === "해당없음" || raw === "가변") return null;
  const m = String(raw).replace(/,/g, "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function resolveManagerCandidates(managerRaw) {
  const raw = (managerRaw ?? "").trim();
  if (!raw) return [];
  if (MANAGER_ALIASES[raw]) return MANAGER_ALIASES[raw];
  const base = raw.split(/[/,(]/)[0].trim();
  return base ? [base] : [];
}

function formatManagerLabel(row, manager, hasManager) {
  if (!hasManager) return "(본사 직접 — manager_id NULL)";
  return manager?.name ?? `⚠ 미매칭: ${row.managerRaw}`;
}

function findTeacherByNames(teachers, names) {
  for (const name of names) {
    const exact = teachers.find(t => t.name === name);
    if (exact) return exact;
    const partial = teachers.find(t => t.name.includes(name) || name.includes(t.name));
    if (partial) return partial;
  }
  return null;
}

/** Node는 Vite와 달리 .env.local을 자동 로드하지 않음 — 파일 상단 dotenv로 처리 */
function loadEnv() {
  const url = envValue("SUPABASE_URL") || envValue("VITE_SUPABASE_URL");
  const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
  return { url, key };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.debugEnv) debugEnvLoad();

  if (!existsSync(args.csv)) {
    console.error(`CSV 없음: ${args.csv}`);
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(args.csv, "utf8"));
  console.log(`CSV ${rows.length}개 원 로드: ${args.csv}`);

  const { url, key } = loadEnv();
  if (!args.dryRun && (!url || !key)) {
    const missing = [];
    if (!url) missing.push("SUPABASE_URL 또는 VITE_SUPABASE_URL");
    if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    console.error(
      `다음 환경변수가 없습니다: ${missing.join(", ")}\n`
      + "프로젝트 루트 .env.local 에 KEY=value 형식으로 넣으세요 (shell echo 명령 X).\n"
      + "미리보기만: npm run seed:institutions:dry",
    );
    process.exit(1);
  }

  let supabase = null;
  let teachers = [];
  let existing = [];

  if (!args.dryRun) {
    supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data: tData, error: tErr } = await supabase
      .from("teachers")
      .select("id, name, role, active")
      .order("name");
    if (tErr) throw tErr;
    teachers = tData || [];

    const { data: iData, error: iErr } = await supabase.from("institutions").select("id, name");
    if (iErr) throw iErr;
    existing = iData || [];
  }

  const existingByName = new Map(existing.map(i => [i.name, i]));
  const summary = { inserted: 0, updated: 0, skipped: 0, rates: 0, contracts: 0, errors: [] };

  for (const row of rows) {
    const billingType = mapBillingType(row.billingTypeRaw, row.contractType);
    const hasManager = Boolean((row.managerRaw ?? "").trim());
    const managerCandidates = resolveManagerCandidates(row.managerRaw);
    const manager = !hasManager
      ? null
      : args.dryRun
        ? { id: null, name: managerCandidates[0] }
        : findTeacherByNames(teachers, managerCandidates);

    const fixedCfg = FIXED_PAYOUT_BY_NAME[row.name];
    const recipientNames = fixedCfg
      ? (process.env.FIXED_PAYOUT_RECIPIENT_NAMES?.split(",").map(s => s.trim()).filter(Boolean)
        ?? fixedCfg.recipientNames)
      : null;
    let fixedRecipient = null;
    if (fixedCfg && !args.dryRun) {
      fixedRecipient = findTeacherByNames(teachers, recipientNames);
    } else if (fixedCfg && args.dryRun) {
      fixedRecipient = { name: recipientNames[0] };
    }

    const institutionPayload = {
      name: row.name,
      manager_id: manager?.id ?? null,
      contract_type: row.contractType,
      billing_type: billingType,
      is_active: true,
      ...(fixedCfg ? { fixed_payout_amount: fixedCfg.amount } : {}),
      ...(fixedRecipient?.id ? { fixed_payout_recipient_id: fixedRecipient.id } : {}),
    };

    const plan = {
      name: row.name,
      manager: formatManagerLabel(row, manager, hasManager),
      contract_type: row.contractType,
      billing_type: billingType,
      session_rates: SESSION_RATES_BY_NAME[row.name] ?? null,
      fixed_payout: fixedCfg
        ? {
            amount: fixedCfg.amount,
            recipient: fixedRecipient?.name ?? `⚠ 미매칭: ${recipientNames?.join("/")}`,
          }
        : null,
      may_contract: !args.skipMay && billingType === "monthly_fixed" && row.contractType !== "partner_billing"
        ? parseReferenceAmount(row.mayRevenueRaw)
        : null,
      note: row.note || null,
    };

    console.log("\n---", row.name, "---");
    console.log(JSON.stringify(plan, null, 2));

    if (args.dryRun) continue;

    if (hasManager && !manager?.id) {
      summary.errors.push(`${row.name}: 담당자 미매칭 (${row.managerRaw})`);
    }
    if (fixedCfg && !fixedRecipient?.id) {
      summary.errors.push(`${row.name}: 고정지급 대상 미매칭 (${recipientNames?.join("/")})`);
    }

    const prev = existingByName.get(row.name);
    let institutionId;

    if (prev) {
      if (!args.update) {
        console.log("  → 기존 원 존재, 스킵 (--update 로 덮어쓰기)");
        summary.skipped++;
        institutionId = prev.id;
      } else {
        const { data, error } = await supabase
          .from("institutions")
          .update({ ...institutionPayload, updated_at: new Date().toISOString() })
          .eq("id", prev.id)
          .select("id")
          .single();
        if (error) {
          summary.errors.push(`${row.name}: ${error.message}`);
          continue;
        }
        institutionId = data.id;
        summary.updated++;
        console.log("  → 업데이트 완료");
      }
    } else {
      const { data, error } = await supabase
        .from("institutions")
        .insert(institutionPayload)
        .select("id")
        .single();
      if (error) {
        summary.errors.push(`${row.name}: ${error.message}`);
        continue;
      }
      institutionId = data.id;
      existingByName.set(row.name, { id: institutionId, name: row.name });
      summary.inserted++;
      console.log("  → 삽입 완료");
    }

    const rates = SESSION_RATES_BY_NAME[row.name];
    if (rates?.length) {
      for (const r of rates) {
        const { data: dup } = await supabase
          .from("institution_session_rates")
          .select("id")
          .eq("institution_id", institutionId)
          .eq("session_type", r.session_type)
          .eq("rate_per_session", r.rate_per_session)
          .eq("effective_from", EFFECTIVE_FROM)
          .maybeSingle();

        if (!dup) {
          const { error } = await supabase.from("institution_session_rates").insert({
            institution_id: institutionId,
            session_type: r.session_type,
            rate_per_session: r.rate_per_session,
            effective_from: EFFECTIVE_FROM,
          });
          if (error) summary.errors.push(`${row.name} 단가: ${error.message}`);
          else {
            summary.rates++;
            console.log(`  → 단가 ${r.session_type} ${r.rate_per_session}원`);
          }
        }
      }
    }

    const mayAmount = plan.may_contract;
    if (mayAmount != null && mayAmount > 0) {
      const { error } = await supabase.from("institution_monthly_contracts").upsert(
        {
          institution_id: institutionId,
          year_month: "2025-05-01",
          contract_amount: mayAmount,
          notes: "CSV 5월매출(참고) 시드",
        },
        { onConflict: "institution_id,year_month" },
      );
      if (error) summary.errors.push(`${row.name} 5월계약: ${error.message}`);
      else {
        summary.contracts++;
        console.log(`  → 5월 계약금액 ${mayAmount.toLocaleString()}원`);
      }
    }
  }

  console.log("\n========== 요약 ==========");
  if (args.dryRun) {
    console.log("dry-run 모드 — DB 변경 없음");
  } else {
    console.log(`삽입 ${summary.inserted}, 업데이트 ${summary.updated}, 스킵 ${summary.skipped}`);
    console.log(`단가 ${summary.rates}건, 5월계약 ${summary.contracts}건`);
    if (summary.errors.length) {
      console.log("\n경고/오류:");
      summary.errors.forEach(e => console.log("  -", e));
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
