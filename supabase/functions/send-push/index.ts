import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-consultation-push-secret, x-push-webhook-secret",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatItemList(names) {
  const list = (names || []).filter(Boolean);
  if (!list.length) return "교구";
  if (list.length === 1) return list[0];
  return `${list[0]} 외 ${list.length - 1}건`;
}

function formatClassDate(dateStr) {
  const [, m, d] = String(dateStr || "").split("-").map(Number);
  if (!m || !d) return dateStr || "";
  return `${m}월 ${d}일`;
}

/** KST 기준 N일 후 YYYY-MM-DD (0=오늘, 1=내일) */
function kstYmd(addDays = 0) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = fmt.format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + addDays));
  return dt.toISOString().slice(0, 10);
}

function kstTomorrowYmd() {
  return kstYmd(1);
}

function formatKoMonthDay(ymd) {
  const [, m, d] = String(ymd || "").split("-").map(Number);
  if (!m || !d) return ymd || "";
  return `${m}월 ${d}일`;
}

function monthsSpanned(startYmd, endYmd) {
  const months = new Set();
  const [sy, sm] = String(startYmd).split("-").map(Number);
  const [ey, em] = String(endYmd).split("-").map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.add(`${y}-${String(m).padStart(2, "0")}-01`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return [...months];
}

/** 대여 기간이 다른 강사 순환 주차와 겹치면 충돌 목록 반환 */
async function findRotationConflictsForRental(adminClient, {
  holderTeacherId,
  itemId,
  itemName,
  startYmd,
  endYmd,
}) {
  if (!holderTeacherId || !startYmd || !endYmd || (!itemId && !itemName)) return [];
  const months = monthsSpanned(startYmd, endYmd);
  const { data: schedules } = await adminClient
    .from("item_rotation_schedule")
    .select("teacher_id, year_month, assigned_letter")
    .in("year_month", months);
  if (!schedules?.length) return [];

  const { data: weeklyLists } = await adminClient.from("item_weekly_lists").select("*");
  const { data: monthWeeks } = await adminClient
    .from("item_rotation_month_weeks")
    .select("*")
    .in("year_month", months);

  const teacherIds = [...new Set(schedules.map((s) => s.teacher_id))];
  const { data: teachers } = await adminClient
    .from("teachers")
    .select("id, name")
    .in("id", teacherIds);
  const teacherMap = new Map((teachers || []).map((t) => [t.id, t.name]));

  const conflicts = [];
  for (const sched of schedules) {
    if (sched.teacher_id === holderTeacherId) continue;
    const assignedRows = (weeklyLists || []).filter((w) => {
      if (w.letter !== sched.assigned_letter) return false;
      if (itemName && w.item_name === itemName) return true;
      return false;
    });
    if (!assignedRows.length) continue;
    const weeksForMonth = (monthWeeks || []).filter((w) => w.year_month === sched.year_month);
    for (const row of assignedRows) {
      const mw = weeksForMonth.find((w) => w.week_number === row.week_number);
      if (!mw) continue;
      const overlaps = startYmd <= mw.week_end_date && endYmd >= mw.week_start_date;
      if (!overlaps) continue;
      conflicts.push({
        teacherId: sched.teacher_id,
        teacherName: teacherMap.get(sched.teacher_id) || "다른 강사",
        weekStart: mw.week_start_date,
        weekEnd: mw.week_end_date,
      });
    }
  }
  return conflicts;
}

async function runOverdueReturnReminders(adminClient, vapid) {
  const today = kstYmd(0);
  console.log("[send-push] cron overdue return reminders", { today });

  const { data: rows, error } = await adminClient
    .from("rental_items")
    .select(`
      id,
      due_date,
      item_id,
      items ( name ),
      rental_requests!inner ( teacher_id, dispatch_start, dispatch_end )
    `)
    .in("status", ["rented", "partial_returned"])
    .lt("due_date", today);

  if (error) {
    console.error("[send-push] overdue rental_items query failed", error.message);
    return jsonResponse({ error: error.message }, 500);
  }

  const overdueRows = rows || [];
  let sentSet = new Set();
  if (overdueRows.length) {
    const { data: alreadySent } = await adminClient
      .from("rental_overdue_push_log")
      .select("rental_item_id")
      .eq("remind_date", today)
      .in("rental_item_id", overdueRows.map((r) => r.id));
    sentSet = new Set((alreadySent || []).map((r) => r.rental_item_id));
  }

  const adminIds = await getTodoAdminIds(adminClient);

  let teacherSent = 0;
  let adminSent = 0;
  let skipped = 0;
  const results = [];

  for (const row of overdueRows) {
    if (sentSet.has(row.id)) {
      skipped += 1;
      continue;
    }
    const teacherId = row.rental_requests?.teacher_id;
    const itemName = row.items?.name || "교구";
    if (!teacherId) continue;

    const dueDate = row.due_date;
    const overdueDays = Math.max(
      0,
      Math.round(
        (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${dueDate}T12:00:00Z`)) / 86400000,
      ),
    );

    const startYmd = row.rental_requests?.dispatch_start || dueDate;
    const endYmd = row.rental_requests?.dispatch_end || dueDate;
    const conflicts = await findRotationConflictsForRental(adminClient, {
      holderTeacherId: teacherId,
      itemId: row.item_id,
      itemName,
      startYmd,
      endYmd,
    });
    // 연체 시점 기준으로도 오늘~due 이후 주차와 겹치는지: due~오늘+30일 확장 검사
    const futureConflicts = await findRotationConflictsForRental(adminClient, {
      holderTeacherId: teacherId,
      itemId: row.item_id,
      itemName,
      startYmd: dueDate,
      endYmd: kstYmd(30),
    });
    const rotationHit = [...conflicts, ...futureConflicts];
    const earliest = rotationHit.sort((a, b) => String(a.weekStart).localeCompare(String(b.weekStart)))[0];

    let teacherBody;
    if (earliest) {
      teacherBody =
        `${itemName}은(는) ${formatKoMonthDay(earliest.weekStart)} ${earliest.teacherName} 선생님 정규수업(순환)에 배정된 교구입니다. 빠른 반납 부탁드립니다`;
    } else {
      teacherBody =
        `${itemName} 반납 기한(${formatKoMonthDay(dueDate)})이 지났습니다. 반납 부탁드립니다`;
    }

    const teacherResult = await deliverPushNotifications(adminClient, vapid, "rental_overdue_reminder", {
      teacherIds: [teacherId],
      title: "반납 기한 초과",
      body: teacherBody,
      url: "/gear",
    });
    teacherSent += teacherResult.sent;

    const notifyAdmins = Boolean(earliest) || overdueDays >= 2;
    let adminResult = { sent: 0 };
    if (notifyAdmins && adminIds.length) {
      const adminBody = earliest
        ? `[연체·순환충돌] ${itemName} · 대여자 반납 필요 (순환: ${earliest.teacherName} ${formatKoMonthDay(earliest.weekStart)}~${formatKoMonthDay(earliest.weekEnd)})`
        : `[연체 ${overdueDays}일] ${itemName} · 반납기한 ${formatKoMonthDay(dueDate)}`;
      adminResult = await deliverPushNotifications(adminClient, vapid, "rental_overdue_admin", {
        teacherIds: adminIds.filter((id) => id !== teacherId),
        title: "교구 연체 알림",
        body: adminBody,
        url: "/gear",
      });
      adminSent += adminResult.sent;
    }

    await adminClient.from("rental_overdue_push_log").upsert({
      rental_item_id: row.id,
      remind_date: today,
      sent_at: new Date().toISOString(),
      had_rotation_conflict: Boolean(earliest),
    }, { onConflict: "rental_item_id,remind_date" });

    results.push({
      rental_item_id: row.id,
      item_name: itemName,
      teacher_id: teacherId,
      overdue_days: overdueDays,
      rotation: Boolean(earliest),
      teacher_sent: teacherResult.sent,
      admin_sent: adminResult.sent,
    });
  }

  const summary = {
    today,
    overdue: rows?.length ?? 0,
    skipped,
    teacherSent,
    adminSent,
    results,
  };
  console.log("[send-push] cron overdue complete", summary);
  return jsonResponse(summary);
}

function maskEndpoint(endpoint: string) {
  if (!endpoint) return "";
  if (endpoint.length <= 48) return endpoint;
  return `${endpoint.slice(0, 48)}…`;
}

async function isItemAdmin(client, userId) {
  const { data } = await client
    .from("teachers")
    .select("role, is_item_admin")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "superadmin" || data?.is_item_admin === true;
}

async function isScheduleAdmin(client, userId) {
  const { data } = await client
    .from("teachers")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "admin" || data?.role === "superadmin";
}

async function getItemAdminIds(client) {
  const { data } = await client
    .from("teachers")
    .select("id")
    .eq("active", true)
    .or("role.eq.superadmin,is_item_admin.eq.true");
  return (data || []).map((row) => row.id);
}

/** 할 일 대상: 스케줄 admin + 교구 관리자 */
async function getTodoAdminIds(client) {
  const { data } = await client
    .from("teachers")
    .select("id")
    .eq("active", true)
    .or("role.eq.superadmin,role.eq.admin,is_item_admin.eq.true");
  return (data || []).map((row) => row.id);
}

async function canManageTodos(client, userId) {
  const { data } = await client
    .from("teachers")
    .select("role, is_item_admin")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "superadmin"
    || data?.role === "admin"
    || data?.is_item_admin === true;
}

async function getScheduleAdminIds(client) {
  const { data } = await client
    .from("teachers")
    .select("id")
    .eq("active", true)
    .in("role", ["admin", "superadmin"]);
  return (data || []).map((row) => row.id);
}

async function getSuperAdminIds(client) {
  const superAdminEnvId = Deno.env.get("SUPER_ADMIN_ID") ?? "";
  const { data } = await client
    .from("teachers")
    .select("id")
    .eq("active", true)
    .eq("role", "superadmin");
  const ids = new Set((data || []).map((row) => row.id));
  if (superAdminEnvId) ids.add(superAdminEnvId);
  return [...ids];
}

function consultationBrandLabel(brand) {
  const normalized = String(brand || "gts")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (
    normalized === "elitecore"
    || normalized === "ec"
    || normalized === "엘리트코어"
    || normalized.includes("elite")
  ) {
    return "엘리트코어";
  }
  return "GTS";
}

const SERVICE_ROLE_EVENTS = new Set([
  "cron_return_due_reminders",
  "cron_overdue_return_reminders",
  "todo_due_today",
]);

function extractBearerToken(authHeader: string | null) {
  if (!authHeader) return "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}

function isServiceRoleAuth(bearerToken: string, serviceKey: string) {
  if (!bearerToken || !serviceKey) return false;
  return bearerToken === serviceKey;
}

/** consultation_requested — GAS 등 외부 호출 (인증 불필요, verify_jwt=false 필수) */
function isConsultationRequestedEvent(event: string) {
  return event === "consultation_requested";
}

async function resolveConsultationRequested(adminClient, payload) {
  const name = String(payload?.name || payload?.applicant_name || "").trim() || "고객";
  const program = String(payload?.program || payload?.program_name || "").trim() || "프로그램";
  const brandLabel = consultationBrandLabel(payload?.brand || payload?.source);
  return {
    teacherIds: await getSuperAdminIds(adminClient),
    title: "상담 신청",
    body: `${name}님이 ${program} 상담을 신청했습니다 (${brandLabel})`,
    url: "/",
  };
}

async function runConsultationRequested(adminClient, vapid, payload) {
  const resolved = await resolveConsultationRequested(adminClient, payload || {});
  const result = await deliverPushNotifications(
    adminClient,
    vapid,
    "consultation_requested",
    resolved,
  );
  console.log("[send-push] consultation_requested complete", result);
  return jsonResponse(result);
}

async function getAllActiveTeacherIds(client) {
  const { data } = await client
    .from("teachers")
    .select("id")
    .eq("active", true);
  return (data || []).map((row) => row.id);
}

/** active + role=teacher only (관리자·슈퍼관리자 제외) */
async function getActiveTeacherRoleIds(client) {
  const { data } = await client
    .from("teachers")
    .select("id")
    .eq("active", true)
    .eq("role", "teacher");
  return (data || []).map((row) => row.id);
}

async function getInstitutionTeacherIds(client, institutionId) {
  if (!institutionId) return [];
  const [assignmentsRes, weeklyRes] = await Promise.all([
    client
      .from("institution_teacher_assignments")
      .select("teacher_id")
      .eq("institution_id", institutionId)
      .eq("is_active", true),
    client
      .from("institution_weekly_schedule")
      .select("teacher_id")
      .eq("institution_id", institutionId)
      .not("teacher_id", "is", null),
  ]);
  const ids = new Set<string>();
  for (const row of assignmentsRes.data || []) {
    if (row.teacher_id) ids.add(row.teacher_id);
  }
  for (const row of weeklyRes.data || []) {
    if (row.teacher_id) ids.add(row.teacher_id);
  }
  return [...ids];
}

/** 기관 배정·주간일정 중 role=teacher 인 계정만 */
async function getInstitutionTeacherRoleIds(client, institutionId) {
  if (!institutionId) return [];
  const [assignmentsRes, weeklyRes] = await Promise.all([
    client
      .from("institution_teacher_assignments")
      .select("teacher_id, role")
      .eq("institution_id", institutionId)
      .eq("is_active", true),
    client
      .from("institution_weekly_schedule")
      .select("teacher_id")
      .eq("institution_id", institutionId)
      .not("teacher_id", "is", null),
  ]);
  const ids = new Set<string>();
  for (const row of assignmentsRes.data || []) {
    // 수업 선생님만 (담당 관리자 role=manager 제외). role null은 기존 데이터 → teacher
    if (row.teacher_id && (row.role == null || row.role === "teacher")) {
      ids.add(row.teacher_id);
    }
  }
  for (const row of weeklyRes.data || []) {
    if (row.teacher_id) ids.add(row.teacher_id);
  }
  if (!ids.size) return [];
  const { data } = await client
    .from("teachers")
    .select("id")
    .in("id", [...ids])
    .eq("active", true)
    .eq("role", "teacher");
  return (data || []).map((row) => row.id);
}

async function resolveNoticePostedTeacherIds(client, payload) {
  const explicit = Array.isArray(payload?.teacher_ids)
    ? payload.teacher_ids.filter(Boolean)
    : [];
  if (explicit.length) return explicit;

  const audience = String(payload?.audience_type || "all");
  if (audience === "teachers") {
    return getActiveTeacherRoleIds(client);
  }
  if (audience === "institution_teachers") {
    return getInstitutionTeacherRoleIds(client, payload?.institution_id);
  }
  if (audience === "specific") {
    const ids = Array.isArray(payload?.audience_teacher_ids)
      ? payload.audience_teacher_ids.filter(Boolean)
      : [];
    return ids;
  }
  return getAllActiveTeacherIds(client);
}

async function deliverPushNotifications(
  adminClient,
  vapid: { public: string; private: string; subject: string },
  event: string,
  resolved: { teacherIds: string[]; title: string; body: string; url: string },
) {
  const teacherIds = [...new Set((resolved.teacherIds || []).filter(Boolean))];
  if (!teacherIds.length) {
    return { sent: 0, total: 0, failed: 0, staleRemoved: 0, failures: [], message: "No recipients" };
  }

  const { data: subscriptions, error: subError } = await adminClient
    .from("push_subscriptions")
    .select("id, teacher_id, endpoint, p256dh, auth, created_at")
    .in("teacher_id", teacherIds);

  if (subError) {
    throw new Error(subError.message);
  }

  if (!subscriptions?.length) {
    return {
      sent: 0,
      total: 0,
      failed: 0,
      staleRemoved: 0,
      failures: [],
      message: "No subscriptions",
      teacherIds,
    };
  }

  webpush.setVapidDetails(vapid.subject, vapid.public, vapid.private);

  const pushPayload = JSON.stringify({
    title: resolved.title,
    body: resolved.body,
    url: resolved.url,
    event,
  });

  let sent = 0;
  const staleIds: string[] = [];
  const failures: Array<{ id: string; teacher_id?: string; statusCode?: number; message: string }> = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const label = { id: sub.id, teacher_id: sub.teacher_id, endpoint: maskEndpoint(sub.endpoint) };
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushPayload,
        );
        sent += 1;
        console.log("[send-push] webpush.send OK", label);
      } catch (err) {
        const status = err?.statusCode;
        const message = err?.message || String(err);
        failures.push({
          id: sub.id,
          teacher_id: sub.teacher_id,
          statusCode: status,
          message,
        });
        if (status === 404 || status === 410) {
          staleIds.push(sub.id);
        }
        console.error("[send-push] webpush.send FAILED", { ...label, statusCode: status, message });
      }
    }),
  );

  if (staleIds.length) {
    await adminClient.from("push_subscriptions").delete().in("id", staleIds);
  }

  return {
    sent,
    total: subscriptions.length,
    failed: failures.length,
    staleRemoved: staleIds.length,
    failures,
    teacherIds,
  };
}

async function runReturnDueReminders(adminClient, vapid) {
  const dueDate = kstTomorrowYmd();
  console.log("[send-push] cron return due reminders", { dueDate });

  const { data: rows, error } = await adminClient
    .from("rental_items")
    .select(`
      id,
      due_date,
      items ( name ),
      rental_requests!inner ( teacher_id )
    `)
    .in("status", ["rented", "partial_returned"])
    .eq("due_date", dueDate);

  if (error) {
    console.error("[send-push] rental_items query failed", error.message);
    return jsonResponse({ error: error.message }, 500);
  }

  const byTeacher = new Map<string, string[]>();
  for (const row of rows || []) {
    const teacherId = row.rental_requests?.teacher_id;
    if (!teacherId) continue;
    const name = row.items?.name || "교구";
    if (!byTeacher.has(teacherId)) byTeacher.set(teacherId, []);
    byTeacher.get(teacherId)!.push(name);
  }

  let totalSent = 0;
  let totalFailed = 0;
  const results: Array<{ teacher_id: string; sent: number; item_names: string[] }> = [];

  for (const [teacherId, itemNames] of byTeacher) {
    const result = await deliverPushNotifications(adminClient, vapid, "return_due_reminder", {
      teacherIds: [teacherId],
      title: "반납 기한 안내",
      body: `내일까지 ${formatItemList(itemNames)} 반납 기한입니다. 잊지 마세요!`,
      url: "/gear",
    });
    totalSent += result.sent;
    totalFailed += result.failed;
    results.push({ teacher_id: teacherId, sent: result.sent, item_names: itemNames });
  }

  const summary = {
    dueDate,
    teachers: byTeacher.size,
    rentalItems: rows?.length ?? 0,
    sent: totalSent,
    failed: totalFailed,
    results,
  };
  console.log("[send-push] cron return due complete", summary);
  return jsonResponse(summary);
}

/** 매일 KST 오늘 마감 할 일 → 담당자 + 슈퍼관리자 푸시 */
async function runTodoDueTodayReminders(adminClient, vapid) {
  const dueDate = kstYmd(0);
  console.log("[send-push] cron todo due today", { dueDate });

  const { data: rows, error } = await adminClient
    .from("admin_todos")
    .select("id, content, assignee_id, due_date, is_completed")
    .eq("is_completed", false)
    .eq("due_date", dueDate);

  if (error) {
    console.error("[send-push] admin_todos query failed", error.message);
    return jsonResponse({ error: error.message }, 500);
  }

  const todos = rows || [];
  if (!todos.length) {
    const empty = { dueDate, todos: 0, sent: 0, failed: 0, results: [] };
    console.log("[send-push] cron todo due today: none", empty);
    return jsonResponse(empty);
  }

  const superIds = await getSuperAdminIds(adminClient);
  const allAdminIds = await getTodoAdminIds(adminClient);

  let totalSent = 0;
  let totalFailed = 0;
  const results: Array<{
    todo_id: string;
    content: string;
    recipients: string[];
    sent: number;
  }> = [];

  for (const todo of todos) {
    const recipients = new Set<string>(superIds);
    if (todo.assignee_id) {
      recipients.add(todo.assignee_id);
    } else {
      for (const id of allAdminIds) recipients.add(id);
    }
    const teacherIds = [...recipients].filter(Boolean);
    const titleText = String(todo.content || "").trim() || "할 일";
    const result = await deliverPushNotifications(adminClient, vapid, "todo_due_today", {
      teacherIds,
      title: "할 일 마감",
      body: `오늘 마감: ${titleText}`,
      url: "/gear?page=notices",
    });
    totalSent += result.sent;
    totalFailed += result.failed;
    results.push({
      todo_id: todo.id,
      content: titleText,
      recipients: teacherIds,
      sent: result.sent,
    });
  }

  const summary = {
    dueDate,
    todos: todos.length,
    sent: totalSent,
    failed: totalFailed,
    results,
  };
  console.log("[send-push] cron todo due today complete", summary);
  return jsonResponse(summary);
}

async function isScheduleSuperAdmin(client, userId) {
  const { data } = await client
    .from("teachers")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "superadmin";
}

async function resolveNotification(event, payload, userId, adminClient) {
  switch (event) {
    case "rental_approved": {
      if (!(await isItemAdmin(adminClient, userId))) {
        return { error: "Forbidden", status: 403 };
      }
      return {
        teacherIds: [payload.teacher_id],
        title: "대여 승인",
        body: `${formatItemList(payload.item_names)} 교구 대여가 승인됐습니다`,
        url: "/gear",
      };
    }
    case "rental_rejected": {
      if (!(await isItemAdmin(adminClient, userId))) {
        return { error: "Forbidden", status: 403 };
      }
      const reason = String(payload.reason || "").trim() || "없음";
      return {
        teacherIds: [payload.teacher_id],
        title: "대여 거절",
        body: `${formatItemList(payload.item_names)} 교구 대여가 거절됐습니다 (사유: ${reason})`,
        url: "/gear",
      };
    }
    case "rental_requested": {
      if (userId !== payload.teacher_id) {
        return { error: "Forbidden", status: 403 };
      }
      return {
        teacherIds: await getItemAdminIds(adminClient),
        title: "대여 신청",
        body: `${payload.teacher_name} 선생님이 ${formatItemList(payload.item_names)} 교구 대여를 신청했습니다`,
        url: "/gear",
      };
    }
    case "return_submitted": {
      if (userId !== payload.teacher_id) {
        return { error: "Forbidden", status: 403 };
      }
      return {
        teacherIds: await getItemAdminIds(adminClient),
        title: "반납 신청",
        body: `${payload.teacher_name} 선생님이 ${formatItemList(payload.item_names)} 교구를 반납했습니다`,
        url: "/gear",
      };
    }
    case "gear_registered": {
      if (!(await isItemAdmin(adminClient, userId))) {
        return { error: "Forbidden", status: 403 };
      }
      const itemName = String(payload.item_name || "").trim().slice(0, 100);
      const actorName = String(payload.actor_name || "").trim().slice(0, 50) || "관리자";
      if (!itemName) {
        return { error: "item_name required", status: 400 };
      }
      return {
        teacherIds: await getTodoAdminIds(adminClient),
        title: "새 교구 등록",
        body: `${actorName}님이 ${itemName}을(를) 재고에 추가했습니다`,
        url: "/gear",
      };
    }
    case "rental_extended": {
      if (userId !== payload.teacher_id) {
        return { error: "Forbidden", status: 403 };
      }
      const weeks = Number(payload.weeks) || 0;
      const weekLabel = weeks ? ` ${weeks}주` : "";
      return {
        teacherIds: await getItemAdminIds(adminClient),
        title: "대여 연장 신청",
        body: `${payload.teacher_name} 선생님이 ${formatItemList(payload.item_names)} 교구 대여를${weekLabel} 연장 신청했습니다`,
        url: "/gear",
      };
    }
    case "rental_rotation_due_notice": {
      if (!(await isItemAdmin(adminClient, userId))) {
        return { error: "Forbidden", status: 403 };
      }
      const itemName = String(payload.item_name || "").trim() || "교구";
      const returnBy = formatKoMonthDay(payload.return_by) || formatKoMonthDay(payload.week_start);
      const nextTeacher = String(payload.next_teacher_name || "").trim();
      const nextPart = nextTeacher
        ? ` (다음: ${nextTeacher} 선생님 정규수업/순환)`
        : " (다음 정규수업/순환 예약 있음)";
      return {
        teacherIds: [payload.teacher_id],
        title: "반납 기한 안내",
        body: `${itemName}은(는) ${returnBy}까지 반드시 반납해 주세요${nextPart}`,
        url: "/gear",
      };
    }
    case "schedule_change": {
      if (userId !== payload.teacher_id) {
        return { error: "Forbidden", status: 403 };
      }
      const dateLabel = formatClassDate(payload.class_date);
      const inst = payload.institution_name || "원 미지정";
      const adminIds = await getScheduleAdminIds(adminClient);
      const teacherIds = [...new Set([payload.teacher_id, ...adminIds])];
      return {
        teacherIds,
        title: "수업 변동",
        body: `수업 변동 알림: ${inst} ${dateLabel} 수업이 변경됐습니다`,
        url: "/schedule",
      };
    }
    case "notice_posted": {
      if (!(await isScheduleAdmin(adminClient, userId))) {
        return { error: "Forbidden", status: 403 };
      }
      const title = String(payload.title || "").trim() || "제목 없음";
      return {
        teacherIds: await resolveNoticePostedTeacherIds(adminClient, payload || {}),
        title: "공지사항",
        body: `새 공지사항: ${title}`,
        url: "/gear",
      };
    }
    case "event_scheduled": {
      if (!(await isScheduleAdmin(adminClient, userId))) {
        return { error: "Forbidden", status: 403 };
      }
      const eventName = String(payload.note || payload.event_name || "행사").trim();
      const dateLabel = formatClassDate(payload.event_date || payload.exception_date);
      const teacherIds = await getInstitutionTeacherIds(adminClient, payload.institution_id);
      return {
        teacherIds,
        title: "행사 일정",
        body: `새 행사 일정: ${eventName}${dateLabel ? ` ${dateLabel}` : ""}`,
        url: "/schedule",
      };
    }
    case "substitute_lesson": {
      if (!(await isScheduleSuperAdmin(adminClient, userId))) {
        return { error: "Forbidden", status: 403 };
      }
      const body = String(payload.body || "").trim();
      if (!body || !payload.teacher_id) {
        return { error: "teacher_id and body required", status: 400 };
      }
      return {
        teacherIds: [payload.teacher_id],
        title: "대체수업",
        body,
        url: "/schedule",
      };
    }
    case "class_reassigned": {
      if (!(await isScheduleAdmin(adminClient, userId))) {
        return { error: "Forbidden", status: 403 };
      }
      if (!payload.teacher_id) {
        return { error: "teacher_id required", status: 400 };
      }
      return {
        teacherIds: [payload.teacher_id],
        title: "수업 배정",
        body: String(payload.body || "수업이 배정됐습니다"),
        url: "/schedule",
      };
    }
    case "class_unassigned_admin": {
      if (!(await isScheduleAdmin(adminClient, userId))) {
        return { error: "Forbidden", status: 403 };
      }
      const adminIds = await getScheduleAdminIds(adminClient);
      return {
        teacherIds: adminIds,
        title: "수업 미배정",
        body: String(payload.body || "퇴직 후 미배정 수업이 있습니다"),
        url: "/schedule",
      };
    }
    case "institution_teacher_assigned": {
      if (!(await isScheduleAdmin(adminClient, userId))) {
        return { error: "Forbidden", status: 403 };
      }
      if (!payload.teacher_id) {
        return { error: "teacher_id required", status: 400 };
      }
      return {
        teacherIds: [payload.teacher_id],
        title: "원 담당 배정",
        body: String(payload.body || "원 담당이 배정됐습니다"),
        url: "/schedule",
      };
    }
    case "institution_teacher_changed": {
      if (!(await isScheduleAdmin(adminClient, userId))) {
        return { error: "Forbidden", status: 403 };
      }
      if (!payload.teacher_id) {
        return { error: "teacher_id required", status: 400 };
      }
      return {
        teacherIds: [payload.teacher_id],
        title: "원 담당 변경",
        body: String(payload.body || "원 담당이 변경됐습니다"),
        url: "/schedule",
      };
    }
    case "task_assigned": {
      if (!(await canManageTodos(adminClient, userId))) {
        return { error: "Forbidden", status: 403 };
      }
      const title = String(payload.title || "").trim() || "새 업무";
      const pri = String(payload.priority || "").trim();
      const priLabel = pri === "urgent" ? "긴급" : pri === "important" ? "중요" : pri === "normal" ? "일반" : "";
      let teacherIds = payload.assignee_id
        ? [String(payload.assignee_id)]
        : await getTodoAdminIds(adminClient);
      teacherIds = teacherIds.filter((id) => id && id !== userId);
      return {
        teacherIds,
        title: "새 할 일",
        body: priLabel
          ? `[${priLabel}] ${title}`
          : `새 할 일이 등록됐습니다: ${title}`,
        url: "/gear?page=notices",
      };
    }
    case "task_item_completed": {
      if (!(await canManageTodos(adminClient, userId))) {
        return { error: "Forbidden", status: 403 };
      }
      const actor = String(payload.actor_name || "").trim() || "담당자";
      const item = String(payload.item_text || "").trim() || "항목";
      let teacherIds = await getTodoAdminIds(adminClient);
      teacherIds = teacherIds.filter((id) => id && id !== userId);
      return {
        teacherIds,
        title: "할 일 진행",
        body: `${actor}님이 "${item}"을(를) 완료했습니다`,
        url: "/gear?page=notices",
      };
    }
    case "consultation_requested": {
      return resolveConsultationRequested(adminClient, payload);
    }
    default:
      return { error: "Unknown event", status: 400 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[send-push] request received", { method: req.method });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@gts.kr";
    const vapid = { public: vapidPublic, private: vapidPrivate, subject: vapidSubject };

    if (!vapidPublic || !vapidPrivate) {
      return jsonResponse({ error: "VAPID keys not configured" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    let body: { event?: string; payload?: Record<string, unknown> };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { event, payload } = body;
    if (!event) {
      return jsonResponse({ error: "event is required" }, 400);
    }

    // ── 상담 신청: 인증 없이 허용 (Google Apps Script) ──
    if (isConsultationRequestedEvent(event)) {
      console.log("[send-push] consultation_requested (public)", { payload });
      return await runConsultationRequested(adminClient, vapid, payload);
    }

    const authHeader = req.headers.get("Authorization");
    const bearerToken = extractBearerToken(authHeader);
    const apiKeyHeader = req.headers.get("apikey")?.trim() ?? "";
    const isServiceRole = isServiceRoleAuth(bearerToken, serviceKey)
      || (Boolean(serviceKey) && apiKeyHeader === serviceKey);

    console.log("[send-push] auth", {
      event,
      isServiceRole,
      hasAuthHeader: Boolean(authHeader),
      hasApiKeyHeader: Boolean(apiKeyHeader),
    });

    // ── pg_cron: service role만 ──
    if (isServiceRole && SERVICE_ROLE_EVENTS.has(event)) {
      if (event === "cron_return_due_reminders") {
        return await runReturnDueReminders(adminClient, vapid);
      }
      if (event === "cron_overdue_return_reminders") {
        return await runOverdueReturnReminders(adminClient, vapid);
      }
      if (event === "todo_due_today") {
        return await runTodoDueTodayReminders(adminClient, vapid);
      }
    }

    if (isServiceRole) {
      return jsonResponse({ error: "Forbidden service event", event }, 403);
    }

    // ── 로그인 사용자 JWT (앱 내 sendPushEvent) ──
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("[send-push] getUser failed", userError?.message);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    console.log("[send-push] invoke", { event, callerUserId: user.id, payload });

    const resolved = await resolveNotification(event, payload || {}, user.id, adminClient);
    if (resolved.error) {
      return jsonResponse({ error: resolved.error }, resolved.status || 400);
    }

    const result = await deliverPushNotifications(adminClient, vapid, event, resolved);
    console.log("[send-push] complete", result);
    return jsonResponse(result);
  } catch (err) {
    console.error("[send-push] unhandled error", err?.message || err, err);
    return jsonResponse({ error: err?.message || "Internal error" }, 500);
  }
});
