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
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });
  const today = fmt.format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + addDays));
  return dt.toISOString().slice(0, 10);
}

function kstTomorrowYmd() {
  return kstYmd(1);
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
        teacherIds: await getAllActiveTeacherIds(adminClient),
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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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
