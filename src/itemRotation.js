/**
 * 교구 순환 — items 테이블 이름 매칭·충돌 검사
 */

const LETTERS = "ABCDEFGHIJKL".split("");
export const ROTATION_LETTERS = LETTERS;

/** 순환표 강사 순서 (item_rotation_teachers.json 과 동일) */
export const ROTATION_TEACHER_ORDER = [
  "정티처", "오정석", "레이첼", "어욱진", "안소연", "김종현",
  "공다연", "서은총", "김하원", "윤한경", "공성주", "오주영",
];

/** 순환표 이름 → teachers.name (관리자 본명) */
export const ROTATION_SHEET_NAME_TO_DB_NAME = {
  레이첼: "양의인",
  마이크: "오정석",
};

/** 교구 순환 조회 — 항상 로그인 본인 teachers.id (담당 원 필터와 무관) */
export function rotationSubjectTeacherId(me) {
  return me?.id ?? null;
}

export function rotationTeacherIndexForUser(me) {
  const dbName = me?.name;
  if (!dbName) return -1;
  return ROTATION_TEACHER_ORDER.findIndex(sheetName => {
    const mapped = ROTATION_SHEET_NAME_TO_DB_NAME[sheetName] || sheetName;
    return mapped === dbName || sheetName === dbName;
  });
}

function defaultSchoolYearStart(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return m >= 3 ? y : y - 1;
}

export function inferAssignedLetterForMonth(me, monthKey, startYear) {
  const idx = rotationTeacherIndexForUser(me);
  if (idx < 0) return null;
  const [y, mo] = String(monthKey).slice(0, 7).split("-").map(Number);
  const yr = startYear ?? (mo >= 3 ? y : y - 1);
  const months = schoolYearMonths(yr);
  const monthIndex = months.indexOf(String(monthKey).slice(0, 7));
  if (monthIndex < 0) return null;
  return letterForTeacherMonth(idx, monthIndex);
}

/** DB 배정 + 순환표 패턴 fallback (본인 계정 기준) */
export function resolveRotationSchedules(dbSchedules, me, startYear) {
  const subjectId = rotationSubjectTeacherId(me);
  if (!subjectId) return [];
  const yr = startYear ?? defaultSchoolYearStart();
  const months = schoolYearMonths(yr);
  const byMonth = new Map();
  for (const row of dbSchedules || []) {
    if (row.teacher_id !== subjectId) continue;
    byMonth.set(String(row.year_month).slice(0, 7), row);
  }
  return months.map(ym => {
    const existing = byMonth.get(ym);
    if (existing?.assigned_letter) return existing;
    const letter = inferAssignedLetterForMonth(me, ym, startYear);
    if (!letter) return null;
    return {
      year_month: `${ym}-01`,
      assigned_letter: letter,
      teacher_id: subjectId,
      inferred: true,
    };
  }).filter(Boolean);
}

export function assignedLetterForMonth(schedules, me, monthKey) {
  const prefix = String(monthKey).slice(0, 7);
  const row = (schedules || []).find(s =>
    s.year_month?.startsWith(prefix) && s.teacher_id === rotationSubjectTeacherId(me),
  );
  return row?.assigned_letter || inferAssignedLetterForMonth(me, monthKey);
}

