const PUSH_PROMPT_KEY = "gts_push_prompt_state";

/** Vite import.meta.env + vite.config define(__GTS_VAPID_PUBLIC_KEY__) */
function readBuildTimeVapidKey() {
  const fromDefine = typeof __GTS_VAPID_PUBLIC_KEY__ !== "undefined"
    ? __GTS_VAPID_PUBLIC_KEY__
    : "";
  const fromMeta = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  const key = (fromDefine || fromMeta || "").trim();
  // Vite 미설정 시 문자열 "undefined" 방지
  if (!key || key === "undefined") return "";
  return key;
}

const BUILD_TIME_VAPID_KEY = readBuildTimeVapidKey();

let cachedVapidPublicKey = BUILD_TIME_VAPID_KEY || null;
let vapidPreloadPromise = null;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

function logPush(step, detail) {
  if (detail !== undefined) {
    console.info(`[push] ${step}`, detail);
  } else {
    console.info(`[push] ${step}`);
  }
}

function logPushError(step, detail) {
  console.error(`[push] ${step}`, detail);
}

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
  if (isAppleMobile() && !isIosStandalonePwa()) return false;
  return true;
}

export function isPushSupported() {
  if (!canShowPushPrompt()) return false;
  return "PushManager" in window || isIosStandalonePwa();
}

/** VAPID 공개키 — 빌드 타임 → Vercel API → Supabase Edge Function 순으로 조회 */
export async function getVapidPublicKey() {
  if (cachedVapidPublicKey) return cachedVapidPublicKey;

  if (BUILD_TIME_VAPID_KEY) {
    cachedVapidPublicKey = BUILD_TIME_VAPID_KEY;
    logPush("VAPID: build-time", maskKey(BUILD_TIME_VAPID_KEY));
    return cachedVapidPublicKey;
  }

  // 1) Vercel Serverless API (런타임 env)
  const fromVercel = await fetchVapidFromVercelApi();
  if (fromVercel) {
    cachedVapidPublicKey = fromVercel;
    return cachedVapidPublicKey;
  }

  // 2) Supabase Edge Function (send-push 와 동일 VAPID_PUBLIC_KEY 시크릿)
  const fromSupabase = await fetchVapidFromSupabase();
  if (fromSupabase) {
    cachedVapidPublicKey = fromSupabase;
    return cachedVapidPublicKey;
  }

  logPushError("VAPID: 모든 소스에서 키를 찾지 못함", getPushEnvDiagnostics());
  return "";
}

async function fetchVapidFromVercelApi() {
  logPush("VAPID: /api/push/vapid-public-key 조회");
  try {
    const res = await fetch("/api/push/vapid-public-key", { cache: "no-store" });
    if (!res.ok) {
      logPushError("VAPID API HTTP 오류", { status: res.status });
      return "";
    }
    const json = await res.json();
    if (json.publicKey) {
      logPush("VAPID: Vercel API", maskKey(json.publicKey));
      return json.publicKey;
    }
    logPushError("VAPID API: publicKey 없음", json);
  } catch (err) {
    logPushError("VAPID API fetch 실패", err);
  }
  return "";
}

