/**
 * 이번 주(월 00:00 ~ 일) 선생님 교구 브리핑 카드 데이터
 * — 배정은 item_rotation + 주간 스케줄만 사용 (추정·생성 금지)
 */
import {
  assignedLetterForMonth,
  findCurrentRotationWeekSlot,
  findNextRotationWeekSlot,
  formatWeekRange,
  getCalendarWeekRange,
  getWeekItemsForLetter,
  resolveItemRecord,
  rotationWeekRangeForSlot,
  yearMonthKey,
} from "../itemRotation.js";

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseParts(gear) {
  if (!gear) return [];
  if (gear.merged && gear.item_name) {
    return [{ targetLabel: null, itemName: gear.item_name, simpleActivity: gear.simple_activity || null }];
  }
  if (gear.parts?.length) {
    return gear.parts.map((p) => ({
      targetLabel: p.label || null,
      itemName: p.name,
      simpleActivity: p.row?.simple_activity || gear.simple_activity || null,
    }));
  }
  if (gear.item_name) {
    return [{ targetLabel: null, itemName: gear.item_name, simpleActivity: gear.simple_activity || null }];
  }
  return [];
}

function ageMetaFromTarget(targetLabel) {
  if (targetLabel === "유치원") {
    return {
      classLabel: "유치원 반",
      ageLabel: "만 3~5세 (배정 시트 기준 기본값)",
      ageBand: "3-5",
    };
  }
  if (targetLabel === "어린이집") {
    return {
      classLabel: "어린이집 반",
      ageLabel: "만 0~2세 중심 (기관·반에 따라 다를 수 있음)",
      ageBand: "0-2",
    };
  }
  return {
    classLabel: "담당 반",
    ageLabel: "연령 정보 없음 — 수업 시 확인 필요",
    ageBand: null,
  };
}

