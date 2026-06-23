#!/usr/bin/env node
/**
 * teacher_assignments.csv + weekly_schedule.csv → Supabase 배정·주간시간표 시드
 *
 *   npm run seed:schedules:dry
 *   npm run seed:schedules
 *   npm run seed:schedules -- --replace-weekly
 *
 * 전제: institutions·teachers가 DB에 있어야 함
 *   npm run seed:institutions -- --update
 *
 * personal_schedule.csv 는 institutions 없이 payroll_entries(institution_id=NULL) 로
 * 수동 입력하는 개인수업 참고용 — DB에 넣지 않음
 *
 * 시트 탭 별명 → teachers.name:
 *   레이첼 → 양의인,  마이크 → 오정석
 */

import { config as loadDotenv } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "supabase/data");
const ENV_LOCAL = join(ROOT, ".env.local");
const ENV_FILE = join(ROOT, ".env");

if (existsSync(ENV_LOCAL)) loadDotenv({ path: ENV_LOCAL, override: true, quiet: true });
if (existsSync(ENV_FILE)) loadDotenv({ path: ENV_FILE, quiet: true });

const DEFAULT_ASSIGNMENTS = join(DATA_DIR, "teacher_assignments.csv");
const DEFAULT_WEEKLY = join(DATA_DIR, "weekly_schedule.csv");
const DEFAULT_PERSONAL = join(DATA_DIR, "personal_schedule.csv");

const DAY_KR = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
const WEEKLY_DB_CLASS = new Set(["정규", "방과후"]);
/** institution_teacher_assignments·weekly_schedule 에 넣지 않는 유형 */
const SKIP_ASSIGNMENT_TYPES = new Set(["가정방문"]);

/** 시트 탭명(별명) → teachers.name */
const TEACHER_ALIASES = {
  레이첼: "양의인",
  마이크: "오정석",
};

function envValue(key) {
  const v = process.env[key];
  return v?.trim() ? v.trim() : undefined;
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    replaceWeekly: false,
    assignmentsCsv: DEFAULT_ASSIGNMENTS,
    weeklyCsv: DEFAULT_WEEKLY,
    personalCsv: DEFAULT_PERSONAL,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--replace-weekly") args.replaceWeekly = true;
    else if (a === "--assignments" && argv[i + 1]) args.assignmentsCsv = resolve(argv[++i]);
    else if (a === "--weekly" && argv[i + 1]) args.weeklyCsv = resolve(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log("Usage: node scripts/seed-teacher-schedules.mjs [--dry-run] [--replace-weekly]");
      process.exit(0);
    }
  }
  return args;
}

function parseCsv(content) {
  const lines = content.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  if (lines.length < 2) return { header: [], rows: [] };
  const header = lines[0].split(",").map(s => s.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",").map(s => s.trim());
    const row = {};
    header.forEach((h, idx) => { row[h] = cols[idx] ?? ""; });
    rows.push(row);
  }
  return { header, rows };
}

function resolveTeacherName(sheetName) {
  const s = String(sheetName || "").trim();
  return TEACHER_ALIASES[s] ?? s;
}

function findTeacher(teachers, sheetName) {
  const dbName = resolveTeacherName(sheetName);
  const exact = teachers.find(t => t.name === dbName);
  if (exact) return { ...exact, sheetName, dbName };
  const partial = teachers.find(t => t.name.includes(dbName) || dbName.includes(t.name));
  if (partial) return { ...partial, sheetName, dbName };
  return null;
}

function formatTeacherLabel(sheetName, teacher) {
  if (!teacher) return sheetName;
  if (teacher.sheetName && teacher.dbName !== teacher.sheetName) {
    return `${teacher.sheetName}→${teacher.dbName}`;
  }
  return teacher.name;
}

function mergePayTypes(a, b) {
  return [...new Set([...(a || []), ...(b || [])])].sort();
}

