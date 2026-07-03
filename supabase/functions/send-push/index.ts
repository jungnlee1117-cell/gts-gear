import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

async function isItemAdmin(client, userId) {
  const { data } = await client
    .from("teachers")
    .select("role, is_item_admin")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "superadmin" || data?.is_item_admin === true;
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

function maskEndpoint(endpoint: string) {
  if (!endpoint) return "";
  if (endpoint.length <= 48) return endpoint;
  return `${endpoint.slice(0, 48)}…`;
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("[send-push] rejected: missing Authorization header");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@gts.kr";

    console.log("[send-push] env check", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceKey: Boolean(serviceKey),
      hasVapidPublic: Boolean(vapidPublic),
      hasVapidPrivate: Boolean(vapidPrivate),
      vapidSubject,
    });

    if (!vapidPublic || !vapidPrivate) {
      console.log("[send-push] rejected: VAPID keys not configured");
      return jsonResponse({ error: "VAPID keys not configured" }, 500);
    }

    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.log("[send-push] rejected: auth failed", userError?.message || "no user");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { event, payload } = await req.json();

    console.log("[send-push] invoke", {
      event,
      callerUserId: user.id,
      payload,
    });

    const resolved = await resolveNotification(event, payload || {}, user.id, adminClient);
    if (resolved.error) {
      console.log("[send-push] rejected: resolveNotification", {
        event,
        error: resolved.error,
        status: resolved.status,
      });
      return jsonResponse({ error: resolved.error }, resolved.status || 400);
    }

    const teacherIds = [...new Set((resolved.teacherIds || []).filter(Boolean))];
    console.log("[send-push] resolved recipients", {
      event,
      teacherIds,
      title: resolved.title,
      body: resolved.body,
      url: resolved.url,
    });

    if (!teacherIds.length) {
      console.log("[send-push] no teacherIds — returning sent:0");
      return jsonResponse({ sent: 0, message: "No recipients" });
    }

    console.log("[send-push] querying push_subscriptions", {
      teacherIds,
      teacherCount: teacherIds.length,
    });

    const { data: subscriptions, error: subError } = await adminClient
      .from("push_subscriptions")
      .select("id, teacher_id, endpoint, p256dh, auth, created_at")
      .in("teacher_id", teacherIds);

    if (subError) {
      console.error("[send-push] push_subscriptions query error", {
        message: subError.message,
        code: subError.code,
        details: subError.details,
        hint: subError.hint,
      });
      return jsonResponse({ error: subError.message }, 500);
    }

    console.log("[send-push] push_subscriptions query result", {
      count: subscriptions?.length ?? 0,
      rows: (subscriptions || []).map((sub) => ({
        id: sub.id,
        teacher_id: sub.teacher_id,
        endpoint: maskEndpoint(sub.endpoint),
        hasP256dh: Boolean(sub.p256dh),
        hasAuth: Boolean(sub.auth),
        created_at: sub.created_at,
      })),
    });

    if (!subscriptions?.length) {
      console.log("[send-push] no subscriptions found for teacherIds", teacherIds);
      return jsonResponse({ sent: 0, message: "No subscriptions", teacherIds });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const pushPayload = JSON.stringify({
      title: resolved.title,
      body: resolved.body,
      url: resolved.url,
      event,
    });

    console.log("[send-push] sending notifications", {
      subscriptionCount: subscriptions.length,
      payload: pushPayload,
    });

    let sent = 0;
    const staleIds: string[] = [];
    const failures: Array<{ id: string; teacher_id?: string; statusCode?: number; message: string }> = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const label = { id: sub.id, teacher_id: sub.teacher_id, endpoint: maskEndpoint(sub.endpoint) };
        try {
          console.log("[send-push] webpush.send start", label);
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
          console.error("[send-push] webpush.send FAILED", {
            ...label,
            statusCode: status,
            message,
            body: err?.body,
          });
        }
      }),
    );

    if (staleIds.length) {
      console.log("[send-push] deleting stale subscriptions", staleIds);
      const { error: deleteError } = await adminClient
        .from("push_subscriptions")
        .delete()
        .in("id", staleIds);
      if (deleteError) {
        console.error("[send-push] stale subscription delete failed", deleteError.message);
      }
    }

    const result = {
      sent,
      total: subscriptions.length,
      failed: failures.length,
      staleRemoved: staleIds.length,
      failures,
    };
    console.log("[send-push] complete", result);

    return jsonResponse(result);
  } catch (err) {
    console.error("[send-push] unhandled error", err?.message || err, err);
    return jsonResponse({ error: err?.message || "Internal error" }, 500);
  }
});
