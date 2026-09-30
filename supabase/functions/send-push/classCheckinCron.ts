import { fetchAllPages } from "../_shared/fetchAllPages.ts";

const ONEOFF_PREFIX = "__oneoff:";
const ROUND1_DELAY_MIN = 10;
const ROUND2_DELAY_MIN = 70;
const ROUND3_HM = "20:00";
const LOOKBACK_DAYS = 62;

const KOREAN_HOLIDAYS = new Set([
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18",
  "2026-03-01", "2026-03-02", "2026-05-05", "2026-05-24", "2026-05-25",
  "2026-06-03", "2026-06-06", "2026-07-17", "2026-08-15", "2026-08-17",
  "2026-09-24", "2026-09-25", "2026-09-26", "2026-10-03", "2026-10-05",
  "2026-10-09", "2026-12-25",
]);

const WEEKDAY_TO_DOW: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function kstParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const ymd = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = Number(get("hour") === "24" ? "00" : get("hour"));
  const minute = Number(get("minute"));
  return {
    ymd,
    hour,
    minute,
    dow: WEEKDAY_TO_DOW[get("weekday")] ?? 0,
    now,
  };
}

/** KST has no DST — UTC+9 */
function kstDate(ymd: string, hm: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = String(hm || "00:00").slice(0, 5).split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, (hh || 0) - 9, mm || 0, 0));
}

function sliceHm(value: string | null | undefined) {
  return String(value || "").slice(0, 5);
}

