/**
 * 영어체육 월간 계획안 — 교구 순환 연동 헬퍼
 */

import { normalizeItemName, schoolYearMonths, yearMonthFirstDay, yearMonthKey } from "./itemRotation.js";

export { schoolYearMonths };

/** 영문 교구명 정규화 (대소문자·공백) */
export function normalizeEquipmentEn(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

export function normalizeEquipmentEnKey(name) {
  return normalizeEquipmentEn(name).toUpperCase();
}

/** 학년도 시작 연도 (3월~ → 해당 연도, 1~2월 → 전년도) */
export function schoolYearStartYear(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return m >= 3 ? y : y - 1;
}

export function schoolYearBounds(startYear = schoolYearStartYear()) {
  const months = schoolYearMonths(startYear);
  return { startYear, months, first: months[0], last: months[months.length - 1] };
}

export function prevSchoolYearMonth(key, startYear = schoolYearStartYear()) {
  const months = schoolYearMonths(startYear);
  const prefix = String(key).slice(0, 7);
  const i = months.indexOf(prefix);
  if (i <= 0) return null;
  return months[i - 1];
}

export function nextSchoolYearMonth(key, startYear = schoolYearStartYear()) {
  const months = schoolYearMonths(startYear);
  const prefix = String(key).slice(0, 7);
  const i = months.indexOf(prefix);
  if (i < 0 || i >= months.length - 1) return null;
  return months[i + 1];
}

export function clampToSchoolYear(key, startYear = schoolYearStartYear()) {
  const { months } = schoolYearBounds(startYear);
  const prefix = String(key).slice(0, 7);
  if (months.includes(prefix)) return prefix;
  const now = yearMonthKey();
  if (months.includes(now)) return now;
  return months[0];
}

/** aliases: [{ equipment_name_en, item_name_ko }] */
export function buildAliasMaps(aliases) {
  const enToKo = new Map();
  const koToEn = new Map();
  for (const a of aliases || []) {
    const en = normalizeEquipmentEn(a.equipment_name_en);
    const ko = normalizeItemName(a.item_name_ko);
    if (!en || !ko) continue;
    enToKo.set(normalizeEquipmentEnKey(en), ko);
    koToEn.set(ko, en);
  }
  return { enToKo, koToEn };
}

export function resolveKoreanFromEnglish(equipmentNameEn, aliasMaps) {
  const key = normalizeEquipmentEnKey(equipmentNameEn);
  return aliasMaps.enToKo.get(key) || null;
}

export function resolveEnglishFromKorean(itemNameKo, aliasMaps) {
  const ko = normalizeItemName(itemNameKo);
  return aliasMaps.koToEn.get(ko) || null;
}

/** 주차별 계획 + 한글 교구명 연결 */
export function linkLessonPlanToWeeklyItem(lessonRow, itemNameKo, aliasMaps) {
  if (!lessonRow) return null;
  const linkedKo = resolveKoreanFromEnglish(lessonRow.equipment_name_en, aliasMaps);
  const ko = normalizeItemName(itemNameKo);
  const enKey = normalizeEquipmentEnKey(lessonRow.equipment_name_en);
  const itemEn = resolveEnglishFromKorean(ko, aliasMaps);
  const matches = linkedKo === ko
    || (itemEn && normalizeEquipmentEnKey(itemEn) === enKey)
    || normalizeEquipmentEnKey(ko) === enKey;
  if (!matches) return null;
  return lessonRow;
}

export function findLessonPlanForWeek(lessonPlans, yearMonthKey, weekNumber) {
  const prefix = String(yearMonthKey).slice(0, 7);
  return (lessonPlans || []).find(p =>
    p.year_month?.startsWith(prefix) && Number(p.week_number) === Number(weekNumber),
  ) || null;
}

export function findLessonPlanForKoreanItem(lessonPlans, aliases, yearMonthKey, weekNumber, itemNameKo) {
  const plan = findLessonPlanForWeek(lessonPlans, yearMonthKey, weekNumber);
  if (!plan) return null;
  const maps = buildAliasMaps(aliases);
  return linkLessonPlanToWeeklyItem(plan, itemNameKo, maps) ? plan : null;
}

export function findUnmatchedEquipment(lessonPlans, aliases, weeklyKoNames) {
  const maps = buildAliasMaps(aliases);
  const koSet = new Set((weeklyKoNames || []).map(normalizeItemName));
  const unmatched = [];

  for (const row of lessonPlans || []) {
    const ko = resolveKoreanFromEnglish(row.equipment_name_en, maps);
    if (!ko) {
      unmatched.push({ type: "no_alias", equipment_name_en: row.equipment_name_en, year_month: row.year_month, week_number: row.week_number });
      continue;
    }
    if (weeklyKoNames && koSet.size && !koSet.has(ko)) {
      unmatched.push({ type: "not_in_weekly_lists", equipment_name_en: row.equipment_name_en, item_name_ko: ko, year_month: row.year_month, week_number: row.week_number });
    }
  }
  return unmatched;
}

export function monthLabel(key) {
  const [y, m] = String(key).slice(0, 7).split("-").map(Number);
  return `${y}년 ${m}월`;
}

export function yearMonthFirstDayFromKey(key) {
  return yearMonthFirstDay(String(key).slice(0, 7));
}
