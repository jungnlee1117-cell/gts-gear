const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
const PUSH_PROMPT_KEY = "gts_push_prompt_state";

function isAppleMobile() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** iOS 홈 화면에 추가된 PWA */
export function isIosStandalonePwa() {
  if (typeof window === "undefined") return false;
  return (
    window.navigator.standalone === true
    || window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
  );
}

/** 알림 배너 표시 가능 여부 (Notification + SW) */
export function canShowPushPrompt() {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;
  // iOS: Safari 브라우저 탭에서는 푸시 불가 — PWA(홈 화면)에서만
  if (isAppleMobile() && !isIosStandalonePwa()) return false;
  return true;
}

export function isPushSupported() {
  if (!canShowPushPrompt()) return false;
  return "PushManager" in window || isIosStandalonePwa();
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

async function ensureServiceWorker(timeoutMs = 20000) {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service worker not supported");
  }

  const existing = await navigator.serviceWorker.getRegistration();
  if (existing?.active) return existing;

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Service worker registration timeout")), timeoutMs);
    }),
  ]);
}

/**
 * 브라우저 알림 권한 요청 — 반드시 사용자 클릭 핸들러에서 첫 await로 호출
 * (iOS PWA: setState 등 다른 작업 전에 호출해야 시스템 팝업이 뜸)
 */
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";

  const current = Notification.permission;
  if (current === "granted" || current === "denied") return current;

  const request = Notification.requestPermission.bind(Notification);

  try {
    // Safari/iOS: 콜백 API
    if (request.length >= 1) {
      return await new Promise((resolve) => {
        request((status) => resolve(status));
      });
    }
    // Chrome 등: Promise API
    return await request();
  } catch (err) {
    console.error("Notification.requestPermission failed:", err);
    return Notification.permission;
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

/** 권한 허용 후 Push 구독 등록 (권한 요청은 별도) */
export async function registerPushSubscription(supabase, teacherId) {
  if (!teacherId) return { ok: false, reason: "no_teacher" };
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (Notification.permission !== "granted") {
    return { ok: false, reason: "not_granted" };
  }
  if (!VAPID_PUBLIC_KEY) {
    console.warn("VITE_VAPID_PUBLIC_KEY is not set");
    return { ok: false, reason: "no_vapid" };
  }

  try {
    const registration = await ensureServiceWorker();
    if (!registration.pushManager) {
      return { ok: false, reason: "no_push_manager" };
    }

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
  } catch (err) {
    console.error("registerPushSubscription failed:", err);
    return { ok: false, reason: "subscribe_error", error: err };
  }
}

/** 권한 요청 + 구독 (자동 복구용) */
export async function subscribeToPush(supabase, teacherId) {
  if (!canShowPushPrompt()) return { ok: false, reason: "unsupported" };

  if (Notification.permission === "granted") {
    return registerPushSubscription(supabase, teacherId);
  }

  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    return { ok: false, reason: permission === "denied" ? "denied" : "not_granted" };
  }

  return registerPushSubscription(supabase, teacherId);
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
