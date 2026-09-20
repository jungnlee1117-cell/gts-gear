const ONEOFF_PREFIX = "__oneoff:";
const ROUND1_DELAY_MIN = 10;
const ROUND2_DELAY_MIN = 70;
const ROUND3_HM = "20:00";

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

function findEntry(entries: any[], planned: { source: string; id: string }) {
  if (planned.source === "home_visit") {
    return entries.find((e) => e.home_visit_pattern_id === planned.id) || null;
  }
  return entries.find((e) => e.schedule_slot_id === planned.id) || null;
}

function isResolved(entry: any, dateStr: string) {
  if (entry?.entry_status) return true;
  if (KOREAN_HOLIDAYS.has(dateStr)) return true;
  return false;
}

function roundCopy(round: number, count: number) {
  const n = Math.max(1, count);
  if (round === 2) {
    return {
      title: "오늘 수업 확인",
      body: `아직 확인하지 않은 오늘 수업이 있어요 (${n}건)`,
    };
  }
  if (round === 3) {
    return {
      title: "오늘 수업 확인",
      body: `오늘 수업 확인을 아직 마치지 않았어요 (${n}건)`,
    };
  }
  return {
    title: "오늘 수업 마치셨나요?",
    body: `오늘 미확인 수업 ${n}건 · 완료/수정 후 특이사항을 남겨 주세요`,
  };
}

export async function runClassCheckinReminders(adminClient: any, vapid: any, deliverPushNotifications: Function) {
  const { ymd, dow, now } = kstParts();
  const url = `/schedule?view=class-checkin&date=${ymd}`;

  const [slotsRes, hvRes, exRes, payRes, logRes, gearOnlyRes] = await Promise.all([
    adminClient
      .from("institution_weekly_schedule")
      .select("id, teacher_id, institution_id, day_of_week, start_time, end_time, label, effective_from, effective_to, schedule_series_id")
      .eq("day_of_week", dow),
    adminClient
      .from("home_visit_patterns")
      .select("id, teacher_id, day_of_week, start_time, end_time, pattern_start_date, pattern_end_date, status"),
    adminClient
      .from("institution_schedule_exceptions")
      .select("id, institution_id, exception_type, exception_date, end_date, institution_schedule_exception_classes(*)")
      .lte("exception_date", ymd),
    adminClient
      .from("payroll_entries")
      .select("id, teacher_id, class_date, entry_status, schedule_slot_id, home_visit_pattern_id")
      .eq("class_date", ymd),
    adminClient
      .from("class_checkin_pushes")
      .select("teacher_id, round")
      .eq("class_date", ymd),
    adminClient
      .from("teachers")
      .select("id")
      .eq("access_scope", "gear_only"),
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

  let exceptions = exRes.data || [];
  if (exRes.error) {
    const fallback = await adminClient
      .from("institution_schedule_exceptions")
      .select("id, institution_id, exception_type, exception_date, end_date")
      .lte("exception_date", ymd);
    if (fallback.error) throw new Error(fallback.error.message);
    exceptions = fallback.data || [];
  }

  if (logRes.error && !/schema cache|does not exist|class_checkin_pushes/i.test(logRes.error.message || "")) {
    throw new Error(logRes.error.message);
  }
  const sentMap = new Map<string, Set<number>>();
  for (const row of logRes.data || []) {
    const key = row.teacher_id;
    if (!sentMap.has(key)) sentMap.set(key, new Set());
    sentMap.get(key)!.add(Number(row.round));
  }

  const plannedByTeacher = new Map<string, { source: string; id: string; endTime: string }[]>();
  const addPlanned = (teacherId: string, item: { source: string; id: string; endTime: string }) => {
    if (!teacherId || !item.endTime) return;
    if (gearOnlyIds.has(teacherId)) return;
    if (!plannedByTeacher.has(teacherId)) plannedByTeacher.set(teacherId, []);
    plannedByTeacher.get(teacherId)!.push(item);
  };

  for (const slot of slotsRes.data || []) {
    if (!isOneoffActive(slot, ymd) || !isWeeklySlotEffective(slot, ymd)) continue;
    if (isSlotCancelled(exceptions, slot.institution_id, ymd, slot)) continue;
    addPlanned(slot.teacher_id, {
      source: "institution",
      id: slot.id,
      endTime: sliceHm(slot.end_time),
    });
  }
  for (const pattern of hvRes.data || []) {
    if (!homeVisitOnDate(pattern, ymd, dow)) continue;
    addPlanned(pattern.teacher_id, {
      source: "home_visit",
      id: pattern.id,
      endTime: sliceHm(pattern.end_time) || sliceHm(pattern.start_time),
    });
  }

  const entriesByTeacher = new Map<string, any[]>();
  for (const entry of payRes.data || []) {
    const tid = entry.teacher_id;
    if (!entriesByTeacher.has(tid)) entriesByTeacher.set(tid, []);
    entriesByTeacher.get(tid)!.push(entry);
  }

  const results: Array<Record<string, unknown>> = [];

  for (const [teacherId, planned] of plannedByTeacher.entries()) {
    const entries = entriesByTeacher.get(teacherId) || [];
    const unconfirmed = planned.filter((item) => !isResolved(findEntry(entries, item), ymd));
    if (!unconfirmed.length) continue;

    const lastEnd = planned.reduce((max, item) => (item.endTime > max ? item.endTime : max), "00:00");
    const lastEndAt = kstDate(ymd, lastEnd);
    const round1At = new Date(lastEndAt.getTime() + ROUND1_DELAY_MIN * 60 * 1000);
    const round2At = new Date(lastEndAt.getTime() + ROUND2_DELAY_MIN * 60 * 1000);
    const round3At = kstDate(ymd, ROUND3_HM);
    const sent = sentMap.get(teacherId) || new Set<number>();

    let round: 1 | 2 | 3 | null = null;
    if (!sent.has(1) && now >= round1At) round = 1;
    else if (sent.has(1) && !sent.has(2) && now >= round2At) round = 2;
    else if (sent.has(1) && !sent.has(3) && now >= round3At && round3At > round2At) round = 3;
    if (!round) continue;

    const { error: insertError } = await adminClient.from("class_checkin_pushes").insert({
      teacher_id: teacherId,
      class_date: ymd,
      round,
      last_end_time: lastEnd.length === 5 ? `${lastEnd}:00` : lastEnd,
      unconfirmed_count: unconfirmed.length,
      sent_count: 0,
    });
    if (insertError) {
      if (insertError.code === "23505") continue;
      console.error("[send-push] class_checkin log insert failed", insertError.message);
      continue;
    }

    const copy = roundCopy(round, unconfirmed.length);
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

    results.push({
      teacher_id: teacherId,
      round,
      unconfirmed: unconfirmed.length,
      last_end_time: lastEnd,
      sent: result?.sent || 0,
    });
  }

  return {
    date: ymd,
    candidate_teachers: plannedByTeacher.size,
    skipped_gear_only: gearOnlyIds.size,
    sent: results.length,
    results,
  };
}
