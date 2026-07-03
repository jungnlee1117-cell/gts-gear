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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@gts.kr";

    if (!vapidPublic || !vapidPrivate) {
      return jsonResponse({ error: "VAPID keys not configured" }, 500);
    }

    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { event, payload } = await req.json();

    const resolved = await resolveNotification(event, payload || {}, user.id, adminClient);
    if (resolved.error) {
      return jsonResponse({ error: resolved.error }, resolved.status || 400);
    }

    const teacherIds = [...new Set((resolved.teacherIds || []).filter(Boolean))];
    if (!teacherIds.length) {
      return jsonResponse({ sent: 0, message: "No recipients" });
    }

    const { data: subscriptions } = await adminClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("teacher_id", teacherIds);

    if (!subscriptions?.length) {
      return jsonResponse({ sent: 0, message: "No subscriptions" });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const pushPayload = JSON.stringify({
      title: resolved.title,
      body: resolved.body,
      url: resolved.url,
      event,
    });

    let sent = 0;
    const staleIds = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            pushPayload,
          );
          sent += 1;
        } catch (err) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) {
            staleIds.push(sub.id);
          }
          console.error("push failed:", sub.id, err?.message || err);
        }
      }),
    );

    if (staleIds.length) {
      await adminClient.from("push_subscriptions").delete().in("id", staleIds);
    }

    return jsonResponse({ sent, total: subscriptions.length });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: err?.message || "Internal error" }, 500);
  }
});
