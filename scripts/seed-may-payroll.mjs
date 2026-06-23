#!/usr/bin/env node
/**
 * 2026년 5월 payroll_entries 일괄 입력
 *
 *   node scripts/seed-may-payroll.mjs --dry-run          # 미리보기 + 검증
 *   node scripts/seed-may-payroll.mjs --probe-sheet      # 구글시트 5월 섹션 탐색
 *   node scripts/seed-may-payroll.mjs --only-manual      # 김민욱·오주영만
 *   node scripts/seed-may-payroll.mjs --csv-dir supabase/data/may-payroll
 *
 * 데이터 소스 (우선순위):
 *   1. supabase/data/may-payroll/{강사명}.csv
 *   2. 구글시트 xlsx 각 강사 탭 "5월 수업시수" 섹션
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, createSeedSupabase, parseArgs, envValue } from "./lib/seed-env.mjs";
import { resolveInstitutionId } from "./lib/institution-map.mjs";
import { loadAllTeacherGrids } from "./lib/sheet-xlsx.mjs";
import {
  loadCsvDir,
  parseMayHoursFromGrid,
  probeTeacherGrids,
} from "./lib/may-payroll-parse.mjs";

const YEAR = 2026;
const YEAR_MONTH = "2026-05-01";
const MONTH_START = "2026-05-01";
const MONTH_END = "2026-05-31";
const SEED_NOTE = "seed-may-payroll 2026-05";

const TARGET_TEACHERS = [
  "어욱진", "안소연", "공다연", "김하원", "공성주", "윤한경", "서은총", "김종현",
];

const EXPECTED_PAY = {
  "어욱진": 3043667,
  "안소연": 2604166,
  "김종현": 2278667,
  "공다연": 1204000,
  "김하원": 1740000,
  "공성주": 1426666,
  "윤한경": 1153500,
  "서은총": 585000,
};

const MANUAL_PAYROLL = [
  {
    teacher: "김민욱",
    institution: "용인 나비에로 야외수업",
    class_date: "2026-05-09",
    pay_type: "센터",
    minutes: 120,
  },
  {
    teacher: "김민욱",
    institution: "용인 나비에로 야외수업",
    class_date: "2026-05-16",
    pay_type: "센터",
    minutes: 180,
  },
];

const MANUAL_RATES = [
  {
    teacher: "김민욱",
    pay_type: "센터",
    rate_per_minute: 666.67,
    effective_from: "2026-03-01",
  },
];

const ADDITIONAL_PAYMENTS = [
  { teacher: "김민욱", year_month: YEAR_MONTH, amount: 10000, reason: "식비" },
  { teacher: "오주영", year_month: YEAR_MONTH, amount: 2600000, reason: "고정 계약급" },
  // ↑ 시드용 — 실제 운영은 additionalPayments.js FIXED_MONTHLY_SALARY(260만) + additional_payments(추가근로수당 등)
];

function pickRate(rates, teacherId, payType, classDate) {
  const matched = rates
    .filter(r =>
      r.teacher_id === teacherId
      && r.pay_type === payType
      && r.effective_from <= classDate,
    )
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  return Number(matched[0]?.rate_per_minute ?? 0);
}

function estimatePay(entries, rates) {
  let total = 0;
  for (const e of entries) {
    total += e.minutes * pickRate(rates, e.teacher_id, e.pay_type, e.class_date);
  }
  return Math.round(total);
}

function aggregateEntries(rawRows) {
  const map = new Map();
  for (const row of rawRows) {
    const key = [
      row.teacher,
      row.class_date,
      row.institution_id ?? "null",
      row.pay_type,
    ].join("|");
    const prev = map.get(key);
    if (prev) {
      prev.minutes += row.minutes;
      if (row.note && !prev.note?.includes(row.note)) {
        prev.note = [prev.note, row.note].filter(Boolean).join("; ");
      }
    } else {
      map.set(key, { ...row });
    }
  }
  return [...map.values()];
}

async function loadDbContext(sb) {
  const [
    teachersRes,
    institutionsRes,
    ratesRes,
    assignmentsRes,
    existingRes,
    additionalRes,
  ] = await Promise.all([
    sb.from("teachers").select("id, name, role, active").eq("active", true),
    sb.from("institutions").select("id, name"),
    sb.from("teacher_pay_rates").select("*"),
    sb.from("institution_teacher_assignments").select("teacher_id, institution_id, institutions(name)"),
    sb.from("payroll_entries").select("id, teacher_id, class_date").gte("class_date", MONTH_START).lte("class_date", MONTH_END),
    sb.from("additional_payments").select("id, teacher_id, year_month, reason").eq("year_month", YEAR_MONTH),
  ]);

  if (teachersRes.error) throw teachersRes.error;
  if (institutionsRes.error) throw institutionsRes.error;
  if (ratesRes.error) throw ratesRes.error;

  const teachersByName = new Map((teachersRes.data || []).map(t => [t.name, t]));
  const institutionsByName = new Map((institutionsRes.data || []).map(i => [i.name, i]));
  const assignmentsByTeacher = new Map();
  for (const a of assignmentsRes.data || []) {
    if (!assignmentsByTeacher.has(a.teacher_id)) assignmentsByTeacher.set(a.teacher_id, []);
    assignmentsByTeacher.get(a.teacher_id).push(a);
  }

  return {
    teachersByName,
    institutionsByName,
    rates: ratesRes.data || [],
    assignmentsByTeacher,
    existingMay: existingRes.data || [],
    existingAdditional: additionalRes.data || [],
  };
}

function resolveRows(rawRows, ctx) {
  const warnings = [];
  const resolved = [];

  for (const row of rawRows) {
    const teacher = ctx.teachersByName.get(row.teacher);
    if (!teacher) {
      warnings.push(`강사 없음: ${row.teacher}`);
      continue;
    }

    let institutionId = null;
    if (row.institution_name?.trim()) {
      institutionId = resolveInstitutionId(row.institution_name, ctx.institutionsByName);
      if (!institutionId) {
        const assigns = ctx.assignmentsByTeacher.get(teacher.id) || [];
        if (assigns.length === 1) {
          institutionId = assigns[0].institution_id;
          warnings.push(`${row.teacher} ${row.class_date}: 원 '${row.institution_name}' 미매칭 → 배정 원 ${assigns[0].institutions?.name} 사용`);
        } else {
          warnings.push(`${row.teacher} ${row.class_date}: 원 '${row.institution_name}' 미매칭 (배정 ${assigns.length}곳)`);
        }
      }
    }

    resolved.push({
      teacher_id: teacher.id,
      teacher_name: row.teacher,
      institution_id: institutionId,
      class_date: row.class_date,
      pay_type: row.pay_type,
      minutes: row.minutes,
      entry_status: "as_scheduled",
      note: row.note || SEED_NOTE,
      source: row.source,
    });
  }

  return { resolved: aggregateEntries(resolved), warnings };
}

function buildManualPayrollRows(ctx) {
  const rows = [];
  for (const m of MANUAL_PAYROLL) {
    const teacher = ctx.teachersByName.get(m.teacher);
    const inst = ctx.institutionsByName.get(m.institution);
    if (!teacher || !inst) continue;
    rows.push({
      teacher_id: teacher.id,
      teacher_name: m.teacher,
      institution_id: inst.id,
      class_date: m.class_date,
      pay_type: m.pay_type,
      minutes: m.minutes,
      entry_status: "as_scheduled",
      note: SEED_NOTE,
      source: "manual",
    });
  }
  return rows;
}

function printTeacherSummary(entries, rates, additionalByTeacher, teacherNames) {
  console.log("\n========== 강사별 5월 급여 검증 ==========");
  console.log("강사 | 정규(분) | 방과후(분) | 기타(분) | 예상급여 | 기대값 | 차이 | 추가지급");
  console.log("-".repeat(95));

  for (const name of teacherNames) {
    const tEntries = entries.filter(e => e.teacher_name === name);
    const mins = { 정규: 0, 방과후: 0, other: 0 };
    for (const e of tEntries) {
      if (e.pay_type === "정규") mins.정규 += e.minutes;
      else if (e.pay_type === "방과후") mins.방과후 += e.minutes;
      else mins.other += e.minutes;
    }
    const pay = estimatePay(tEntries, rates);
    const expected = EXPECTED_PAY[name];
    const add = additionalByTeacher.get(name) || 0;
    const diff = expected != null ? pay - expected : null;
    const diffStr = diff != null ? `${diff >= 0 ? "+" : ""}${diff.toLocaleString()}` : "—";
    const ok = expected != null && Math.abs(diff) <= 1000 ? "✓" : expected != null ? "⚠" : "";
    console.log(
      `${name} | ${mins.정규} | ${mins.방과후} | ${mins.other} | ${pay.toLocaleString()}원 | ${expected?.toLocaleString() ?? "—"} | ${diffStr} ${ok}`,
    );
    if (add) console.log(`  └ 추가지급: ${add.toLocaleString()}원`);
  }
}

async function collectSheetRows(teacherNames) {
  const grids = await loadAllTeacherGrids(teacherNames);
  const all = [];
  for (const name of teacherNames) {
    const { grid } = grids[name];
    if (!grid) continue;
    const { rows } = parseMayHoursFromGrid(grid, name, YEAR);
    all.push(...rows);
  }
  return { rows: all, probe: probeTeacherGrids(grids) };
}

async function ensureRates(sb, ctx, dryRun) {
  for (const spec of MANUAL_RATES) {
    const teacher = ctx.teachersByName.get(spec.teacher);
    if (!teacher) continue;
    const exists = ctx.rates.some(r =>
      r.teacher_id === teacher.id
      && r.pay_type === spec.pay_type
      && r.effective_from === spec.effective_from,
    );
    if (exists) continue;
    console.log(`  + teacher_pay_rates: ${spec.teacher} ${spec.pay_type} ${spec.rate_per_minute}원/분`);
    ctx.rates.push({
      teacher_id: teacher.id,
      pay_type: spec.pay_type,
      rate_per_minute: spec.rate_per_minute,
      effective_from: spec.effective_from,
    });
    if (dryRun) continue;
    const { error } = await sb.from("teacher_pay_rates").insert({
      teacher_id: teacher.id,
      pay_type: spec.pay_type,
      rate_per_minute: spec.rate_per_minute,
      effective_from: spec.effective_from,
    });
    if (error) throw error;
  }
}

async function main() {
  const { flags, opts } = parseArgs();
  const dryRun = flags.has("dry-run");
  const probeOnly = flags.has("probe-sheet");
  const onlyManual = flags.has("only-manual");
  const force = flags.has("force");
  const csvDir = opts.csvDir || join(ROOT, "supabase/data/may-payroll");

  const sb = createSeedSupabase();
  const ctx = await loadDbContext(sb);

  if (probeOnly) {
    console.log("구글시트 [2026 선생님 스케줄표] 5월 수업시수 섹션 탐색...\n");
    const { probe } = await collectSheetRows(TARGET_TEACHERS);
    for (const p of probe) {
      console.log(`${p.teacher}: ${p.status} — ${p.note} (sectionRow=${p.sectionRow}, rows=${p.rows})`);
    }
    console.log("\n※ 공개 export에 5월 수업시수가 없으면 CSV로 넣어주세요:");
    console.log(`   ${csvDir}/{강사명}.csv`);
    return;
  }

  let rawRows = [];

  if (!onlyManual) {
    const csvRows = loadCsvDir(csvDir, TARGET_TEACHERS);
    if (csvRows.length) {
      console.log(`CSV ${csvRows.length}건 (${csvDir})`);
      rawRows.push(...csvRows);
    } else {
      console.log("CSV 없음 → 구글시트 xlsx 파싱 시도...");
      const { rows, probe } = await collectSheetRows(TARGET_TEACHERS);
      rawRows.push(...rows);
      const missing = probe.filter(p => p.status !== "ok");
      if (missing.length) {
        console.log("\n⚠ 구글시트에서 5월 수업시수 섹션을 찾지 못했습니다:");
        for (const p of missing) console.log(`  - ${p.teacher}: ${p.note}`);
        console.log("\n  각 강사 탭의 '5월 수업시수' 표를 CSV로 export 후 아래에 저장하세요:");
        console.log(`  ${csvDir}/어욱진.csv  (헤더: class_date,institution_name,pay_type,minutes)`);
        if (!existsSync(csvDir)) {
          mkdirSync(csvDir, { recursive: true });
          writeFileSync(
            join(csvDir, "_example.csv"),
            "class_date,institution_name,pay_type,minutes,note\n2026-05-02,Sie.K,정규,240,\n2026-05-02,Sie.K,방과후,80,\n2026-05-03,,정규,60,개인레슨\n",
            "utf8",
          );
          console.log(`  (예시: ${csvDir}/_example.csv 생성됨)`);
        }
      }
    }
  }

  const manualRows = buildManualPayrollRows(ctx);
  await ensureRates(sb, ctx, dryRun);

  const { resolved, warnings } = resolveRows(rawRows, ctx);
  const allEntries = [...resolved, ...manualRows];

  if (warnings.length) {
    console.log("\n--- 매칭 경고 ---");
    warnings.slice(0, 30).forEach(w => console.log(" ", w));
    if (warnings.length > 30) console.log(`  ... 외 ${warnings.length - 30}건`);
  }

  const additionalByTeacher = new Map();
  for (const a of ADDITIONAL_PAYMENTS) {
    additionalByTeacher.set(a.teacher, a.amount);
  }

  const summaryTeachers = onlyManual
    ? ["김민욱", "오주영"]
    : [...TARGET_TEACHERS, "김민욱"];

  printTeacherSummary(allEntries, ctx.rates, additionalByTeacher, summaryTeachers);

  if (!onlyManual && resolved.length === 0) {
    console.log("\n❌ 입력할 payroll_entries가 없습니다. CSV 또는 시트 5월 섹션을 준비한 뒤 --dry-run 으로 다시 확인하세요.");
    if (manualRows.length) {
      console.log("   (--only-manual 로 김민욱 수동 입력만 진행 가능)");
    }
    process.exit(1);
  }

  if (ctx.existingMay.length && !force) {
    console.log(`\n⚠ 2026-05 payroll_entries ${ctx.existingMay.length}건 이미 존재. 덮어쓰려면 --force`);
    if (!dryRun) process.exit(1);
  }

  console.log(`\n총 payroll_entries: ${allEntries.length}건 (dry-run=${dryRun})`);
  if (allEntries.length <= 20) {
    for (const e of allEntries) {
      console.log(`  ${e.teacher_name} ${e.class_date} ${e.pay_type} ${e.minutes}분 inst=${e.institution_id?.slice(0, 8) ?? "NULL"}`);
    }
  }

  if (dryRun) {
    console.log("\n[dry-run] DB 변경 없음. 실행: node scripts/seed-may-payroll.mjs");
    return;
  }

  // INSERT payroll_entries
  const payload = allEntries.map(e => ({
    teacher_id: e.teacher_id,
    institution_id: e.institution_id,
    class_date: e.class_date,
    pay_type: e.pay_type,
    minutes: e.minutes,
    entry_status: e.entry_status,
    note: e.note,
  }));

  const { error: peErr } = await sb.from("payroll_entries").insert(payload);
  if (peErr) throw peErr;
  console.log(`✓ payroll_entries ${payload.length}건 INSERT`);

  // additional_payments
  const adminId = envValue("VITE_SUPER_ADMIN_ID")
    || [...ctx.teachersByName.values()].find(t => t.role === "superadmin")?.id;
  if (!adminId) throw new Error("created_by용 superadmin ID 없음 (VITE_SUPER_ADMIN_ID)");

  for (const a of ADDITIONAL_PAYMENTS) {
    const teacher = ctx.teachersByName.get(a.teacher);
    if (!teacher) continue;
    const dup = ctx.existingAdditional.some(x =>
      x.teacher_id === teacher.id && x.reason === a.reason,
    );
    if (dup && !force) {
      console.log(`  skip additional_payments (exists): ${a.teacher} ${a.reason}`);
      continue;
    }
    const { error } = await sb.from("additional_payments").insert({
      teacher_id: teacher.id,
      year_month: a.year_month,
      amount: a.amount,
      reason: a.reason,
      created_by: adminId,
    });
    if (error) throw error;
    console.log(`✓ additional_payments: ${a.teacher} ${a.amount.toLocaleString()}원 (${a.reason})`);
  }

  console.log("\n완료.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