async function fetchVapidFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    logPushError("VAPID: Supabase URL/anon key 없음");
    return "";
  }
  logPush("VAPID: Supabase Edge Function 조회");
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/vapid-public-key`, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      logPushError("VAPID Supabase HTTP 오류", { status: res.status });
      return "";
    }
    const json = await res.json();
    if (json.publicKey) {
      logPush("VAPID: Supabase Edge Function", maskKey(json.publicKey));
      return json.publicKey;
    }
    logPushError("VAPID Supabase: publicKey 없음", json);
  } catch (err) {
    logPushError("VAPID Supabase fetch 실패", err);
  }
  return "";
}

/** 앱 시작 시 VAPID 키 미리 로드 (구독 버튼 클릭 전) */
export function preloadVapidPublicKey() {
  if (cachedVapidPublicKey) return Promise.resolve(cachedVapidPublicKey);
  if (!vapidPreloadPromise) {
    vapidPreloadPromise = getVapidPublicKey().finally(() => {
      vapidPreloadPromise = null;
    });
  }
  return vapidPreloadPromise;
}

export function getPushEnvDiagnostics() {
  return {
    importMetaEnv: import.meta.env.VITE_VAPID_PUBLIC_KEY ?? null,
    defineInjected: typeof __GTS_VAPID_PUBLIC_KEY__ !== "undefined"
      ? maskKey(__GTS_VAPID_PUBLIC_KEY__)
      : "(not defined)",
    buildTimeResolved: maskKey(BUILD_TIME_VAPID_KEY),
    cachedVapid: cachedVapidPublicKey ? maskKey(cachedVapidPublicKey) : "(not loaded)",
    notificationPermission: typeof Notification !== "undefined" ? Notification.permission : "n/a",
    serviceWorker: "serviceWorker" in navigator,
    pushManager: "PushManager" in window,
    iosStandalone: isIosStandalonePwa(),
    canShowPrompt: canShowPushPrompt(),
    isPushSupported: isPushSupported(),
  };
}

function maskKey(key) {
  if (!key) return "(empty)";
  if (key.length <= 12) return `${key.slice(0, 4)}…`;
  return `${key.slice(0, 8)}…${key.slice(-4)} (${key.length}chars)`;
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

export function clearPushPromptState() {
  try {
    localStorage.removeItem(PUSH_PROMPT_KEY);
  } catch {
    /* ignore */
  }
}

async function ensureServiceWorker(timeoutMs = 25000) {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service worker not supported");
  }

  logPush("Service Worker 준비 대기…");
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.active) {
      logPush("Service Worker active", reg.scope);
      return reg;
    }
    if (reg?.installing || reg?.waiting) {
      logPush("Service Worker installing/waiting…", reg.installing?.state || reg.waiting?.state);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  const ready = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Service worker registration timeout")), 5000);
    }),
  ]);

  if (!ready?.active && !ready?.pushManager) {
    throw new Error("Service worker not active");
  }

  logPush("Service Worker ready", ready.scope);
  return ready;
}

async function verifyAuthSession(supabase, teacherId) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    logPushError("auth.getSession error", error);
    throw new Error(`Auth session error: ${error.message}`);
  }
  if (!session?.user?.id) {
    throw new Error("Not authenticated — 로그인 후 다시 시도해 주세요");
  }
  if (session.user.id !== teacherId) {
    logPushError("teacherId ≠ auth.uid()", { teacherId, authUid: session.user.id });
    throw new Error("User ID mismatch");
  }
  logPush("auth session OK", { userId: session.user.id });
  return session;
}

/**
 * 브라우저 알림 권한 요청 — 반드시 사용자 클릭 핸들러에서 첫 await로 호출
 */
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";

  const current = Notification.permission;
  logPush("requestPermission: current", current);
  if (current === "granted" || current === "denied") return current;

  const request = Notification.requestPermission.bind(Notification);

  try {
    if (request.length >= 1) {
      const result = await new Promise((resolve) => {
        request((status) => resolve(status));
      });
      logPush("requestPermission: result (callback API)", result);
      return result;
    }
    const result = await request();
    logPush("requestPermission: result (promise API)", result);
    return result;
  } catch (err) {
    logPushError("requestPermission failed", err);
    return Notification.permission;
  }
}

/** DB에 구독 정보가 저장되어 있는지 확인 */
export async function hasPushSubscription(supabase, teacherId) {
  if (!teacherId) return false;
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("teacher_id", teacherId)
    .limit(1);
  if (error) {
    logPushError("hasPushSubscription query failed", error);
    return false;
  }
  const found = (data?.length ?? 0) > 0;
  logPush("hasPushSubscription", { teacherId, found });
  return found;
}

export async function savePushSubscription(supabase, teacherId, subscription) {
  await verifyAuthSession(supabase, teacherId);

  const json = subscription.toJSON();
  const keys = json.keys || {};
  if (!json.endpoint || !keys.p256dh || !keys.auth) {
    throw new Error("Invalid push subscription object");
  }

  const row = {
    teacher_id: teacherId,
    endpoint: json.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    user_agent: navigator.userAgent,
    updated_at: new Date().toISOString(),
  };

  logPush("push_subscriptions upsert 시도", {
    teacherId,
    endpoint: `${json.endpoint.slice(0, 48)}…`,
  });

  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(row, { onConflict: "teacher_id,endpoint" })
    .select("id, teacher_id, created_at");

  if (error) {
    logPushError("push_subscriptions upsert failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  logPush("push_subscriptions upsert OK", data);
  return data;
}

/** 권한 허용 후 Push 구독 등록 */
export async function registerPushSubscription(supabase, teacherId) {
  logPush("registerPushSubscription 시작", { teacherId, env: getPushEnvDiagnostics() });

  if (!teacherId) {
    logPushError("registerPushSubscription", "no_teacher");
    return { ok: false, reason: "no_teacher" };
  }
  if (!canShowPushPrompt()) {
    logPushError("registerPushSubscription", "canShowPushPrompt=false");
    return { ok: false, reason: "unsupported" };
  }
  if (Notification.permission !== "granted") {
    logPushError("registerPushSubscription", { permission: Notification.permission });
    return { ok: false, reason: "not_granted" };
  }

  const vapidKey = await getVapidPublicKey();
  if (!vapidKey) {
    logPushError("registerPushSubscription", "VAPID public key missing — Vercel env VITE_VAPID_PUBLIC_KEY 확인");
    return { ok: false, reason: "no_vapid" };
  }

  try {
    const registration = await ensureServiceWorker();
    if (!registration.pushManager) {
      logPushError("registerPushSubscription", "registration.pushManager 없음");
      return { ok: false, reason: "no_push_manager" };
    }

    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      logPush("기존 PushSubscription 재사용", subscription.endpoint?.slice(0, 48));
    } else {
      logPush("PushManager.subscribe 시도…");
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      logPush("PushManager.subscribe OK", subscription.endpoint?.slice(0, 48));
    }

    const saved = await savePushSubscription(supabase, teacherId, subscription);
    setPushPromptState("subscribed");
    logPush("registerPushSubscription 완료 ✅", { teacherId, rowId: saved?.[0]?.id });
    return { ok: true, data: saved };
  } catch (err) {
    logPushError("registerPushSubscription failed", err);
    clearPushPromptState();
    return { ok: false, reason: "subscribe_error", error: err };
  }
}

/** 권한 요청 + 구독 */
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

const PUSH_FAIL_REASON_LABELS = {
  no_vapid: "VAPID 공개키(VITE_VAPID_PUBLIC_KEY) 미설정",
  no_subscriptions: "수신자 push 구독 없음 — 관리자가 앱에서 알림 허용 필요",
  forbidden: "권한 없음",
  unauthorized: "로그인 필요",
};

/** 푸시 이벤트 전송 */
export async function sendPushEvent(supabase, event, payload) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      logPushError("send-push skipped: no session", event);
      return { ok: false, reason: "no_session" };
    }

    const { data, error } = await supabase.functions.invoke("send-push", {
      body: { event, payload },
    });

    if (error) {
      console.error("[push] send-push error", JSON.stringify(error));
      console.error("[push] send-push error context", JSON.stringify({ event, payload }));
      return { ok: false, reason: "invoke_error", error };
    }

    if (data?.error) {
      logPushError("send-push rejected", { event, error: data.error });
      return { ok: false, reason: data.error, data };
    }

    if (data?.sent === 0) {
      const hint = data.message === "No subscriptions"
        ? PUSH_FAIL_REASON_LABELS.no_subscriptions
        : data.message || "수신자 없음";
      console.warn(`[push] send-push: 전송 0건 (${event}) — ${hint}`);
      return { ok: false, reason: "no_subscriptions", data };
    }

    logPush(`send-push ok (${event})`, data);
    return { ok: true, data };
  } catch (err) {
    logPushError("send-push failed", { event, err });
    return { ok: false, reason: "exception", error: err };
  }
}

export function formatPushItemNames(names) {
  const list = (names || []).filter(Boolean);
  if (!list.length) return [];
  return list;
}

// 앱 로드 시 VAPID 프리로드 + 환경 진단
if (typeof window !== "undefined") {
  logPush("env diagnostics", getPushEnvDiagnostics());
  preloadVapidPublicKey().then((key) => {
    if (key) logPush("VAPID preload OK", maskKey(key));
    else logPushError("VAPID preload failed — Supabase Edge Function 배포 확인: supabase functions deploy vapid-public-key --no-verify-jwt");
  });
}
