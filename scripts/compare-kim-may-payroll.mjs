#!/usr/bin/env node
/**
 * 김종현 2026-05 급여 비교 (시스템 vs 구글시트)
 *   node scripts/compare-kim-may-payroll.mjs
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

/** 구글시트 5월 — 정규 2480 / 방과후 560 (총 3040) */
function buildSheetReference() {
  const rows = [];
  const regularByDow = { 1: 200, 2: 200, 3: 120, 4: 200 };
  const afterByDow = { 1: 80, 4: 80 };
  const skipDates = new Set(["2026-05-05", "2026-05-25"]);

  for (let day = 1; day <= 31; day++) {
    const dateStr = `2026-05-${String(day).padStart(2, "0")}`;
    if (skipDates.has(dateStr)) continue;
    const dow = new Date(`${dateStr}T12:00:00`).getDay();
    if (regularByDow[dow]) rows.push({ dateStr, payType: "정규", minutes: regularByDow[dow] });
    if (afterByDow[dow]) rows.push({ dateStr, payType: "방과후", minutes: afterByDow[dow] });
  }
  return rows;
}

const SHEET_REFERENCE = buildSheetReference();
const SHEET_TOTALS = { 정규: 2480, 방과후: 560 };

const teacher = (await sb.from("teachers").select("id,name").eq("name", "김종현").single()).data;
const entries = (await sb.from("payroll_entries").select("*, institutions(name)").eq("teacher_id", teacher.id)
  .gte("class_date", "2026-05-01").lte("class_date", "2026-05-31").order("class_date")).data;
const weeklySlots = (await sb.from("institution_weekly_schedule").select("*, institutions(name)").eq("teacher_id", teacher.id)).data;

const raw = buildRawPayrollEntryRows(entries, weeklySlots);
const systemDaily = aggregateDailyMinutes(raw, { includedOnly: true });
const theoryDaily = buildScheduleTheoryDaily({
  weeklySlots, exceptions: [], year: 2026, month: 4, excludeLunchSlot: true,
});
const referenceDaily = referenceRowsToMap(SHEET_REFERENCE);

const cmp = buildThreeWayComparison({ systemDaily, referenceDaily, theoryDaily });

console.log("=== 김종현 2026-05 급여 비교 (시스템 vs 구글시트) ===\n");
console.log("시스템(확정):", cmp.summary.systemTotals, "합", cmp.summary.systemTotals.정규 + cmp.summary.systemTotals.방과후);
console.log("구글시트:", SHEET_TOTALS, "합", SHEET_TOTALS.정규 + SHEET_TOTALS.방과후);
console.log("스케줄 이론(현재 주간표):", cmp.summary.theoryTotals, "합", cmp.summary.theoryTotals.정규 + cmp.summary.theoryTotals.방과후);

const regDiff = cmp.summary.systemTotals.정규 - SHEET_TOTALS.정규;
const aftDiff = cmp.summary.systemTotals.방과후 - SHEET_TOTALS.방과후;
console.log("\n시트 vs 시스템 차이: 정규", regDiff, "/ 방과후", aftDiff);

if (!cmp.rows.some(r => r.hasMismatch)) {
  console.log("\n✓ 일별·구분별 전부 일치");
} else {
  console.log("\n--- 일별 비교 (불일치만) ---");
  for (const row of cmp.rows.filter(r => r.hasMismatch)) {
    console.log([
      row.dateStr,
      row.payType,
      `시트=${row.referenceMinutes ?? "—"}`,
      `시스템=${row.systemMinutes ?? "—"}`,
      row.issue,
    ].join(" | "));
  }
}

console.log("\n--- 점검: 옛 스케줄 잔재 ---");
const LUNCH = ["bde10002-016b-4f8f-bd2c-771e46aa9aa9", "daa6e376-9113-4daf-8260-2e2d1c9d97b1", "2f9ff774-43b5-426c-a893-313e07878e08"];
const TUE_AFTER = "0cede120-a1c4-44fc-af3e-82fc01a334de";
const AFTER = ["b1b4f4d7-b2ea-43b5-97ef-98c723e59a22", "ab712c35-59c0-446e-9187-42d84cb1231f"];

const lunchEntries = raw.filter(r => LUNCH.includes(r.scheduleSlotId));
const tueAfterEntries = raw.filter(r => r.scheduleSlotId === TUE_AFTER);
const after85 = raw.filter(r => AFTER.includes(r.scheduleSlotId) && r.entryMinutes === 85);
console.log("점심 슬롯 entry:", lunchEntries.length, "건");
console.log("화요일 방과후 entry:", tueAfterEntries.length, "건");
console.log("방과후 85분 entry:", after85.length, "건");

console.log("\n--- 시스템 일별 확정 ---");
for (const r of mapToDailyRows(systemDaily)) console.log(r.dateStr, r.payType, r.minutes);

console.log("\n--- 구글시트 일별 ---");
for (const r of SHEET_REFERENCE) console.log(r.dateStr, r.payType, r.minutes);
