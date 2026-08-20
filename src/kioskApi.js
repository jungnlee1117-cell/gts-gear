const USER_ERROR = "키오스크 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";

export class KioskError extends Error {
  constructor(userMessage, { status, code, field } = {}) {
    super(userMessage);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

async function readFunctionError(error, data) {
  let status = error?.context?.status ?? data?.status ?? null;
  let code = data?.code || error?.name || null;
  let message = data?.error || null;
  let field = data?.field || null;
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = typeof ctx.clone === "function" ? await ctx.clone().json() : await ctx.json();
      code = body?.code || code;
      message = body?.error || message;
      field = body?.field || field;
      status = ctx.status || status;
    }
  } catch { /* ignore */ }
  return { status, code, message, field };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} action
 * @param {Record<string, unknown>} payload
 * @param {{ kioskToken?: string, withAuth?: boolean }} [opts]
 */
export async function invokeKiosk(supabase, action, payload = {}, opts = {}) {
  try {
    const headers = {};
    if (opts.kioskToken) headers["x-kiosk-token"] = opts.kioskToken;
    if (opts.withAuth !== false) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const { data, error } = await supabase.functions.invoke("kiosk", {
      headers,
      body: { action, ...payload },
    });

    if (error) {
      const parsed = await readFunctionError(error, data);
      const msg = parsed.message && !/\d{6,}/.test(parsed.message)
        ? parsed.message
        : USER_ERROR;
      throw new KioskError(msg, parsed);
    }
    if (data?.error) {
      throw new KioskError(data.error || USER_ERROR, {
        status: 200,
        code: data.code,
        field: data.field,
      });
    }
    return data?.data ?? data;
  } catch (err) {
    if (err instanceof KioskError) throw err;
    throw new KioskError(USER_ERROR, { code: err?.name || "UNKNOWN" });
  }
}

/** 로그인 없이 키오스크 Edge Function 호출 (anon key) */
export async function invokeKioskPublic(action, payload = {}, kioskToken = "") {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new KioskError("설정 오류: Supabase URL이 없습니다.");

  const headers = {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  };
  if (kioskToken) headers["x-kiosk-token"] = kioskToken;

  const res = await fetch(`${url}/functions/v1/kiosk`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok || body?.error) {
    throw new KioskError(body?.error || USER_ERROR, {
      status: res.status,
      code: body?.code,
      field: body?.field,
    });
  }
  return body?.data ?? body;
}