/** 시트 교구명 → DB items.name 수동 매핑 (점검 후 확장) */
export const ITEM_NAME_ALIASES = {
  "사각징검다리/방구": "밸런스 징검다리",
  "에어허들": "에어 허들",
  "딱딱이컵": "스태킹컵(작은컵)",
  "스태킹컵 (작은컵)": "스태킹컵(작은컵)",
  "에어도넛": "에어 도넛",
  "에어브릿지": "레인보우 브릿지",
  "에어사각브릿지": "레인보우 브릿지",
  "에어스파이더": "에어 스파이더",
  "에어지네": "에어 지네",
  "에어클라이밍": "에어 둥근 클라이밍 매트",
  "에어삼각사다리": "에어 자이언트 삼각다리",
  "에어정글짐": "에어 정글짐",
  "에어옥타곤": "에어 T 터널",
  "에어트램폴린": "에어트램폴린",
  "에어T터널": "에어 T 터널",
  "에어사다리": "에어 사다리",
  "에어육각": "에어 T 터널",
  "스테핑 스톤(스켈레톤)": "밸런스 스톤 세트",
  "도미노(벽돌)": "미니 도미노",
  "매트(구르기)": "롱매트 (long matt)",
  "아이짐징검다리": "아이짐 원형링",
  "모양징검다리": "모양 징검다리",
  "원형징검다리": "원형 징검다리",
  "악어징검다리": "악어 징검다리",
  "웨이브징검다리": "웨이브징검다리",
  "무빙바스켓": "무빙 바스켓",
  "애벌레징검다리": "애벌레 징검다리",
  "밸런스쿠션": "밸런스 쿠션",
  "고슴도치쿠션": "고슴도치공",
  "점핑블럭": "점핑 블럭",
  "점보컵쌓기": "점보컵",
  "파이프공나르기": "파이프 공 나르기",
  "타이어굴리기": "타이어",
  "캐치볼": "캐치볼 (Catchball)",
  "축구공": "축구공 3호",
  "호핑볼": "호핑볼 (Hopping ball)",
  "풍선치기": "풍선 라켓",
  "플라잉디스크": "플라잉디스크",
  "런닝맨": "런닝맨 (벨크로 조끼)",
  "노랑터널": "노랑허들",
  "사각매트": "사각매트 (rectangle matt)",
  "터널통과하기": "무지개터널",
  "터널통과": "무지개터널",
  "다트축구공": "축구공 3호",
  "펭귄놀이": "펭귄수트",
  "집게": "로봇집게",
  "미니스틱": "미니 하키스틱",
  "스펀지 체조볼": "에어 체조볼 (Gymnastic ball)",
};

export function normalizeItemName(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

export function resolveItemRecord(items, sheetName) {
  const raw = normalizeItemName(sheetName);
  if (!raw) return null;
  const alias = ITEM_NAME_ALIASES[raw];
  const candidates = [raw, alias].filter(Boolean);
  for (const c of candidates) {
    const exact = items.find(i => normalizeItemName(i.name) === c || normalizeItemName(i.alias) === c);
    if (exact) return exact;
  }
  return null;
}

export function yearMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function yearMonthFirstDay(key) {
  return `${key}-01`;
}

export function nextYearMonthKey(key) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m, 1);
  return yearMonthKey(d);
}

export function schoolYearMonths(startYear = 2026) {
  const months = [];
  for (let m = 3; m <= 12; m++) months.push(`${startYear}-${String(m).padStart(2, "0")}`);
  months.push(`${startYear + 1}-01`, `${startYear + 1}-02`);
  return months;
}

/** 순환표 기본 패턴 (스냅샷 시드용) — teacherOrder 인덱스만큼 월별 알파벳 시프트 */
export function letterForTeacherMonth(teacherIndex, monthIndex) {
  return LETTERS[(monthIndex + teacherIndex) % 12];
}

export function formatWeekRange(start, end) {
  if (!start || !end) return null;
  const fmt = (d) => {
    const x = new Date(`${d}T12:00:00`);
    return `${x.getMonth() + 1}/${x.getDate()}`;
  };
  return `${fmt(start)} ~ ${fmt(end)}`;
}

export function isAirProductName(name, weekNumber) {
  if (weekNumber === 4) return true;
  return /에어/i.test(name || "");
}

export function getMonthRotationAssignments(rotationSchedule, yearMonthKey) {
  const prefix = String(yearMonthKey).slice(0, 7);
  return (rotationSchedule || []).filter(r =>
    r.year_month?.startsWith(prefix) || r.year_month === yearMonthFirstDay(prefix),
  );
}

