#!/usr/bin/env node
/**
 * 김종현 6월 급여 3자 비교 리포트 (시스템 / 손계산 / 스케줄 이론)
 *   node scripts/compare-kim-june-payroll.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  aggregateDailyMinutes,
  buildRawPayrollEntryRows,
  buildScheduleTheoryDaily,
  buildThreeWayComparison,
  mapToDailyRows,
  referenceRowsToMap,
} from "../src/schedule/payrollCompare.js";

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

const MANUAL_REFERENCE = [
  ...buildManualReference(),
];

function buildManualReference() {
  const rows = [];
  const weekBlocks = [
    ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04"],
    ["2026-06-08", "2026-06-09", "2026-06-10", "2026-06-11"],
    ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18"],
    ["2026-06-22", "2026-06-23", "2026-06-24", "2026-06-25"],
  ];
  const regularByDow = { 1: 205, 2: 205, 3: 120, 4: 205 };
  const afterByDow = { 1: 85, 2: 85, 4: 85 };
  const skipAfterTues = new Set(["2026-06-09", "2026-06-16"]);

  for (const block of weekBlocks) {
    for (const dateStr of block) {
      const dow = new Date(`${dateStr}T12:00:00`).getDay();
      if (regularByDow[dow]) rows.push({ dateStr, payType: "정규", minutes: regularByDow[dow] });
      if (afterByDow[dow] && !skipAfterTues.has(dateStr)) {
        rows.push({ dateStr, payType: "방과후", minutes: afterByDow[dow] });
      }
    }
  }
  rows.push({ dateStr: "2026-06-29", payType: "정규", minutes: 20 });
  return rows;
}

function sumRows(rows) {
  const t = { 정규: 0, 방과후: 0 };
  for (const r of rows) t[r.payType] = (t[r.payType] || 0) + r.minutes;
  return t;
}

const teacher = (await sb.from("teachers").select("id,name").eq("name", "김종현").single()).data;
const entries = (await sb.from("payroll_entries").select("*, institutions(name)").eq("teacher_id", teacher.id)
  .gte("class_date", "2026-06-01").lte("class_date", "2026-06-30").order("class_date")).data;
const weeklySlots = (await sb.from("institution_weekly_schedule").select("*, institutions(name)").eq("teacher_id", teacher.id)).data;

const raw = buildRawPayrollEntryRows(entries, weeklySlots);
const systemDaily = aggregateDailyMinutes(raw, { includedOnly: true });
const theoryDaily = buildScheduleTheoryDaily({
  weeklySlots, exceptions: [], year: 2026, month: 5, excludeLunchSlot: true,
});
const referenceDaily = referenceRowsToMap(MANUAL_REFERENCE);

const cmp = buildThreeWayComparison({ systemDaily, referenceDaily, theoryDaily });

console.log("=== 김종현 2026-06 급여 3자 비교 ===\n");
console.log("시스템(확정):", cmp.summary.systemTotals, "합", cmp.summary.systemTotals.정규 + cmp.summary.systemTotals.방과후);
console.log("손계산 원본:", cmp.summary.referenceTotals, "합", cmp.summary.referenceTotals.정규 + cmp.summary.referenceTotals.방과후);
console.log("스케줄 이론(점심제외):", cmp.summary.theoryTotals, "합", cmp.summary.theoryTotals.정규 + cmp.summary.theoryTotals.방과후);
console.log("\n구글시트 엑셀(사용자 제공): 정규 2960 / 방과후 640");
console.log("시스템 vs 시트 차이: 정규", 2565 - 2960, "/ 방과후", 765 - 640);

console.log("\n--- payroll_entries 원본 (", raw.length, "건) ---");
for (const r of raw) {
  const inc = r.includedInTotal ? "Y" : "N";
  console.log([r.dateStr, r.institutionName, r.payType, r.startTime, r.endTime, r.entryMinutes, r.entryStatus, inc].join("\t"));
}

console.log("\n--- 일별 비교 (불일치만) ---");
for (const row of cmp.rows.filter(r => r.hasMismatch)) {
  console.log([
    row.dateStr,
    row.payType,
    `원본=${row.referenceMinutes ?? "—"}`,
    `시스템=${row.systemMinutes ?? "—"}`,
    `이론=${row.theoryMinutes ?? "—"}`,
    row.status,
    row.issue,
  ].join(" | "));
}

console.log("\n--- 시스템 누락 (원본 O, 시스템 X) ---");
for (const row of cmp.summary.missingInSystem) {
  console.log(row.dateStr, row.payType, row.referenceMinutes + "분");
}

console.log("\n--- 시스템만 있음 (원본 X, 시스템 O) ---");
for (const row of cmp.summary.extraInSystem) {
  console.log(row.dateStr, row.payType, row.systemMinutes + "분");
}

console.log("\n--- 분 불일치 ---");
for (const row of cmp.summary.minutesDiff) {
  console.log(row.dateStr, row.payType, row.issue);
}

console.log("\n--- 시스템 일별 확정 ---");
for (const r of mapToDailyRows(systemDaily)) console.log(r.dateStr, r.payType, r.minutes);

console.log("\n--- 손계산 일별 ---");
for (const r of MANUAL_REFERENCE) console.log(r.dateStr, r.payType, r.minutes);

// Sheet 640 reverse: try Mon+Thu only through month
console.log("\n--- 시트 640 역추적 후보 (화요일 방과후 전부 제외) ---");
let sheet640 = 0;
for (const r of mapToDailyRows(theoryDaily)) {
  if (r.payType === "방과후" && new Date(r.dateStr + "T12:00:00").getDay() !== 2) sheet640 += r.minutes;
}
console.log("이론 월 전체 Mon+Thu+Wed? (화 제외):", sheet640);