function isWeeklySlotEffective(slot: { effective_from?: string | null; effective_to?: string | null }, dateStr: string) {
  const from = slot.effective_from ? String(slot.effective_from).slice(0, 10) : null;
  const to = slot.effective_to ? String(slot.effective_to).slice(0, 10) : null;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

function isOneoffActive(slot: { label?: string | null }, dateStr: string) {
  const label = String(slot.label || "");
  if (!label.startsWith(ONEOFF_PREFIX)) return true;
  return dateStr === label.slice(ONEOFF_PREFIX.length);
}

function timeMinutes(time: string) {
  const [hour, minute] = String(time || "00:00").slice(0, 5).split(":").map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

function exceptionEnd(ex: { end_date?: string | null; exception_date?: string }) {
  return ex.end_date || ex.exception_date;
}

function isExceptionActive(ex: { exception_date?: string; end_date?: string | null }, dateStr: string) {
  const start = String(ex.exception_date || "").slice(0, 10);
  const end = String(exceptionEnd(ex) || "").slice(0, 10);
  return start <= dateStr && dateStr <= end;
}

function isSlotCancelled(exceptions: any[], institutionId: string, dateStr: string, slot: any) {
  const slotStart = slot?.start_time;
  const slotSeriesId = slot?.schedule_series_id || slot?.id || null;
  const morning = timeMinutes(slotStart) < 12 * 60;
  return (exceptions || []).some((ex) => {
    if (ex.institution_id !== institutionId || !isExceptionActive(ex, dateStr)) return false;
    if (ex.exception_type === "cancelled") return true;
    if (ex.exception_type === "class_cancelled") {
      return (ex.institution_schedule_exception_classes || []).some((selected: any) => (
        selected.class_date === dateStr
        && (selected.schedule_series_id === slotSeriesId || selected.schedule_slot_id === slot?.id)
      ));
    }
    if (ex.exception_type === "cancelled_am") return morning;
    if (ex.exception_type === "cancelled_pm") return !morning;
    return false;
  });
}

function homeVisitOnDate(pattern: any, dateStr: string, dow: number) {
  if (Number(pattern.day_of_week) !== dow) return false;
  if (pattern.status === "ended") return false;
  const start = String(pattern.pattern_start_date || "").slice(0, 10);
  const end = pattern.pattern_end_date ? String(pattern.pattern_end_date).slice(0, 10) : null;
  if (start && dateStr < start) return false;
  if (end && dateStr > end) return false;
  return Boolean(sliceHm(pattern.end_time) || sliceHm(pattern.start_time));
}

function asYmd(value: unknown) {
  const raw = String(value || "");
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const dt = value instanceof Date ? value : new Date(raw);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

function findEntry(entries: any[], planned: { source: string; id: string; dateStr?: string }) {
  const dateStr = asYmd(planned.dateStr);
  if (planned.source === "home_visit") {
    return entries.find((e) => (
      e.home_visit_pattern_id === planned.id
      && (!dateStr || asYmd(e.class_date) === dateStr)
    )) || null;
  }
  return entries.find((e) => (
    e.schedule_slot_id === planned.id
    && (!dateStr || asYmd(e.class_date) === dateStr)
  )) || null;
}

function isResolved(entry: any, dateStr: string) {
  if (entry?.entry_status) return true;
  if (KOREAN_HOLIDAYS.has(dateStr)) return true;
  return false;
}

function addDaysYmd(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  return dt.toISOString().slice(0, 10);
}

function kstDow(ymd: string) {
  return new Date(`${ymd}T12:00:00+09:00`).getUTCDay();
}

function eachYmd(fromYmd: string, toYmd: string) {
  const dates: string[] = [];
  let cursor = fromYmd;
  while (cursor <= toYmd) {
    dates.push(cursor);
    cursor = addDaysYmd(cursor, 1);
  }
  return dates;
}

function isVacationOn(vacations: any[], teacherId: string, dateStr: string) {
  return (vacations || []).some((row) => (
    row.teacher_id === teacherId
    && String(row.start_date || "").slice(0, 10) <= dateStr
    && String(row.end_date || "").slice(0, 10) >= dateStr
  ));
}

function formatClassPreview(item: PlannedItem | undefined, ymd: string) {
  if (!item) return "수업";
  const datePart = item.dateStr === ymd
    ? "오늘"
    : `${Number(String(item.dateStr).slice(5, 7))}.${Number(String(item.dateStr).slice(8, 10))}`;
  const place = item.placeName || (item.source === "home_visit" ? "가정방문" : "수업");
  const time = String(item.endTime || "").slice(0, 5);
  return [datePart, place, time].filter(Boolean).join(" ");
}

function roundCopy(round: number, unconfirmed: PlannedItem[], ymd: string) {
  const items = [...(unconfirmed || [])].sort((a, b) => (
    String(a.dateStr).localeCompare(String(b.dateStr))
    || String(a.endTime).localeCompare(String(b.endTime))
  ));
  const n = Math.max(1, items.length);
  const todayCount = items.filter((item) => item.dateStr === ymd).length;
  const pastCount = items.length - todayCount;
  const preview = formatClassPreview(items[0], ymd);
  const extra = n > 1 ? ` 외 ${n - 1}건` : "";
  if (round === 3) {
    if (pastCount && !todayCount) {
      return {
        title: "아직 체크하지 않은 수업이 있어요",
        body: `${preview}${extra} · 오늘이 아니라 이전 날짜 미확인입니다`,
      };
    }
    if (pastCount && todayCount) {
      return {
        title: "미확인 수업이 남아 있어요",
        body: `오늘 ${todayCount}건, 이전 날짜 ${pastCount}건 · 예: ${preview}`,
      };
    }
    return {
      title: "오늘 수업 마치셨나요?",
      body: `${preview}${extra} 아직 체크되지 않았어요`,
    };
  }
  if (round === 2) {
    return {
      title: "오늘 수업 확인",
      body: `${preview}${extra} 아직 확인되지 않았어요`,
    };
  }
  return {
    title: "오늘 수업 마치셨나요?",
    body: `${preview}${extra} · 완료/수정 후 특이사항을 남겨 주세요`,
  };
}

type PlannedItem = {
  source: string;
  id: string;
  endTime: string;
  dateStr: string;
  institutionId?: string | null;
  placeName?: string;
};

function collectPlannedForDate(
  slots: any[],
  patterns: any[],
  exceptions: any[],
  dateStr: string,
  gearOnlyIds: Set<string>,
  institutionNames: Map<string, string> = new Map(),
) {
  const dow = kstDow(dateStr);
  const items: Array<PlannedItem & { teacherId: string }> = [];
  for (const slot of slots || []) {
    if (Number(slot.day_of_week) !== dow) continue;
    if (!isOneoffActive(slot, dateStr) || !isWeeklySlotEffective(slot, dateStr)) continue;
    if (isSlotCancelled(exceptions, slot.institution_id, dateStr, slot)) continue;
    const teacherId = slot.teacher_id;
    const endTime = sliceHm(slot.end_time);
    if (!teacherId || !endTime || gearOnlyIds.has(teacherId)) continue;
    items.push({
      teacherId,
      source: "institution",
      id: slot.id,
      endTime,
      dateStr,
      institutionId: slot.institution_id || null,
      placeName: institutionNames.get(slot.institution_id) || "기관 수업",
    });
  }
  for (const pattern of patterns || []) {
    if (!homeVisitOnDate(pattern, dateStr, dow)) continue;
    const teacherId = pattern.teacher_id;
    const endTime = sliceHm(pattern.end_time) || sliceHm(pattern.start_time);
    if (!teacherId || !endTime || gearOnlyIds.has(teacherId)) continue;
    items.push({
      teacherId,
      source: "home_visit",
      id: pattern.id,
      endTime,
      dateStr,
      institutionId: null,
      placeName: "가정방문",
    });
  }
  return items;
}

async function deliverClassCheckinRound(
  adminClient: any,
  vapid: any,
  deliverPushNotifications: Function,
  {
    teacherId,
    ymd,
    round,
    unconfirmed,
    lastEnd,
    url,
  }: {
    teacherId: string;
    ymd: string;
    round: 1 | 2 | 3;
    unconfirmed: PlannedItem[];
    lastEnd: string;
    url: string;
  },
) {
  const { error: insertError } = await adminClient.from("class_checkin_pushes").insert({
    teacher_id: teacherId,
    class_date: ymd,
    round,
    last_end_time: lastEnd.length === 5 ? `${lastEnd}:00` : lastEnd,
    unconfirmed_count: unconfirmed.length,
    sent_count: 0,
  });
  if (insertError) {
    if (insertError.code === "23505") return null;
    console.error("[send-push] class_checkin log insert failed", insertError.message);
    return null;
  }

  const copy = roundCopy(round, unconfirmed, ymd);
  const result = await deliverPushNotifications(adminClient, vapid, "cron_class_checkin", {
    teacherIds: [teacherId],
    title: copy.title,
    body: copy.body,
    url,
  });
  await adminClient.from("class_checkin_pushes")
    .update({ sent_count: result?.sent || 0 })
    .eq("teacher_id", teacherId)
    .eq("class_date", ymd)
    .eq("round", round);

  return {
    teacher_id: teacherId,
    round,
    unconfirmed: unconfirmed.length,
    last_end_time: lastEnd,
    oldest_date: unconfirmed[0]?.dateStr || ymd,
    sent: result?.sent || 0,
  };
}

export async function runClassCheckinReminders(adminClient: any, vapid: any, deliverPushNotifications: Function) {
  const { ymd, now } = kstParts();
  const fromYmd = addDaysYmd(ymd, -(LOOKBACK_DAYS - 1));
  const fromMonth = `${fromYmd.slice(0, 7)}-01`;
  const dailyAt = kstDate(ymd, ROUND3_HM);
  const dailyOpen = now >= dailyAt;

  const [slotsRes, hvRes, exRes, payRes, logRes, gearOnlyRes, vacationsRes, settledRes, institutionsRes] = await Promise.all([
    fetchAllPages(() => adminClient
      .from("institution_weekly_schedule")
      .select("id, teacher_id, institution_id, day_of_week, start_time, end_time, label, effective_from, effective_to, schedule_series_id")),
    fetchAllPages(() => adminClient
      .from("home_visit_patterns")
      .select("id, teacher_id, day_of_week, start_time, end_time, pattern_start_date, pattern_end_date, status")),
    fetchAllPages(() => adminClient
      .from("institution_schedule_exceptions")
      .select("id, institution_id, exception_type, exception_date, end_date, institution_schedule_exception_classes(*)")
      .lte("exception_date", ymd)),
    fetchAllPages(() => adminClient
      .from("payroll_entries")
      .select("id, teacher_id, class_date, entry_status, schedule_slot_id, home_visit_pattern_id")
      .gte("class_date", fromYmd)
      .lte("class_date", ymd)),
    fetchAllPages(() => adminClient
      .from("class_checkin_pushes")
      .select("id, teacher_id, round")
      .eq("class_date", ymd)),
    adminClient
      .from("teachers")
      .select("id")
      .eq("access_scope", "gear_only"),
    fetchAllPages(() => adminClient
      .from("teacher_vacations")
      .select("id, teacher_id, start_date, end_date")
      .lte("start_date", ymd)
      .gte("end_date", fromYmd)),
    fetchAllPages(() => adminClient
      .from("monthly_settlements")
      .select("id, institution_id, year_month, is_finalized")
      .gte("year_month", fromMonth)
      .eq("is_finalized", true)),
    fetchAllPages(() => adminClient
      .from("institutions")
      .select("id, name")),
  ]);

  if (slotsRes.error) throw new Error(slotsRes.error.message);
  if (hvRes.error) throw new Error(hvRes.error.message);
  if (payRes.error) throw new Error(payRes.error.message);
  if (
    gearOnlyRes.error
    && !/access_scope|schema cache|column/i.test(gearOnlyRes.error.message || "")
  ) {
    throw new Error(gearOnlyRes.error.message);
  }
  const gearOnlyIds = new Set((gearOnlyRes.data || []).map((row) => row.id).filter(Boolean));
  if (vacationsRes.error) throw new Error(vacationsRes.error.message);
  const vacations = vacationsRes.data || [];

  let exceptions = exRes.data || [];
  if (exRes.error) {
    const fallback = await fetchAllPages(() => adminClient
      .from("institution_schedule_exceptions")
      .select("id, institution_id, exception_type, exception_date, end_date")
      .lte("exception_date", ymd));
    if (fallback.error) throw new Error(fallback.error.message);
    exceptions = fallback.data || [];
  }

  if (logRes.error && !/schema cache|does not exist|class_checkin_pushes/i.test(logRes.error.message || "")) {
    throw new Error(logRes.error.message);
  }
  const institutionNames = new Map<string, string>(
    (institutionsRes.error ? [] : institutionsRes.data || [])
      .map((row: any) => [row.id, String(row.name || "").trim()])
      .filter((entry: [string, string]) => entry[0] && entry[1]),
  );
  const sentMap = new Map<string, Set<number>>();
  for (const row of logRes.data || []) {
    const key = row.teacher_id;
    if (!sentMap.has(key)) sentMap.set(key, new Set());
    sentMap.get(key)!.add(Number(row.round));
  }

  const finalizedKeys = new Set(
    (settledRes.error ? [] : settledRes.data || [])
      .map((row: any) => {
        const institutionId = row.institution_id;
        const yearMonth = String(row.year_month || "").slice(0, 7);
        return institutionId && yearMonth ? `${institutionId}:${yearMonth}` : "";
      })
      .filter(Boolean),
  );

  const entriesByTeacher = new Map<string, any[]>();
  for (const entry of payRes.data || []) {
    const tid = entry.teacher_id;
    if (!entriesByTeacher.has(tid)) entriesByTeacher.set(tid, []);
    entriesByTeacher.get(tid)!.push(entry);
  }

  const todayAllByTeacher = new Map<string, PlannedItem[]>();
  const todayByTeacher = new Map<string, PlannedItem[]>();
  const backlogByTeacher = new Map<string, PlannedItem[]>();
  const addTo = (map: Map<string, PlannedItem[]>, teacherId: string, item: PlannedItem) => {
    if (!map.has(teacherId)) map.set(teacherId, []);
    map.get(teacherId)!.push(item);
  };

  for (const dateStr of eachYmd(fromYmd, ymd)) {
    for (const item of collectPlannedForDate(slotsRes.data || [], hvRes.data || [], exceptions, dateStr, gearOnlyIds, institutionNames)) {
      if (isVacationOn(vacations, item.teacherId, dateStr)) continue;
      if (item.institutionId && finalizedKeys.has(`${item.institutionId}:${dateStr.slice(0, 7)}`)) continue;
      const planned = {
        source: item.source,
        id: item.id,
        endTime: item.endTime,
        dateStr,
        institutionId: item.institutionId,
        placeName: item.placeName,
      };
      if (dateStr === ymd) addTo(todayAllByTeacher, item.teacherId, planned);
      const entries = entriesByTeacher.get(item.teacherId) || [];
      if (isResolved(findEntry(entries, item), dateStr)) continue;
      addTo(backlogByTeacher, item.teacherId, planned);
      if (dateStr === ymd) addTo(todayByTeacher, item.teacherId, planned);
    }
  }

  const results: Array<Record<string, unknown>> = [];
  const sentRound2ThisRun = new Set<string>();

  for (const [teacherId, planned] of todayByTeacher.entries()) {
    const sent = sentMap.get(teacherId) || new Set<number>();
    const todayAll = todayAllByTeacher.get(teacherId) || planned;
    const lastEnd = todayAll.reduce((max, item) => (item.endTime > max ? item.endTime : max), "00:00");
    const lastEndAt = kstDate(ymd, lastEnd);
    const round1At = new Date(lastEndAt.getTime() + ROUND1_DELAY_MIN * 60 * 1000);
    const round2At = new Date(lastEndAt.getTime() + ROUND2_DELAY_MIN * 60 * 1000);

    let round: 1 | 2 | null = null;
    if (!sent.has(1) && now >= round1At) round = 1;
    else if (sent.has(1) && !sent.has(2) && now >= round2At) round = 2;
    if (!round) continue;

    const sentRow = await deliverClassCheckinRound(adminClient, vapid, deliverPushNotifications, {
      teacherId,
      ymd,
      round,
      unconfirmed: planned,
      lastEnd,
      url: `/schedule?view=class-checkin&date=${ymd}`,
    });
    if (!sentRow) continue;
    if (round === 2) sentRound2ThisRun.add(teacherId);
    sent.add(round);
    sentMap.set(teacherId, sent);
    results.push(sentRow);
  }

  if (dailyOpen) {
    for (const [teacherId, planned] of backlogByTeacher.entries()) {
      const sent = sentMap.get(teacherId) || new Set<number>();
      if (sent.has(3) || sentRound2ThisRun.has(teacherId)) continue;
      const oldest = [...planned].sort((a, b) => a.dateStr.localeCompare(b.dateStr))[0];
      const lastEnd = oldest?.endTime || ROUND3_HM;
      const sentRow = await deliverClassCheckinRound(adminClient, vapid, deliverPushNotifications, {
        teacherId,
        ymd,
        round: 3,
        unconfirmed: planned,
        lastEnd,
        url: `/schedule?view=class-checkin&date=${oldest?.dateStr || ymd}`,
      });
      if (!sentRow) continue;
      sent.add(3);
      sentMap.set(teacherId, sent);
      results.push(sentRow);
    }
  }

  return {
    date: ymd,
    lookback_from: fromYmd,
    candidate_teachers: backlogByTeacher.size,
    today_unconfirmed: todayByTeacher.size,
    skipped_gear_only: gearOnlyIds.size,
    daily_open: dailyOpen,
    sent: results.length,
    results,
  };
}
