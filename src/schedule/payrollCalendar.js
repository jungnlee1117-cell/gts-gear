import {
  fmtLocalDate,
  getMonthGrid,
  isSameDay,
  minutesBetween,
  PAYROLL_SUMMARY_TYPES,
  resolveInstitutionSlotPayType,
  resolvePayrollSummaryType,
  sortSlotsByTime,
  resolveInstitutionSlotBillableMinutes,
} from "./constants.js";
import { expandPatternsForRange } from "./homeVisitPatterns.js";
import { isKoreanHoliday } from "./koreanHolidays.js";
import { withoutLegacyPayrollDuplicates } from "./payrollEntryDedupe.js";

export { getMonthGrid, fmtLocalDate, isSameDay };

export const ENTRY_STATUS = {
  as_scheduled: "as_scheduled",
  custom: "custom",
  skipped: "skipped",
};

export const ENTRY_STATUS_LABEL = {
  as_scheduled: "평소대로",
  custom: "시간 수정",
  skipped: "수업 안 함",
};

/** 특정 날짜에만 노출되는 1회성 슬롯 — label: __oneoff:YYYY-MM-DD */
export const ONEOFF_LABEL_PREFIX = "__oneoff:";

function isOneoffSlotActive(slot, dateStr) {
  if (!slot.label?.startsWith(ONEOFF_LABEL_PREFIX)) return true;
  return dateStr === slot.label.slice(ONEOFF_LABEL_PREFIX.length);
}

