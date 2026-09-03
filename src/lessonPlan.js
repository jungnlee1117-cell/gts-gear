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

const GENERIC_ENGLISH_EQUIPMENT_NAMES = /^(selected equipment|movement activity equipment|activity equipment|sports equipment|equipment)$/i;

const KOREAN_EQUIPMENT_ENGLISH_NAMES = {
  "사각징검다리/방구": "Square Balance Stepping Stones", "밸런스 징검다리": "Balance Stepping Stones",
  "웨이브징검다리": "Wave Stepping Stones", "짐볼": "Gym Ball", "벨크로타겟": "Velcro Target Game",
  "스카프": "Juggling Scarves", "스쿠프": "Scoop Ball Set", "펜싱": "Kids' Fencing Set", "탱탱볼": "Bouncy Balls",
  "바운스라켓": "Bounce Racket Set", "무지개스톤": "Rainbow Stepping Stones", "빌리보": "Bilibo Balance Shell",
  "악어징검다리": "Crocodile Stepping Stones", "캐치컵": "Catch Cups", "도넛쌓기": "Donut Stacking Rings",
  "노랑터널": "Yellow Tunnel", "꼬리공": "Tail Balls", "스네이크로드": "Snake Balance Path",
  "원형징검다리": "Round Stepping Stones", "코퍼밴드": "Cooperative Band", "훌라후프": "Hula Hoops",
  "U매트": "U-Shaped Gym Mat", "뜀틀": "Vaulting Box", "안전공": "Soft Safety Balls", "오재미": "Bean Bags",
  "게이트볼": "Gateball Set", "자이언트 디스크": "Giant Balance Disc", "고고밸런스": "Go-Go Balance Board",
  "아이짐징검다리": "iGym Stepping Stones", "고슴도치공": "Hedgehog Sensory Balls", "손로켓": "Hand Rockets",
  "시소보드": "Seesaw Balance Board", "고리놀이": "Ring Toss Set", "다트축구공": "Dart Soccer Ball",
  "모양징검다리": "Shape Stepping Stones", "무당벌레": "Ladybug Balance Game", "하키": "Kids' Hockey Set",
  "매직공": "Magic Balls", "팝튜브": "Pop Tubes", "판뒤집기": "Flip Board Game", "썰매바퀴": "Sled Wheels",
  "사각빈백": "Square Bean Bags", "스텝롤": "Step Roll", "펀스틱": "Fun Sticks", "나노볼레": "Nano Volley Set",
  "캔낚시": "Can Fishing Game", "Ring Toss": "Ring Toss Set", "플레이로프": "Play Ropes", "파라슈트": "Play Parachute",
  "리본막대": "Rhythm Ribbons", "애벌레징검다리": "Caterpillar Stepping Stones",
};

