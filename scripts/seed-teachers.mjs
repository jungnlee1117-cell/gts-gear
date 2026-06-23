#!/usr/bin/env node
/**
 * 강사 계정 CSV → Supabase auth.users + public.teachers 일괄 등록
 *
 * 사용법:
 *   npm run seed:teachers:dry
 *   npm run seed:teachers
 *   npm run seed:teachers -- --update
 *
 * 환경변수 (.env.local):
 *   VITE_SUPABASE_URL (또는 SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (또는 SUPABASE_SECRET_KEY)
 *
 * CSV (기본: supabase/data/teachers_신규.csv):
 *   이름,이메일,비밀번호
 *   비밀번호 열이 비어 있으면 DEFAULT_PASSWORD 또는 gts2026! 사용
 *
 * 옵션:
 *   --dry-run       DB 쓰기 없이 매핑만 출력
 *   --csv <path>    CSV 경로
 *   --update        auth 사용자가 있으면 teachers 행만 갱신 + must_change_password 재설정
 *   --debug-env     env 로드 상태
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
const DEFAULT_CSV = join(ROOT, "supabase/data/teachers_신규.csv");
const FALLBACK_PASSWORD = "gts2026!";

if (existsSync(ENV_LOCAL_PATH)) {
  loadDotenv({ path: ENV_LOCAL_PATH, override: true, quiet: true });
}
if (existsSync(ENV_PATH)) {
  loadDotenv({ path: ENV_PATH, quiet: true });
}

function envValue(key) {
  const v = process.env[key];
  return v?.trim() ? v.trim() : undefined;
}

function debugEnvLoad() {
  console.log("[seed env debug]");
  console.log("  ROOT:", ROOT);
  console.log("  .env.local:", existsSync(ENV_LOCAL_PATH) ? "found" : "missing");
  const key = envValue("SUPABASE_SERVICE_ROLE_KEY") || envValue("SUPABASE_SECRET_KEY");
  console.log("  service key:", key ? `${key.slice(0, 12)}… (${key.length} chars)` : "missing");
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    update: false,
    debugEnv: false,
    csv: DEFAULT_CSV,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--update") args.update = true;
    else if (a === "--debug-env") args.debugEnv = true;
    else if (a === "--csv" && argv[i + 1]) args.csv = resolve(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").slice(0, 1200));
      process.exit(0);
    }
  }
  return args;
}

/** 간단 CSV — 이름,이메일,비밀번호 (따옴표·줄바꿈 정리) */
function parseCsv(content) {
  const lines = content.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(",").map(s => s.trim().replace(/^["']|["']$/g, ""));
    if (parts.length < 2) continue;
    const [name, email, passwordRaw] = parts;
    if (!name || !email) continue;
    rows.push({
      name,
      email: email.toLowerCase().trim(),
      password: passwordRaw || envValue("DEFAULT_PASSWORD") || FALLBACK_PASSWORD,
    });
  }
  return rows;
}

async function findAuthUserByEmail(supabase, email) {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function upsertTeacherRow(supabase, { id, name, email, phone = "" }) {
  const { data: existing } = await supabase.from("teachers").select("id").eq("id", id).maybeSingle();
  const payload = {
    id,
    name,
    email,
    phone,
    role: "teacher",
    active: true,
  };
  if (existing) {
    const { error } = await supabase.from("teachers").update(payload).eq("id", id);
    if (error) throw error;
    return "updated";
  }
  const { error } = await supabase.from("teachers").insert(payload);
  if (error) throw error;
  return "inserted";
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.debugEnv) debugEnvLoad();

  if (!existsSync(args.csv)) {
    console.error(`CSV 없음: ${args.csv}`);
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(args.csv, "utf8"));
  console.log(`CSV ${rows.length}명 로드: ${args.csv}`);

  const url = envValue("SUPABASE_URL") || envValue("VITE_SUPABASE_URL");
  const key = envValue("SUPABASE_SERVICE_ROLE_KEY") || envValue("SUPABASE_SECRET_KEY");

  if (!args.dryRun && (!url || !key)) {
    console.error(
      "VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY(또는 SUPABASE_SECRET_KEY)가 필요합니다.\n"
      + "미리보기: npm run seed:teachers:dry",
    );
    process.exit(1);
  }

  const supabase = args.dryRun
    ? null
    : createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const summary = { created: 0, updated: 0, skipped: 0, teachers: 0, errors: [] };

  for (const row of rows) {
    const plan = {
      name: row.name,
      email: row.email,
      password: args.dryRun ? "(hidden)" : "********",
      must_change_password: true,
    };
    console.log("\n---", row.name, "---");
    console.log(JSON.stringify(plan, null, 2));

    if (args.dryRun) continue;

    try {
      let userId = null;
      const existingUser = await findAuthUserByEmail(supabase, row.email);

      if (existingUser) {
        if (!args.update) {
          console.log("  → auth 사용자 존재, 스킵 (--update 로 teachers 갱신 가능)");
          summary.skipped++;
          continue;
        }
        userId = existingUser.id;
        const { error: metaErr } = await supabase.auth.admin.updateUserById(userId, {
          password: row.password,
          user_metadata: {
            ...existingUser.user_metadata,
            name: row.name,
            role: "teacher",
            must_change_password: true,
          },
        });
        if (metaErr) throw metaErr;
        console.log("  → auth 사용자 비밀번호·메타 갱신");
        summary.updated++;
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email: row.email,
          password: row.password,
          email_confirm: true,
          user_metadata: {
            name: row.name,
            role: "teacher",
            must_change_password: true,
          },
        });
        if (error) throw error;
        userId = data.user.id;
        console.log("  → auth 사용자 생성");
        summary.created++;
      }

      const teacherAction = await upsertTeacherRow(supabase, {
        id: userId,
        name: row.name,
        email: row.email,
      });
      console.log(`  → teachers ${teacherAction}`);
      summary.teachers++;
    } catch (err) {
      const msg = err?.message || String(err);
      summary.errors.push(`${row.name} (${row.email}): ${msg}`);
      console.error("  ✗", msg);
    }
  }

  console.log("\n========== 요약 ==========");
  if (args.dryRun) {
    console.log("dry-run — DB 변경 없음");
  } else {
    console.log(`auth 생성 ${summary.created}, auth 갱신 ${summary.updated}, 스킵 ${summary.skipped}`);
    console.log(`teachers 처리 ${summary.teachers}명`);
    if (summary.errors.length) {
      console.log("\n오류:");
      summary.errors.forEach(e => console.log("  -", e));
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
