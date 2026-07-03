const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
const PUSH_PROMPT_KEY = "gts_push_prompt_state";

export function isPushSupported() {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export function getPushPromptState() {
  try {
    return localStorage.getItem(PUSH_PROMPT_KEY);
  } catch {
    return null;
  }
}

export function setPushPromptState(state) {
  try {
    localStorage.setItem(PUSH_PROMPT_KEY, state);
  } catch {
    /* ignore */
  }
}

export async function savePushSubscription(supabase, teacherId, subscription) {
  const json = subscription.toJSON();
  const keys = json.keys || {};
  if (!json.endpoint || !keys.p256dh || !keys.auth) {
    throw new Error("Invalid push subscription");
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      teacher_id: teacherId,
      endpoint: json.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "teacher_id,endpoint" },
  );

  if (error) throw error;
}

export async function subscribeToPush(supabase, teacherId) {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (!VAPID_PUBLIC_KEY) {
    console.warn("VITE_VAPID_PUBLIC_KEY is not set");
    return { ok: false, reason: "no_vapid" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "denied" };
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await savePushSubscription(supabase, teacherId, subscription);
  setPushPromptState("subscribed");
  return { ok: true };
}

/** 푸시 이벤트 전송 — 실패해도 본 작업에는 영향 없음 */
export async function sendPushEvent(supabase, event, payload) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.functions.invoke("send-push", {
      body: { event, payload },
    });
    if (error) console.error("send-push failed:", error);
  } catch (err) {
    console.error("send-push failed:", err);
  }
}

export function formatPushItemNames(names) {
  const list = (names || []).filter(Boolean);
  if (!list.length) return [];
  return list;
}