/** 등록된 영문명이 없거나 일반 대체 문구일 때 한국어 교구명을 자연스러운 영문명으로 변환합니다. */
export function naturalEnglishEquipmentName(koreanName, registeredEnglishName = "") {
  const registered = normalizeEquipmentEn(registeredEnglishName);
  const value = String(koreanName || "").trim();
  if (KOREAN_EQUIPMENT_ENGLISH_NAMES[value]) return KOREAN_EQUIPMENT_ENGLISH_NAMES[value];
  if (/^yoya matt?\s*12\s*mm$/i.test(registered)) return "Yoga Mat (12 mm)";
  if (/^long bow$/i.test(registered)) return "Long Bow Set";
  if (/^mat$/i.test(registered)) return "Gym Mat";
  const plausibleRegisteredName = registered.length >= 4 && /[aeiou]/i.test(registered) && !/^[a-z]{4,6}$/i.test(registered);
  if (plausibleRegisteredName && !/[가-힣]/.test(registered) && !GENERIC_ENGLISH_EQUIPMENT_NAMES.test(registered)) return registered;
  const parentheticalEnglish = value.match(/\(([A-Za-z][A-Za-z\s-]{2,})\)/)?.[1]?.trim();
  if (parentheticalEnglish && !/^(long|rectangle) matt?$/i.test(parentheticalEnglish)) return parentheticalEnglish;
  if (/꽃게.*낚시|낚시.*꽃게/i.test(value)) return "Crab Fishing Game";
  if (/바다.*낚시|낚시/i.test(value)) return "Sea Animal Fishing Game";
  if (/도넛.*링/i.test(value)) return "Donut Rings";
  if (/에어.*도넛/i.test(value)) return "Air Donut";
  if (/에어\s*T\s*터널|에어\s*티\s*터널|T\s*터널|티\s*터널/i.test(value)) return "Air T-Tunnel";
  if (/무지개.*터널/i.test(value)) return "Rainbow Tunnel";
  if (/에어.*터널|터널/i.test(value)) return "Air Tunnel";
  if (/에어.*(둥근|동근).*클라이밍/i.test(value)) return "Air Round Climbing Mat";
  if (/에어.*클라이밍|클라이밍.*매트/i.test(value)) return "Air Climbing Mat";
  if (/에어.*(자이언트)?.*삼각.*(다리|사다리)/i.test(value)) return "Air Giant Triangle Bridge";
  if (/에어.*사각.*브릿지|레인보우.*브릿지/i.test(value)) return "Rainbow Air Bridge";
  if (/에어.*브릿지/i.test(value)) return "Air Bridge";
  if (/에어.*사다리/i.test(value)) return "Air Ladder";
  if (/에어.*스파이더/i.test(value)) return "Air Spider";
  if (/에어.*지네/i.test(value)) return "Air Caterpillar";
  if (/에어.*정글짐/i.test(value)) return "Air Jungle Gym";
  if (/에어.*트램폴린/i.test(value)) return "Air Trampoline";
  if (/에어.*허들/i.test(value)) return "Air Hurdles";
  if (/에어.*체조.*볼/i.test(value)) return "Air Gym Balls";
  if (/에어.*장애물|장애물/i.test(value)) return "Air Obstacle Course";
  if (/파이프.*공.*나르|공.*나르/i.test(value)) return "Pipe Ball Relay";
  if (/판.*뒤집/i.test(value)) return "Flip Board Game";
  if (/스펀지.*체조.*볼/i.test(value)) return "Sponge Gym Balls";
  if (/밸런스.*쿠션/i.test(value)) return "Balance Cushions";
  if (/고슴도치/i.test(value)) return "Hedgehog Balance Balls";
  if (/스테핑.*스톤|밸런스.*스톤|징검다리|징검/i.test(value)) return "Balance Stepping Stones";
  if (/아이짐.*원형.*링/i.test(value)) return "Round Activity Rings";
  if (/오자미|빈백|콩주머니/i.test(value)) return "Bean Bags";
  if (/무빙.*바스켓/i.test(value)) return "Moving Baskets";
  if (/점핑.*블럭/i.test(value)) return "Jumping Blocks";
  if (/점보.*컵/i.test(value)) return "Jumbo Cups";
  if (/스태킹.*컵|딱딱이컵/i.test(value)) return "Stacking Cups";
  if (/도미노|벽돌/i.test(value)) return "Domino Blocks";
  if (/타이어/i.test(value)) return "Activity Tire";
  if (/캐치.*볼/i.test(value)) return "Catch Ball Set";
  if (/호핑.*볼/i.test(value)) return "Hopping Ball";
  if (/풍선.*라켓|풍선치기/i.test(value)) return "Balloon Racket Set";
  if (/플라잉.*디스크/i.test(value)) return "Flying Discs";
  if (/런닝맨/i.test(value)) return "Running Man Velcro Vests";
  if (/펭귄/i.test(value)) return "Penguin Suits";
  if (/로봇.*집게|집게/i.test(value)) return "Robot Grabbers";
  if (/하키/i.test(value)) return "Mini Hockey Set";
  if (/축구공/i.test(value)) return "Soccer Balls";
  if (/농구/i.test(value)) return "Basketball Set";
  if (/줄넘/i.test(value)) return "Jump Ropes";
  if (/허들/i.test(value)) return "Hurdles";
  if (/롱.*매트|구르기.*매트/i.test(value)) return "Long Gym Mat";
  if (/사각.*매트/i.test(value)) return "Rectangle Gym Mat";
  if (/사다리/i.test(value)) return "Activity Ladder";
  if (/공|볼/i.test(value)) return "Soft Activity Balls";
  const cleaned = value.replace(/\([^)]*\)/g, "").trim();
  return cleaned && !/[가-힣]/.test(cleaned) ? cleaned : "GTS Activity Set";
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