/** effective_from / effective_to 기간 안인지 */
export function isWeeklySlotEffectiveOnDate(slot, dateStr) {
  if (!slot || !dateStr) return true;
  const from = slot.effective_from ? String(slot.effective_from).slice(0, 10) : null;
  const to = slot.effective_to ? String(slot.effective_to).slice(0, 10) : null;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

function isAfterSchoolDisplaySlot(slot) {
  return resolveInstitutionSlotPayType(slot) === "방과후" || slot.label === "고정50000";
}

/** 상세 패널·급여 목록용 슬롯 표시명 (1교시, 2교시… / 방과후) */
export function plannedSlotDisplayLabel(planned) {
  if (planned.displayLabel) return planned.displayLabel;
  if (planned.source === "home_visit" || planned.patternId) {
    return `가정방문 · ${planned.studentName}`;
  }
  return planned.institutionName || "원";
}

/** 해당 날짜에 주간 스케줄에서 펼쳐진 슬롯 목록 */
export function getSlotsForDate(weeklySlots, date, exceptions = []) {
  const dateStr = fmtLocalDate(date);
  const dow = date.getDay();
  let slots = weeklySlots.filter(s =>
    s.day_of_week === dow
    && isOneoffSlotActive(s, dateStr)
    && isWeeklySlotEffectiveOnDate(s, dateStr),
  );
  const exList = exceptions ?? [];
  if (exList.length) {
    slots = slots.filter(s => {
      const cancelled = exList.some(ex =>
        ex.institution_id === s.institution_id
        && ex.exception_type === "cancelled"
        && ex.exception_date <= dateStr
        && dateStr <= (ex.end_date || ex.exception_date),
      );
      return !cancelled;
    });
  }
  slots = sortSlotsByTime(slots);

  const regularPeriodByInst = new Map();
  return slots.map(slot => {
    const institutionName = slot.institutions?.name ?? "";
    const payType = resolveInstitutionSlotPayType(slot);
    let displayLabel;
    if (payType === "센터보조") {
      displayLabel = "보조";
    } else if (isAfterSchoolDisplaySlot(slot)) {
      displayLabel = "방과후";
    } else {
      const n = (regularPeriodByInst.get(slot.institution_id) ?? 0) + 1;
      regularPeriodByInst.set(slot.institution_id, n);
      displayLabel = `${n}교시`;
    }
    return {
      source: "institution",
      slot,
      patternId: null,
      dateStr,
      institutionId: slot.institution_id,
      institutionName,
      displayLabel,
      studentName: null,
      payType,
      startTime: slot.start_time?.slice(0, 5) ?? "",
      endTime: slot.end_time?.slice(0, 5) ?? "",
      scheduledMinutes: resolveInstitutionSlotBillableMinutes(slot),
      location: null,
    };
  });
}

function formatPatternTime(t) {
  return t?.slice(0, 5) ?? "";
}

/** home_visit_patterns 전개 occurrence → 급여/캘린더 planned */
export function homeVisitOccurrenceToPlanned(occ) {
  const pattern = occ.pattern ?? occ;
  const patternId = occ.pattern_id ?? pattern.id;
  const startTime = formatPatternTime(occ.start_time ?? pattern.start_time);
  const endTime = formatPatternTime(occ.end_time ?? pattern.end_time);
  const studentName = occ.student_name ?? pattern.student_name ?? "가정방문";
  return {
    source: "home_visit",
    slot: { id: patternId, ...pattern },
    patternId,
    dateStr: occ.visit_date,
    institutionId: null,
    institutionName: studentName,
    studentName,
    payType: "가정방문",
    startTime,
    endTime,
    scheduledMinutes: minutesBetween(startTime, endTime),
    location: occ.location ?? pattern.location ?? null,
  };
}

export function getHomeVisitsForDate(homeVisitPatterns, date) {
  const dateStr = fmtLocalDate(date);
  const occurrences = expandPatternsForRange(homeVisitPatterns, dateStr, dateStr);
  return occurrences.map(homeVisitOccurrenceToPlanned);
}

function sortPlannedByTime(planned) {
  return [...planned].sort((a, b) => {
    const t = a.startTime.localeCompare(b.startTime);
    if (t !== 0) return t;
    if (a.source !== b.source) return a.source === "institution" ? -1 : 1;
    return (a.institutionName || "").localeCompare(b.institutionName || "");
  });
}

export function getEffectiveSlotStatus(entry, dateStr) {
  if (entry?.entry_status) return entry.entry_status;
  if (isKoreanHoliday(dateStr)) return ENTRY_STATUS.skipped;
  return null;
}

/** YYYY-MM-DD → "7월 21일" */
export function formatKoMonthDay(dateStr) {
  const [, m, d] = String(dateStr || "").slice(0, 10).split("-").map(Number);
  if (!m || !d) return dateStr || "";
  return `${m}월 ${d}일`;
}

export function isMakeupRescheduled(entry) {
  return Boolean(entry?.is_makeup && entry?.makeup_date);
}

function entryBelongsToTeacher(entry, teacherId) {
  if (!teacherId) return true;
  if (entry.substitute_teacher_id) return entry.substitute_teacher_id === teacherId;
  return entry.teacher_id === teacherId;
}

/** 보강 진행일(makeup_date)에 해당하는 항목 */
export function findMakeupEntriesForDate(entries, dateStr, teacherId = null) {
  return (entries || []).filter((e) => {
    if (!isMakeupRescheduled(e)) return false;
    if (String(e.makeup_date).slice(0, 10) !== dateStr) return false;
    if (!e.entry_status || e.entry_status === ENTRY_STATUS.skipped) return false;
    if (!(Number(e.minutes) > 0)) return false;
    return entryBelongsToTeacher(e, teacherId);
  });
}

export function isSlotResolved(entries, planned) {
  return Boolean(getEffectiveSlotStatus(findEntryForPlanned(entries, planned), planned.dateStr));
}

export function effectiveSlotStatusLabel(planned, entry, { teachersById } = {}) {
  const status = getEffectiveSlotStatus(entry, planned.dateStr);
  if (!status) return "미확인";
  if (entry?.substitute_teacher_id) {
    const name = teachersById?.get?.(entry.substitute_teacher_id)?.name
      || teachersById?.[entry.substitute_teacher_id]?.name
      || "대체 선생님";
    return `대체수업 · ${name}`;
  }
  if (isMakeupRescheduled(entry)) {
    return `수업변경 → ${formatKoMonthDay(entry.makeup_date)}`;
  }
  if (status === ENTRY_STATUS.as_scheduled) {
    return `평소대로 · ${planned.scheduledMinutes}분`;
  }
  if (status === ENTRY_STATUS.custom) {
    return `시간 수정 · ${entry.minutes}분`;
  }
  if (status === ENTRY_STATUS.skipped) {
    if (!entry?.entry_status && isKoreanHoliday(planned.dateStr)) {
      return "공휴일 · 수업 없음";
    }
    return entry?.note ? `수업 안 함 · ${entry.note}` : "수업 안 함";
  }
  return ENTRY_STATUS_LABEL[status] ?? "";
}

export function findEntryForPlanned(entries, planned) {
  const { slot, dateStr } = planned;
  if (planned.source === "home_visit" || planned.patternId) {
    return entries.find(e =>
      e.home_visit_pattern_id === planned.patternId && e.class_date === dateStr,
    ) ?? entries.find(e =>
      !e.schedule_slot_id
      && !e.home_visit_pattern_id
      && e.class_date === dateStr
      && e.pay_type === "가정방문"
      && planned.studentName
      && e.note?.includes(planned.studentName),
    ) ?? null;
  }
  return entries.find(e =>
    e.schedule_slot_id === slot.id && e.class_date === dateStr,
  ) ?? entries.find(e =>
    !e.schedule_slot_id
    && !e.home_visit_pattern_id
    && e.class_date === dateStr
    && e.institution_id === slot.institution_id
    && e.pay_type === resolveInstitutionSlotPayType(slot),
  ) ?? null;
}

export function buildEntriesBySlotKey(entries) {
  const map = new Map();
  for (const e of entries) {
    if (e.schedule_slot_id) {
      map.set(`${e.class_date}|${e.schedule_slot_id}`, e);
    }
  }
  return map;
}

/** 월간 모든 예정 수업 (날짜별) — institution_weekly_schedule + home_visit_patterns */
export function expandMonthSchedule(
  weeklySlots,
  year,
  month,
  exceptions = [],
  homeVisitPatterns = [],
) {
  const grid = getMonthGrid(year, month);
  const byDate = {};
  for (const { date, inMonth } of grid) {
    if (!inMonth) continue;
    const dateStr = fmtLocalDate(date);
    const institution = getSlotsForDate(weeklySlots, date, exceptions);
    const homeVisits = getHomeVisitsForDate(homeVisitPatterns, date);
    byDate[dateStr] = sortPlannedByTime([...institution, ...homeVisits]);
  }
  return byDate;
}

/** 매월 이 날짜(포함)부터 해당 월 말일까지 미리 확정 가능 */
export const PAYROLL_EARLY_CONFIRM_DAY = 20;

/** 급여 확정 가능 여부 — 20일 이전은 오늘까지만, 20일 이후엔 이번 달 말일까지 */
export function isDateConfirmable(dateStr, today = new Date()) {
  const todayStr = fmtLocalDate(today);
  if (dateStr <= todayStr) return true;
  if (today.getDate() < PAYROLL_EARLY_CONFIRM_DAY) return false;
  const [y, m] = dateStr.split("-").map(Number);
  return y === today.getFullYear() && m === today.getMonth() + 1;
}

/** 오늘까지 예정된 슬롯 중 entry 없는 날짜 수 */
export function countUnconfirmedDays(scheduleByDate, entries, today = new Date()) {
  let days = 0;
  for (const [dateStr, planned] of Object.entries(scheduleByDate)) {
    if (!isDateConfirmable(dateStr, today) || planned.length === 0) continue;
    const allResolved = planned.every(p => isSlotResolved(entries, p));
    if (!allResolved) days++;
  }
  return days;
}

export function countSkippedEntries(entries) {
  return entries.filter(e => e.entry_status === ENTRY_STATUS.skipped).length;
}

/** 확정된 수업만 급여·합계에 포함 (minutes > 0).
 *  teacherId가 있으면 대체 수업 귀속을 반영. */
export function confirmedEntries(entries, teacherId = null) {
  const deduped = withoutLegacyPayrollDuplicates(entries);
  if (teacherId) {
    return deduped.filter(e => {
      if (!e.entry_status || !(e.minutes > 0)) return false;
      if (e.substitute_teacher_id) return e.substitute_teacher_id === teacherId;
      return e.teacher_id === teacherId;
    });
  }
  return deduped.filter(e => e.entry_status && e.minutes > 0 && !e.substitute_teacher_id);
}

export function groupPayrollByTypeConfirmed(entries, teacherId = null) {
  const groups = {};
  for (const t of PAYROLL_SUMMARY_TYPES) groups[t] = 0;
  for (const e of confirmedEntries(entries, teacherId)) {
    const summaryType = resolvePayrollSummaryType(e);
    groups[summaryType] = (groups[summaryType] || 0) + e.minutes;
  }
  return groups;
}

/** 달력 날짜 칸 — 대체/보강/수업변경 뱃지 */
export function calendarPayrollBadgesForDate(entries, dateStr) {
  if (!entries?.length || !dateStr) return [];
  const badges = [];
  const hasSub = entries.some(e =>
    e.substitute_teacher_id && e.class_date === dateStr,
  );
  if (hasSub) badges.push({ kind: "substitute", label: "대체" });
  // 보강/변경은 칸 안의 「수업변경 →」「(보강)」 줄로 이미 보이므로 뱃지는 두지 않음
  return badges;
}

export function uniqueInstitutionIdsForDate(planned) {
  const seen = new Set();
  const ids = [];
  for (const p of planned) {
    const id = p.institutionId;
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/** 캘린더 날짜 칸 마커 — 원 + 가정방문(학생별). label은 데스크톱 텍스트 표시용 */
export function uniqueCalendarMarkersForDate(planned) {
  const nameByInst = new Map();
  for (const p of planned) {
    if (!p.institutionId) continue;
    if (!nameByInst.has(p.institutionId) && p.institutionName) {
      nameByInst.set(p.institutionId, p.institutionName);
    }
  }
  const markers = uniqueInstitutionIdsForDate(planned).map(id => ({
    type: "institution",
    id,
    label: nameByInst.get(id) || "원",
    key: `inst-${id}`,
  }));
  const seen = new Set();
  for (const p of planned) {
    if (p.source !== "home_visit" || !p.patternId || seen.has(p.patternId)) continue;
    seen.add(p.patternId);
    markers.push({
      type: "home_visit",
      id: p.patternId,
      label: p.studentName || "가정방문",
      key: `hv-${p.patternId}`,
    });
  }
  return markers;
}

export function dayConfirmState(planned, entries) {
  if (!planned.length) return "empty";
  let resolved = 0;
  let skipped = 0;
  for (const p of planned) {
    const status = getEffectiveSlotStatus(findEntryForPlanned(entries, p), p.dateStr);
    if (!status) continue;
    resolved++;
    if (status === ENTRY_STATUS.skipped) skipped++;
  }
  if (resolved === 0) return "pending";
  if (resolved < planned.length) return "partial";
  if (skipped === planned.length) return "all_skipped";
  if (skipped > 0) return "mixed";
  return "done";
}

/** 해당 날짜 확정 수업 합산 분 (수업 안 함 제외).
 *  보강은 makeup_date에만 분을 표시하고, 원래 class_date에서는 제외. */
export function confirmedMinutesForDate(entries, dateStr, teacherId = null) {
  return (entries || []).reduce((sum, e) => {
    if (!e.entry_status || e.entry_status === ENTRY_STATUS.skipped) return sum;
    if (!entryBelongsToTeacher(e, teacherId)) return sum;
    const mins = Number(e.minutes) || 0;
    if (isMakeupRescheduled(e)) {
      if (String(e.makeup_date).slice(0, 10) !== dateStr) return sum;
      return sum + mins;
    }
    if (e.class_date !== dateStr) return sum;
    return sum + mins;
  }, 0);
}

/**
 * 급여 달력 날짜 표시
 * - confirmed: 수업별 "기관명 유형 N분" 줄
 * - skipped: ❌ (전부 수업 안 함)
 * - null: 미확정/부분확정 — 표시 없음
 */
export function payrollCalendarDayMark(planned, entries, dateStr, {
  isHoliday = false,
  teacherId = null,
  teachersById = null,
} = {}) {
  if (isHoliday || !dateStr) return null;

  const list = planned || [];
  const state = list.length ? dayConfirmState(list, entries) : "empty";
  const dayEntries = (entries || []).filter((e) => {
    if (!e.entry_status) return false;
    if (!entryBelongsToTeacher(e, teacherId)) return false;
    if (e.class_date === dateStr) return true;
    if (isMakeupRescheduled(e) && String(e.makeup_date).slice(0, 10) === dateStr) return true;
    return false;
  });
  const makeupArrivals = findMakeupEntriesForDate(entries, dateStr, teacherId);
  const minutes = confirmedMinutesForDate(entries, dateStr, teacherId);

  if (state === "done" || state === "mixed") {
    return {
      kind: "confirmed",
      minutes,
      lines: buildConfirmedPayrollDayLines(list, entries, dateStr, teacherId, teachersById),
    };
  }

  if (state === "all_skipped") {
    const hasWorkExtra = dayEntries.some(
      (e) => e.entry_status !== ENTRY_STATUS.skipped && Number(e.minutes) > 0,
    );
    if (hasWorkExtra || makeupArrivals.length) {
      return {
        kind: "confirmed",
        minutes,
        lines: buildConfirmedPayrollDayLines(list, entries, dateStr, teacherId, teachersById),
      };
    }
    return { kind: "skipped", minutes: 0, lines: [] };
  }

  // 스케줄 없는 날 — 직접 추가·보강 도착만 있는 경우
  if (state === "empty" || !list.length) {
    if (!dayEntries.length && !makeupArrivals.length) return null;
    const workEntries = dayEntries.filter((e) => e.entry_status !== ENTRY_STATUS.skipped);
    if (!workEntries.length && !makeupArrivals.length) {
      return { kind: "skipped", minutes: 0, lines: [] };
    }
    return {
      kind: "confirmed",
      minutes,
      lines: buildConfirmedPayrollDayLines(list, entries, dateStr, teacherId, teachersById),
    };
  }

  // pending / partial — 보강 도착만 있으면 표시
  if (makeupArrivals.length) {
    return {
      kind: "confirmed",
      minutes,
      lines: buildConfirmedPayrollDayLines(list, entries, dateStr, teacherId, teachersById),
    };
  }

  return null;
}

/** 확정된 수업 줄 — 기관(또는 가정방문 학생)·유형별 합산 / 보강·수업변경 표기 */
export function buildConfirmedPayrollDayLines(
  planned,
  entries,
  dateStr,
  teacherId = null,
  teachersById = null,
) {
  /** @type {Map<string, { key: string, name: string, payType: string, minutes: number, sort: string, label?: string, sublabel?: string, colorId: string, colorKind: string }>} */
  const groups = new Map();
  const usedEntryIds = new Set();

  const addLine = ({
    groupKey,
    name,
    payType,
    minutes,
    sort,
    colorId,
    colorKind,
    label,
    sublabel,
  }) => {
    const key = groupKey || `${name}::${payType}`;
    const prev = groups.get(key);
    if (prev && !label) {
      prev.minutes += minutes;
      return;
    }
    if (prev && label) return;
    groups.set(key, {
      key,
      name,
      payType,
      minutes,
      colorId: colorId || name,
      colorKind: colorKind || "institution",
      sort: sort || `${name}\0${payType}`,
      label: label || null,
      sublabel: sublabel || null,
    });
  };

  for (const p of planned || []) {
    const entry = findEntryForPlanned(entries, p);
    const status = getEffectiveSlotStatus(entry, dateStr);
    if (!status || status === ENTRY_STATUS.skipped) continue;
    if (entry && !entryBelongsToTeacher(entry, teacherId)) continue;

    // 원래 날짜: 보강으로 옮긴 수업 → "수업변경 → N월 D일"
    if (entry && isMakeupRescheduled(entry) && entry.class_date === dateStr) {
      if (entry.id) usedEntryIds.add(entry.id);
      const mkLabel = formatKoMonthDay(entry.makeup_date);
      addLine({
        groupKey: `reschedule-out:${entry.id}`,
        name: p.institutionName || "원",
        payType: entry.pay_type || p.payType || "",
        minutes: 0,
        colorId: p.institutionId || entry.institution_id || "reschedule",
        colorKind: "reschedule",
        sort: `${p.startTime || "00:00"}\0reschedule`,
        label: `수업변경 → ${mkLabel}`,
        sublabel: null,
      });
      continue;
    }

    const minutes = Number(
      entry?.minutes
      ?? (status === ENTRY_STATUS.as_scheduled ? p.scheduledMinutes : 0),
    ) || 0;
    const payType = entry?.pay_type || p.payType || "";
    const isHome = p.source === "home_visit" || Boolean(p.patternId);
    const name = isHome
      ? (p.studentName || p.institutionName || "가정방문")
      : (p.institutionName || "원");
    const colorId = isHome
      ? (p.patternId || name)
      : (p.institutionId || entry?.institution_id || name);
    const groupKey = isHome
      ? `hv:${p.patternId || name}:${payType}`
      : `inst:${p.institutionId || name}:${payType}`;
    if (entry?.id) usedEntryIds.add(entry.id);
    const entryIsSubstitute = Boolean(
      entry?.substitute_teacher_id
      && (!teacherId || entry.substitute_teacher_id === teacherId),
    );
    const originalTeacher = entryIsSubstitute && teachersById?.get
      ? teachersById.get(entry.teacher_id)
      : null;
    const substituteOriginalName = p.isSubstituteCover
      ? (p.substituteLesson?.original_teacher?.name || originalTeacher?.name || "원래 선생님")
      : entryIsSubstitute
        ? (originalTeacher?.name || "원래 선생님")
        : null;
    const isSubstituteCover = Boolean(p.isSubstituteCover || entryIsSubstitute);
    addLine({
      groupKey: isSubstituteCover
        ? `substitute:${p.substituteLesson?.id || entry?.id || groupKey}`
        : groupKey,
      name,
      payType,
      minutes,
      colorId,
      colorKind: isHome ? "home_visit" : "institution",
      sort: `${p.startTime || "99:99"}\0${name}\0${payType}`,
      label: isSubstituteCover ? `${name} 대체 ${minutes}분` : null,
      sublabel: substituteOriginalName ? `${substituteOriginalName} 선생님 수업` : null,
    });
  }

  const extras = findManualExtraEntriesForDate(entries, dateStr, planned || []);
  for (const e of extras) {
    if (!entryBelongsToTeacher(e, teacherId)) continue;
    if (e.entry_status === ENTRY_STATUS.skipped) continue;
    if (usedEntryIds.has(e.id)) continue;
    if (isMakeupRescheduled(e) && String(e.makeup_date).slice(0, 10) !== dateStr) {
      // 원래 날짜에만 있는 보강 수동행은 위에서 처리되지 않을 수 있음
      if (e.class_date === dateStr) {
        usedEntryIds.add(e.id);
        addLine({
          groupKey: `reschedule-out:${e.id}`,
          name: e.institutions?.name || "원",
          payType: e.pay_type || "",
          minutes: 0,
          colorId: e.institution_id || "reschedule",
          colorKind: "reschedule",
          sort: `yy\0reschedule\0${e.id}`,
          label: `수업변경 → ${formatKoMonthDay(e.makeup_date)}`,
        });
      }
      continue;
    }
    const name = e.institutions?.name?.trim()
      || (e.institution_id ? "원" : "개인레슨");
    const payType = e.pay_type || "";
    const minutes = Number(e.minutes) || 0;
    const groupKey = e.institution_id
      ? `inst:${e.institution_id}:${payType}`
      : `extra:${name}:${payType}`;
    usedEntryIds.add(e.id);
    addLine({
      groupKey,
      name,
      payType,
      minutes,
      colorId: e.institution_id || name,
      colorKind: e.institution_id ? "institution" : "extra",
      sort: `zz\0${name}\0${payType}`,
    });
  }

  // 보강 진행일: "(보강) 기관 N분" + 원래 날짜 안내
  for (const e of findMakeupEntriesForDate(entries, dateStr, teacherId)) {
    if (usedEntryIds.has(e.id) && e.class_date === dateStr) {
      // 같은 날 보강이면 아래에서만 표시하도록 used 무시 가능 — 드문 케이스
    }
    const name = e.institutions?.name?.trim()
      || (e.institution_id ? "원" : "개인레슨");
    const minutes = Number(e.minutes) || 0;
    const origLabel = formatKoMonthDay(e.class_date);
    addLine({
      groupKey: `makeup-in:${e.id}`,
      name,
      payType: e.pay_type || "",
      minutes,
      colorId: e.institution_id || name,
      colorKind: "makeup",
      sort: `za\0${e.makeup_start_time || "00:00"}\0${name}`,
      label: `(보강) ${name} ${minutes}분`,
      sublabel: `${origLabel} 수업 보강`,
    });
  }

  return [...groups.values()]
    .sort((a, b) => a.sort.localeCompare(b.sort, "ko"))
    .map((row) => ({
      key: row.key,
      name: row.name,
      payType: row.payType,
      minutes: row.minutes,
      colorId: row.colorId,
      colorKind: row.colorKind,
      sublabel: row.sublabel || null,
      label: row.label
        || `${row.name} ${row.payType} ${row.minutes}분`.replace(/\s+/g, " ").trim(),
    }));
}

export function isSlotUnconfirmed(entries, planned) {
  return !isSlotResolved(entries, planned);
}

/** 일괄 확정 시 건드리지 않을 슬롯 (개별 수정·수업 안 함·공휴일 기본값) */
export function isSlotBulkProtected(entries, planned) {
  const entry = findEntryForPlanned(entries, planned);
  if (entry?.entry_status === ENTRY_STATUS.custom) return true;
  if (entry?.entry_status === ENTRY_STATUS.skipped) return true;
  if (isKoreanHoliday(planned.dateStr) && !entry?.entry_status) return true;
  return false;
}

/** 스케줄 슬롯 없이 강사가 직접 추가한 payroll entry */
export function isManualExtraEntry(entry) {
  if (!entry?.entry_status) return false;
  if (entry.schedule_slot_id || entry.home_visit_pattern_id) return false;
  return entry.minutes > 0 || entry.entry_status === ENTRY_STATUS.custom;
}

export function findManualExtraEntriesForDate(entries, dateStr, plannedList = []) {
  return withoutLegacyPayrollDuplicates(entries).filter(e => {
    if (e.class_date !== dateStr || !isManualExtraEntry(e)) return false;
    if (!plannedList.length) return true;
    return !plannedList.some(p => findEntryForPlanned(entries, p)?.id === e.id);
  });
}

export function getWeekDateStrings(anchorDate) {
  const d = new Date(anchorDate);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return fmtLocalDate(x);
  });
}

/** 기간 내 미확인 슬롯 수집 (확정 가능 날짜만, 선택적 날짜 필터) */
export function collectUnconfirmedPlanned(scheduleByDate, entries, {
  today = new Date(),
  dateFilter = null,
} = {}) {
  const list = [];
  for (const [dateStr, planned] of Object.entries(scheduleByDate)) {
    if (!isDateConfirmable(dateStr, today)) continue;
    if (dateFilter && !dateFilter(dateStr)) continue;
    for (const p of planned) {
      if (isSlotUnconfirmed(entries, p)) list.push(p);
    }
  }
  return list;
}