/** 같은 달 서로 다른 알파벳에 동일 교구가 배정되는 경우 */
export function findMonthlyCrossLetterDuplicates(weeklyLists, rotationSchedule, yearMonthKey) {
  const assignments = getMonthRotationAssignments(rotationSchedule, yearMonthKey);
  const lettersInMonth = [...new Set(assignments.map(a => a.assigned_letter))];
  const itemToLetters = new Map();

  for (const letter of lettersInMonth) {
    for (const row of weeklyLists || []) {
      if (row.letter !== letter) continue;
      const key = `${row.target_type}|${normalizeItemName(row.item_name)}`;
      if (!itemToLetters.has(key)) itemToLetters.set(key, new Set());
      itemToLetters.get(key).add(letter);
    }
  }

  const dupes = [];
  for (const [key, letters] of itemToLetters) {
    if (letters.size < 2) continue;
    const [target_type, item_name] = key.split("|");
    dupes.push({
      target_type,
      item_name,
      letters: [...letters].sort(),
    });
  }
  return dupes.sort((a, b) => a.item_name.localeCompare(b.item_name, "ko"));
}

export function lettersConflictingForItem(weeklyLists, rotationSchedule, yearMonthKey, {
  targetType, itemName, excludeLetter,
}) {
  const normalized = normalizeItemName(itemName);
  if (!normalized) return [];
  const assignments = getMonthRotationAssignments(rotationSchedule, yearMonthKey);
  const lettersInMonth = [...new Set(assignments.map(a => a.assigned_letter))];
  return lettersInMonth.filter(letter => {
    if (letter === excludeLetter) return false;
    return (weeklyLists || []).some(w =>
      w.letter === letter
      && w.target_type === targetType
      && normalizeItemName(w.item_name) === normalized,
    );
  });
}

const NOON = (d) => {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x;
};

function parseLocalDay(value) {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 오늘(또는 지정일)이 속한 주 — 월요일 00:00 ~ 일요일 (날짜만) */
export function getCalendarWeekRange(date = new Date()) {
  const d = parseLocalDay(date instanceof Date ? toYmd(date) : date) || new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    monday,
    sunday,
    startYmd: toYmd(monday),
    endYmd: toYmd(sunday),
  };
}

/** 해당 월의 N번째 월요일 (1-based) */
export function mondayIndexInMonth(monday) {
  const y = monday.getFullYear();
  const m = monday.getMonth();
  let idx = 0;
  for (let day = 1; day <= 31; day++) {
    const cur = new Date(y, m, day);
    if (cur.getMonth() !== m) break;
    if (cur.getDay() === 1) {
      idx += 1;
      if (cur.getTime() === monday.getTime()) return idx;
    }
  }
  return idx || 1;
}

/** 예: 6월 29일(월)이 6월 5번째 월요일 → "6월 5주차" */
export function formatCalendarWeekLabel(date = new Date()) {
  const { monday } = getCalendarWeekRange(date);
  const month = monday.getMonth() + 1;
  return `${month}월 ${mondayIndexInMonth(monday)}주차`;
}

export function formatCalendarWeekRange(date = new Date()) {
  const { startYmd, endYmd } = getCalendarWeekRange(date);
  return formatWeekRange(startYmd, endYmd);
}

