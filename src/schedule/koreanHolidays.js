/**
 * 한국 법정 공휴일 (연도별 정적 데이터)
 *
 * ⚠️ 매년 갱신 필요 — 공공 API 연동 없이 하드코딩 방식입니다.
 * 새 연도가 시작되면 이 파일에 해당 연도 목록을 추가해 주세요.
 * (대체공휴일·임시공휴일은 정부 고시 기준으로 반영)
 */

/** @type {Record<string, Array<{ date: string, name: string }>>} */
export const KOREAN_HOLIDAYS_BY_YEAR = {
  2026: [
    { date: "2026-01-01", name: "신정" },
    { date: "2026-02-16", name: "설날 연휴" },
    { date: "2026-02-17", name: "설날" },
    { date: "2026-02-18", name: "설날 연휴" },
    { date: "2026-03-01", name: "삼일절" },
    { date: "2026-03-02", name: "삼일절 대체" },
    { date: "2026-05-05", name: "어린이날" },
    { date: "2026-05-24", name: "부처님오신날" },
    { date: "2026-05-25", name: "부처님오신날 대체" },
    { date: "2026-06-03", name: "지방선거" },
    { date: "2026-06-06", name: "현충일" },
    { date: "2026-07-17", name: "제헌절" },
    { date: "2026-08-15", name: "광복절" },
    { date: "2026-08-17", name: "광복절 대체" },
    { date: "2026-09-24", name: "추석 연휴" },
    { date: "2026-09-25", name: "추석" },
    { date: "2026-09-26", name: "추석 연휴" },
    { date: "2026-10-03", name: "개천절" },
    { date: "2026-10-05", name: "개천절 대체" },
    { date: "2026-10-09", name: "한글날" },
    { date: "2026-12-25", name: "성탄절" },
  ],
};

const HOLIDAY_MAP = new Map();
for (const [year, list] of Object.entries(KOREAN_HOLIDAYS_BY_YEAR)) {
  for (const h of list) {
    HOLIDAY_MAP.set(h.date, { ...h, year });
  }
}

/** @returns {{ date: string, name: string, year: string } | null} */
export function getKoreanHoliday(dateStr) {
  return HOLIDAY_MAP.get(dateStr) ?? null;
}

export function isKoreanHoliday(dateStr) {
  return HOLIDAY_MAP.has(dateStr);
}

/** 캘린더 셀용 짧은 라벨 (4글자 초과 시 축약) */
export function holidayShortLabel(name) {
  if (name.length <= 4) return name;
  if (name.includes("대체")) return name.replace(" 대체", "↔");
  return name.slice(0, 3);
}

export function hasHolidayDataForYear(year) {
  return Boolean(KOREAN_HOLIDAYS_BY_YEAR[String(year)]?.length);
}

export function holidaysForMonth(year, month) {
  const list = KOREAN_HOLIDAYS_BY_YEAR[String(year)] ?? [];
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  return list.filter(h => h.date.startsWith(prefix));
}