function sessionsInCalendarWeek(weeklySlots, startYmd, endYmd) {
  const start = new Date(`${startYmd}T12:00:00`);
  const end = new Date(`${endYmd}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const sessions = [];
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    const ymd = toYmd(cur);
    for (const slot of weeklySlots || []) {
      if (Number(slot.day_of_week) !== dow) continue;
      const institution = slot.institutions?.name || slot.institution?.name || null;
      if (!institution) continue;
      sessions.push({
        ymd,
        dow,
        institution,
        classType: slot.class_type || slot.label || "",
        startTime: slot.start_time ? String(slot.start_time).slice(0, 5) : "",
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  sessions.sort((a, b) => a.ymd.localeCompare(b.ymd) || a.startTime.localeCompare(b.startTime));
  return sessions;
}

function recommendActivities(itemName, simpleActivity, ageBand) {
  const fromSheet = String(simpleActivity || "")
    .split(/[/·|,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (fromSheet.length >= 3) return fromSheet;

  const ageHint = ageBand === "0-2"
    ? "짧은 탐색·모방"
    : ageBand === "3-5"
      ? "규칙 1~2개 + 짝 활동"
      : ageBand === "6+"
        ? "미션·리더 역할"
        : "시범 후 따라하기";

  const fallbacks = [
    `${itemName} 안전하게 만져보고 이름 말하기`,
    `${itemName}로 ${ageHint} 본활동`,
    `${itemName} 정리하며 영어 한 문장 복습`,
  ];

  const merged = [...fromSheet];
  for (const f of fallbacks) {
    if (merged.length >= 3) break;
    if (!merged.includes(f)) merged.push(f);
  }
  return merged.slice(0, 3);
}

/**
 * @returns {{
 *   calendarWeek: { startYmd: string, endYmd: string, label: string },
 *   asOf: string,
 *   letter: string|null,
 *   cards: object[],
 * }}
 */
export function buildWeeklyBriefingCards({
  schedules,
  weeklyLists,
  monthWeeks,
  weeklySlots,
  items,
  me,
  now = new Date(),
}) {
  const cal = getCalendarWeekRange(now);
  const calendarWeek = {
    startYmd: cal.startYmd,
    endYmd: cal.endYmd,
    label: `${cal.startYmd.slice(5).replace("-", "/")} ~ ${cal.endYmd.slice(5).replace("-", "/")}`,
  };
  const asOf = `${toYmd(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const nextDate = new Date(cal.monday);
  nextDate.setDate(cal.monday.getDate() + 7);
  const nextCal = getCalendarWeekRange(nextDate);
  const nextCalendarWeek = {
    startYmd: nextCal.startYmd,
    endYmd: nextCal.endYmd,
    label: `${nextCal.startYmd.slice(5).replace("-", "/")} ~ ${nextCal.endYmd.slice(5).replace("-", "/")}`,
  };
  const currentSlot = findCurrentRotationWeekSlot(monthWeeks, now);
  const nextSlot = findNextRotationWeekSlot(monthWeeks, now);
  const periods = [
    { key: "current", label: "이번 주 교구", slot: currentSlot, cal, calendarWeek },
    { key: "next", label: "다음 주 교구", slot: nextSlot, cal: nextCal, calendarWeek: nextCalendarWeek },
  ];

  /** @type {object[]} */
  const cards = [];
  const letters = {};

  const matchInstitutionsForTarget = (targetLabel, institutions) => {
    if (!institutions.length) return [null];
    if (!targetLabel) return institutions;
    const prefer = institutions.filter((name) => {
      const n = String(name);
      if (targetLabel === "유치원") return /유치원|키즈|어학|폴리|academy|kindergarten/i.test(n) && !/어린이집|daycare/i.test(n);
      if (targetLabel === "어린이집") return /어린이집|어린이 집|daycare|영아/i.test(n);
      return true;
    });
    // 매칭 기관이 없으면 임의 교차 대신 기관 없는 1장으로 (배정 추측 금지)
    return prefer.length ? prefer : [null];
  };

  for (const period of periods) {
    const slot = period.slot;
    if (!slot) continue;
    const monthKey = String(slot.year_month || "").slice(0, 7) || yearMonthKey(period.cal.monday);
    const letter = me
      ? assignedLetterForMonth(schedules, me, monthKey)
      : (schedules || []).find((s) => String(s.year_month || "").startsWith(monthKey))?.assigned_letter || null;
    if (!letter) continue;
    letters[period.key] = letter;

    const parts = parseParts(getWeekItemsForLetter(weeklyLists, letter, slot.week_number));
    if (!parts.length) continue;
    const availRange = rotationWeekRangeForSlot(slot)
      || formatWeekRange(period.cal.startYmd, period.cal.endYmd)
      || period.calendarWeek.label;
    const sessions = sessionsInCalendarWeek(weeklySlots, period.cal.startYmd, period.cal.endYmd);
    const institutions = [...new Set(sessions.map((s) => s.institution))];

    for (const part of parts) {
      const item = resolveItemRecord(items, part.itemName);
      const age = ageMetaFromTarget(part.targetLabel);
      const activities = recommendActivities(part.itemName, part.simpleActivity, age.ageBand);
      const institutionList = parts.length > 1
        ? matchInstitutionsForTarget(part.targetLabel, institutions)
        : (institutions.length ? institutions : [null]);

      for (const institution of institutionList) {
        const instSessions = institution
          ? sessions.filter((s) => s.institution === institution)
          : sessions;
        const classTypes = [...new Set(instSessions.map((s) => s.classType).filter(Boolean))];

        cards.push({
          id: `${period.key}__${part.itemName}__${institution || "no-inst"}__${part.targetLabel || "all"}`,
          periodKey: period.key,
          periodLabel: period.label,
          gearName: item?.name || part.itemName,
          sheetName: part.itemName,
          photoUrl: item?.photo_url || null,
          itemId: item?.id || null,
          availabilityRange: availRange,
          calendarWeekLabel: period.calendarWeek.label,
          institution,
          classLabel: part.targetLabel
            ? `${age.classLabel}${institution ? ` · ${institution}` : ""}`
            : (institution || age.classLabel),
          classTypes,
          ageLabel: age.ageLabel,
          ageBand: age.ageBand,
          recommendedActivities: activities,
          letter,
          weekNumber: slot.week_number,
          yearMonth: monthKey,
          asOf,
        });
      }
    }
  }

  return {
    calendarWeek,
    nextCalendarWeek,
    asOf,
    letter: letters.current || null,
    letters,
    cards,
  };
}

/** 지티 채팅에 넣을 포커스 문맥 + 첫 질문 */
export function buildBriefingAskPayload(card) {
  if (!card) return null;
  const lines = [
    "[이번 주 브리핑 문맥 — 서버/앱 배정 데이터]",
    `기준일: ${card.asOf}`,
    `배정 교구: ${card.gearName}`,
    `사용 가능 기간: ${card.availabilityRange}`,
    `캘린더 주(월~일): ${card.calendarWeekLabel}`,
    `담당: ${card.classLabel}`,
    card.institution ? `기관: ${card.institution}` : null,
    card.classTypes?.length ? `수업 유형: ${card.classTypes.join(", ")}` : null,
    `대상 연령(참고): ${card.ageLabel}`,
    `추천 활동 힌트: ${card.recommendedActivities.join(" / ")}`,
    "위 배정 정보를 우선 적용해 바로 쓸 수 있는 활동을 알려줘. 배정과 다른 일반 추천이면 배정이 우선이라고 밝혀줘.",
  ].filter(Boolean);

  const prompt = [
    `${card.gearName}로 이번 주 수업 활동을 짜줘.`,
    "",
    ...lines,
  ].join("\n");

  return {
    prompt,
    focusContext: lines.join("\n"),
  };
}

export const GITI_ASK_EVENT = "giti:ask";

export function dispatchGitiAsk({ prompt, focusContext = "" } = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GITI_ASK_EVENT, {
    detail: { prompt: String(prompt || "").trim(), focusContext: String(focusContext || "").trim() },
  }));
}