function overlapDays(aStart, aEnd, bStart, bEnd) {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (start > end) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

/** Mon~Sun 주간과 겹치는 순환 주차 슬롯 (겹침 일수 최대) */
export function findRotationWeekForCalendarWeek(monthWeeks, date = new Date()) {
  const { startYmd, endYmd } = getCalendarWeekRange(date);
  const calStart = parseLocalDay(startYmd);
  const calEnd = parseLocalDay(endYmd);
  if (!calStart || !calEnd) return null;

  let best = null;
  let bestDays = 0;
  for (const w of sortMonthWeeks(monthWeeks)) {
    const ws = parseLocalDay(w.week_start_date);
    const we = parseLocalDay(w.week_end_date);
    if (!ws || !we) continue;
    const days = overlapDays(ws, we, calStart, calEnd);
    if (days > bestDays) {
      bestDays = days;
      best = w;
    }
  }
  return best;
}

/** 다음 Mon~Sun 주의 순환 주차 슬롯 */
export function findNextCalendarWeekRotationSlot(monthWeeks, date = new Date()) {
  const { monday } = getCalendarWeekRange(date);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return findRotationWeekForCalendarWeek(monthWeeks, nextMonday);
}

/** DB 순환 슬롯 → Mon~Sun 주차 라벨·범위 (표시용) */
export function calendarWeekMetaForRotationSlot(slot) {
  if (!slot?.week_start_date || !slot?.week_end_date) return null;
  const slotStart = parseLocalDay(slot.week_start_date);
  const slotEnd = parseLocalDay(slot.week_end_date);
  if (!slotStart || !slotEnd) return null;

  let bestMonday = null;
  let bestDays = 0;
  for (let cur = new Date(slotStart); cur <= slotEnd; cur.setDate(cur.getDate() + 1)) {
    const { monday, startYmd, endYmd } = getCalendarWeekRange(cur);
    const calStart = parseLocalDay(startYmd);
    const calEnd = parseLocalDay(endYmd);
    const days = overlapDays(slotStart, slotEnd, calStart, calEnd);
    if (days > bestDays) {
      bestDays = days;
      bestMonday = monday;
    }
  }
  if (!bestMonday) return null;
  const { startYmd, endYmd } = getCalendarWeekRange(bestMonday);
  return {
    label: formatCalendarWeekLabel(bestMonday),
    range: formatWeekRange(startYmd, endYmd),
  };
}

export function sortMonthWeeks(weeks) {
  return [...(weeks || [])].sort((a, b) => {
    const as = a.week_start_date || "";
    const bs = b.week_start_date || "";
    return as.localeCompare(bs) || a.week_number - b.week_number;
  });
}

/** 오늘이 포함된 주차 슬롯 (없으면 null) */
export function findWeekSlotForDate(monthWeeks, date = new Date()) {
  const today = NOON(date);
  for (const w of sortMonthWeeks(monthWeeks)) {
    if (!w.week_start_date || !w.week_end_date) continue;
    const start = NOON(`${w.week_start_date}T12:00:00`);
    const end = NOON(`${w.week_end_date}T12:00:00`);
    if (today >= start && today <= end) return w;
  }
  return null;
}

/** 현재 주차 다음 슬롯 */
export function findNextWeekSlot(monthWeeks, currentSlot) {
  if (!currentSlot) return null;
  const sorted = sortMonthWeeks(monthWeeks);
  const idx = sorted.findIndex(w =>
    w.year_month === currentSlot.year_month && w.week_number === currentSlot.week_number,
  );
  if (idx >= 0 && idx < sorted.length - 1) return sorted[idx + 1];
  return null;
}

/** 유치원/어린이집 주차 교구 병합 표시 */
export function mergeWeeklyItemsForWeek(kgRow, daycareRow) {
  const kgName = kgRow?.item_name ? normalizeItemName(kgRow.item_name) : null;
  const dcName = daycareRow?.item_name ? normalizeItemName(daycareRow.item_name) : null;
  if (!kgName && !dcName) return null;

  if (kgName && dcName && kgName === dcName) {
    return {
      merged: true,
      item_name: kgName,
      displayName: kgName,
      is_air_product: Boolean(kgRow?.is_air_product || daycareRow?.is_air_product),
      simple_activity: (kgRow?.simple_activity || daycareRow?.simple_activity || "").trim() || null,
    };
  }

  const parts = [];
  if (kgName) parts.push({ label: "유치원", name: kgName, row: kgRow });
  if (dcName) parts.push({ label: "어린이집", name: dcName, row: daycareRow });

  return {
    merged: false,
    item_name: kgName || dcName,
    displayName: parts.map(p => p.name).join(" · "),
    parts,
    is_air_product: Boolean(kgRow?.is_air_product || daycareRow?.is_air_product),
    simple_activity: null,
    simpleActivities: parts
      .map(p => p.row?.simple_activity?.trim())
      .filter(Boolean),
  };
}

export function getWeekItemsForLetter(weeklyLists, letter, weekNumber) {
  const kg = weeklyLists.find(w =>
    w.letter === letter && w.week_number === weekNumber && w.target_type === "유치원",
  );
  const daycare = weeklyLists.find(w =>
    w.letter === letter && w.week_number === weekNumber && w.target_type === "어린이집",
  );
  return mergeWeeklyItemsForWeek(kg, daycare);
}