async function main() {
  const args = parseArgs(process.argv);

  for (const p of [args.assignmentsCsv, args.weeklyCsv]) {
    if (!existsSync(p)) {
      console.error(`CSV 없음: ${p}`);
      process.exit(1);
    }
  }

  const { rows: assignRows } = parseCsv(readFileSync(args.assignmentsCsv, "utf8"));
  const { rows: weeklyRows } = parseCsv(readFileSync(args.weeklyCsv, "utf8"));
  const personalRows = existsSync(args.personalCsv)
    ? parseCsv(readFileSync(args.personalCsv, "utf8")).rows
    : [];

  const url = envValue("SUPABASE_URL") || envValue("VITE_SUPABASE_URL");
  const key = envValue("SUPABASE_SERVICE_ROLE_KEY");

  if (!args.dryRun && (!url || !key)) {
    console.error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요 (.env.local)");
    process.exit(1);
  }

  let supabase = null;
  let teachers = [];
  let institutions = [];

  if (url && key) {
    supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data: tData, error: tErr } = await supabase.from("teachers").select("id, name").order("name");
    if (tErr) throw tErr;
    teachers = tData || [];

    const { data: iData, error: iErr } = await supabase.from("institutions").select("id, name").order("name");
    if (iErr) throw iErr;
    institutions = iData || [];
  } else if (args.dryRun) {
    console.log("[dry-run] DB 미연결 — CSV 구조만 검증 ( .env.local 설정 시 매칭까지 확인 )\n");
  }

  const instByName = new Map(institutions.map(i => [i.name, i]));
  const summary = {
    assignments: 0,
    weekly: 0,
    skippedAssignment: [],
    skippedWeekly: [],
    missingInst: new Set(),
    missingTeacher: new Set(),
    personal: personalRows.length,
  };

  /** @type {Map<string, { teacher, institution, pay_types: string[] }>} */
  const assignmentMap = new Map();

  for (const row of assignRows) {
    const teacherName = row.강사명?.trim();
    const instName = row.원명?.trim();
    const payType = row.수업유형?.trim();
    if (!teacherName || !instName || !payType) continue;
    if (/^오전\s*:|엘리트/i.test(instName)) {
      summary.skippedAssignment.push(`${teacherName} / ${instName} / ${payType} (원 미등록·센터)`);
      continue;
    }
    if (SKIP_ASSIGNMENT_TYPES.has(payType) || /^개인수업/i.test(instName)) {
      summary.skippedAssignment.push(`${teacherName} / ${instName} / ${payType} (원 배정 제외)`);
      continue;
    }

    const teacher = teachers.length ? findTeacher(teachers, teacherName) : null;
    const institution = instByName.get(instName);

    if (!teacher && teachers.length) summary.missingTeacher.add(teacherName);
    if (!institution && institutions.length) summary.missingInst.add(instName);

    if (args.dryRun) {
      if (!teacher || !institution) {
        summary.skippedAssignment.push(`${teacherName} → ${instName} (${!teacher ? "강사 없음" : "원 없음"})`);
        continue;
      }
    } else if (!teacher?.id || !institution?.id) {
      summary.skippedAssignment.push(`${teacherName} → ${instName} (${!teacher?.id ? "강사 없음" : "원 없음"})`);
      continue;
    }

    const key = `${teacherName}|${instName}`;
    const prev = assignmentMap.get(key);
    if (prev) {
      prev.pay_types = mergePayTypes(prev.pay_types, [payType]);
    } else {
      assignmentMap.set(key, {
        teacher: teacherName,
        teacherLabel: formatTeacherLabel(teacherName, teacher),
        teacherId: teacher?.id,
        institution: instName,
        institutionId: institution?.id,
        pay_types: [payType],
      });
    }
  }

  console.log("=== institution_teacher_assignments ===");
  for (const item of [...assignmentMap.values()].sort((a, b) =>
    a.teacher.localeCompare(b.teacher, "ko") || a.institution.localeCompare(b.institution, "ko"),
  )) {
    console.log(`  ${item.teacherLabel ?? item.teacher} @ ${item.institution} → [${item.pay_types.join(", ")}]`);
    if (args.dryRun) {
      summary.assignments++;
      continue;
    }
    const { error } = await supabase.from("institution_teacher_assignments").upsert(
      {
        institution_id: item.institutionId,
        teacher_id: item.teacherId,
        pay_types: item.pay_types,
        is_active: true,
      },
      { onConflict: "institution_id,teacher_id" },
    );
    if (error) {
      summary.skippedAssignment.push(`${item.teacher} @ ${item.institution}: ${error.message}`);
    } else {
      summary.assignments++;
    }
  }

  /** @type {Map<string, typeof weeklyRows>} */
  const weeklyByTeacherInst = new Map();
  for (const row of weeklyRows) {
    const teacherName = row.강사명?.trim();
    const instName = row.원명?.trim();
    const payType = row.수업유형?.trim();
    const dayKr = row.요일?.trim();
    const start = row.시작시간?.trim();
    const end = row.종료시간?.trim();

    if (!teacherName || !instName || !payType || dayKr == null || !start || !end) continue;

    if (!WEEKLY_DB_CLASS.has(payType)) {
      summary.skippedWeekly.push(`${teacherName} ${instName} ${dayKr} ${payType} (주간표는 정규/방과후만)`);
      continue;
    }

    const teacher = teachers.length ? findTeacher(teachers, teacherName) : null;
    const institution = instByName.get(instName);
    if (!teacher && teachers.length) summary.missingTeacher.add(teacherName);
    if (!institution && institutions.length) summary.missingInst.add(instName);

    if (args.dryRun) {
      if (!teacher || !institution) {
        summary.skippedWeekly.push(`${teacherName} ${instName} ${dayKr} (${!teacher ? "강사 없음" : "원 없음"})`);
        continue;
      }
    } else if (!teacher?.id || !institution?.id) {
      summary.skippedWeekly.push(`${teacherName} ${instName} ${dayKr} (${!teacher?.id ? "강사 없음" : "원 없음"})`);
      continue;
    }

    const groupKey = `${teacherName}|${instName}`;
    if (!weeklyByTeacherInst.has(groupKey)) weeklyByTeacherInst.set(groupKey, []);
    weeklyByTeacherInst.get(groupKey).push({
      teacherName,
      teacherLabel: formatTeacherLabel(teacherName, teacher),
      teacherId: teacher?.id,
      institutionName: instName,
      institutionId: institution?.id,
      day_of_week: DAY_KR[dayKr],
      class_type: payType,
      start_time: start.length === 5 ? `${start}:00` : start,
      end_time: end.length === 5 ? `${end}:00` : end,
    });
  }

  console.log("\n=== institution_weekly_schedule ===");
  for (const [groupKey, slots] of weeklyByTeacherInst) {
    const [teacherName, instName] = groupKey.split("|");
    console.log(`  ${slots[0].teacherLabel ?? teacherName} @ ${instName}: ${slots.length}슬롯`);

    if (args.dryRun) {
      summary.weekly += slots.length;
      continue;
    }

    const institutionId = slots[0].institutionId;
    const teacherId = slots[0].teacherId;

    if (args.replaceWeekly) {
      const { error: delErr } = await supabase
        .from("institution_weekly_schedule")
        .delete()
        .eq("institution_id", institutionId)
        .eq("teacher_id", teacherId);
      if (delErr) {
        summary.skippedWeekly.push(`${groupKey} 삭제 실패: ${delErr.message}`);
        continue;
      }
    }

    const payload = slots.map((s, idx) => ({
      institution_id: s.institutionId,
      teacher_id: s.teacherId,
      day_of_week: s.day_of_week,
      class_type: s.class_type,
      start_time: s.start_time,
      end_time: s.end_time,
      sort_order: idx,
    }));

    const { error } = await supabase.from("institution_weekly_schedule").insert(payload);
    if (error) {
      summary.skippedWeekly.push(`${groupKey}: ${error.message}`);
    } else {
      summary.weekly += slots.length;
    }
  }

  if (personalRows.length) {
    console.log("\n=== personal_schedule (DB 미입력 — payroll institution_id=NULL) ===");
    for (const row of personalRows) {
      console.log(`  ${row.강사명} / ${row.레슨명} / ${row.요일} ${row.시작시간}-${row.종료시간}`);
    }
  }

  console.log("\n========== 요약 ==========");
  console.log(`배정 upsert: ${summary.assignments}건`);
  console.log(`주간 슬롯 insert: ${summary.weekly}건${args.replaceWeekly ? " (--replace-weekly)" : ""}`);
  console.log(`개인수업 참고: ${summary.personal}건 (DB 미입력)`);
  if (summary.missingInst.size) {
    console.log(`\n⚠ DB에 없는 원 (${summary.missingInst.size}):`);
    [...summary.missingInst].sort().forEach(n => console.log(`  - ${n}`));
    console.log("  → npm run seed:institutions -- --update 실행 후 재시도");
  }
  if (summary.missingTeacher.size) {
    console.log(`\n⚠ DB에 없는 강사 (${summary.missingTeacher.size}):`);
    [...summary.missingTeacher].sort().forEach(n => console.log(`  - ${n}`));
  }
  if (summary.skippedAssignment.length) {
    console.log(`\n배정 스킵/제외 ${summary.skippedAssignment.length}건`);
    summary.skippedAssignment.slice(0, 10).forEach(s => console.log(`  - ${s}`));
    if (summary.skippedAssignment.length > 10) console.log(`  … 외 ${summary.skippedAssignment.length - 10}건`);
  }
  if (summary.skippedWeekly.length) {
    console.log(`\n주간표 스킵 ${summary.skippedWeekly.length}건`);
    summary.skippedWeekly.slice(0, 10).forEach(s => console.log(`  - ${s}`));
    if (summary.skippedWeekly.length > 10) console.log(`  … 외 ${summary.skippedWeekly.length - 10}건`);
  }
  if (args.dryRun) console.log("\n[dry-run] DB 변경 없음");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
