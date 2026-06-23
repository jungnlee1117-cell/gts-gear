#!/usr/bin/env node
/**
 * skipped payroll_entries → schedule_change_notifications 백필
 * (pay_type 컬럼 미적용 등으로 알림 insert가 실패한 경우 복구)
 *
 *   node scripts/backfill-schedule-change-notifications.mjs --dry-run
 *   node scripts/backfill-schedule-change-notifications.mjs
 *   node scripts/backfill-schedule-change-notifications.mjs --teacher 어욱진 --from 2026-05-01
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  buildScheduleChangeNotificationRow,
  formatOriginalSchedule,
  shouldNotifyScheduleChange,
} from "../src/schedule/scheduleChangeNotifications.js";
import { homeVisitOccurrenceToPlanned } from "../src/schedule/payrollCalendar.js";
import { expandPattern } from "../src/schedule/homeVisitPatterns.js";
import { isKoreanHoliday } from "../src/schedule/koreanHolidays.js";
import { minutesBetween } from "../src/schedule/constants.js";

const DRY = process.argv.includes("--dry-run");
const teacherArg = process.argv.find((a, i) => process.argv[i - 1] === "--teacher");
const fromArg = process.argv.find((a, i) => process.argv[i - 1] === "--from") || "2026-01-01";

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

function slotToPlanned(slot, dateStr) {
  const start = slot.start_time?.slice(0, 5) ?? "";
  const end = slot.end_time?.slice(0, 5) ?? "";
  return {
    source: "institution",
    slot,
    patternId: null,
    dateStr,
    institutionId: slot.institution_id,
    institutionName: slot.institutions?.name ?? "",
    studentName: null,
    payType: slot.class_type,
    startTime: start,
    endTime: end,
    scheduledMinutes: minutesBetween(start, end),
  };
}

async function createNotification(row) {
  const core = {
    teacher_id: row.teacher_id,
    institution_id: row.institution_id ?? null,
    class_date: row.class_date,
    schedule_slot_id: row.schedule_slot_id ?? null,
    change_type: row.change_type,
    original_schedule: row.original_schedule,
    actual_handling: row.actual_handling,
  };
  const extended = { ...core };
  if (row.pay_type) extended.pay_type = row.pay_type;
  if (row.home_visit_pattern_id) extended.home_visit_pattern_id = row.home_visit_pattern_id;

  let { error } = await sb.from("schedule_change_notifications").insert(extended);
  if (error && /pay_type|home_visit_pattern_id/.test(error.message || "")) {
    ({ error } = await sb.from("schedule_change_notifications").insert(core));
  }
  if (error) throw error;
}

let teacherId = null;
if (teacherArg) {
  const t = (await sb.from("teachers").select("id").eq("name", teacherArg).single()).data;
  if (!t) throw new Error(`Teacher not found: ${teacherArg}`);
  teacherId = t.id;
}

let q = sb.from("payroll_entries")
  .select("*, institutions(name)")
  .eq("entry_status", "skipped")
  .gte("class_date", fromArg);
if (teacherId) q = q.eq("teacher_id", teacherId);

const skipped = (await q.order("class_date")).data ?? [];

const existing = (await sb.from("schedule_change_notifications").select("teacher_id, class_date, schedule_slot_id, home_visit_pattern_id, change_type").gte("class_date", fromArg)).data ?? [];
const existsKey = new Set(
  existing.map(n => `${n.teacher_id}|${n.class_date}|${n.schedule_slot_id || ""}|${n.home_visit_pattern_id || ""}|${n.change_type}`),
);

const slotIds = [...new Set(skipped.map(e => e.schedule_slot_id).filter(Boolean))];
const patternIds = [...new Set(skipped.map(e => e.home_visit_pattern_id).filter(Boolean))];

const slotMap = new Map();
if (slotIds.length) {
  const slots = (await sb.from("institution_weekly_schedule").select("*, institutions(name)").in("id", slotIds)).data ?? [];
  for (const s of slots) slotMap.set(s.id, s);
}

const patternMap = new Map();
if (patternIds.length) {
  const pats = (await sb.from("home_visit_patterns").select("*").in("id", patternIds)).data ?? [];
  for (const p of pats) patternMap.set(p.id, p);
}

let created = 0;
let skippedHoliday = 0;
let skippedExists = 0;
let skippedNoPlan = 0;

for (const entry of skipped) {
  if (isKoreanHoliday(entry.class_date)) {
    skippedHoliday++;
    continue;
  }

  const key = `${entry.teacher_id}|${entry.class_date}|${entry.schedule_slot_id || ""}|${entry.home_visit_pattern_id || ""}|skipped`;
  if (existsKey.has(key)) {
    skippedExists++;
    continue;
  }

  let planned = null;
  if (entry.home_visit_pattern_id) {
    const pattern = patternMap.get(entry.home_visit_pattern_id);
    if (pattern) {
      const occ = expandPattern(pattern, entry.class_date, entry.class_date)[0];
      if (occ) planned = homeVisitOccurrenceToPlanned(occ);
    }
  } else if (entry.schedule_slot_id) {
    const slot = slotMap.get(entry.schedule_slot_id);
    if (slot) planned = slotToPlanned(slot, entry.class_date);
  }

  if (!planned) {
    // 슬롯 삭제 등 — payroll entry 메타로 최소 복구
    const start = entry.class_date;
    planned = {
      source: entry.home_visit_pattern_id ? "home_visit" : "institution",
      slot: { id: entry.schedule_slot_id || entry.home_visit_pattern_id },
      patternId: entry.home_visit_pattern_id || null,
      dateStr: entry.class_date,
      institutionId: entry.institution_id,
      institutionName: entry.institutions?.name || "",
      studentName: null,
      payType: entry.pay_type,
      startTime: "00:00",
      endTime: "00:00",
      scheduledMinutes: 0,
    };
    if (!entry.schedule_slot_id && !entry.home_visit_pattern_id) {
      skippedNoPlan++;
      continue;
    }
  }

  const payload = {
    teacher_id: entry.teacher_id,
    institution_id: entry.institution_id || null,
    class_date: entry.class_date,
    pay_type: entry.pay_type,
    minutes: 0,
    entry_status: "skipped",
    schedule_slot_id: entry.schedule_slot_id || null,
    home_visit_pattern_id: entry.home_visit_pattern_id || null,
  };

  if (!shouldNotifyScheduleChange(planned, payload)) continue;

  const row = buildScheduleChangeNotificationRow(planned, payload);
  if (planned.scheduledMinutes === 0 && entry.schedule_slot_id && slotMap.get(entry.schedule_slot_id)) {
    row.original_schedule = formatOriginalSchedule(planned);
  }

  console.log(DRY ? "[dry-run] create" : "create", entry.class_date, entry.pay_type, row.original_schedule);
  if (!DRY) await createNotification(row);
  created++;
  existsKey.add(key);
}

console.log("\nDone.", DRY ? "(dry-run)" : "");
console.log("created", created, "skipped_holiday", skippedHoliday, "already_exists", skippedExists, "no_plan", skippedNoPlan);
