const USER_SAVE_ERROR = "정산정보 저장에 실패했습니다. 잠시 후 다시 시도해주세요.";
const USER_LOAD_ERROR = "정산정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
const USER_GENERIC_ERROR = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";

function userMessageForAction(action) {
  if (action === "upsert_settlement") return USER_SAVE_ERROR;
  if (action === "get_settlement") return USER_LOAD_ERROR;
  if (action === "reveal_settlement") return "정산정보를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.";
  if (action === "issue_contract") return "계약서를 발행하지 못했습니다. 잠시 후 다시 시도해주세요.";
  if (action === "cancel_pending_contract") return "계약서 발행을 취소하지 못했습니다.";
  if (action === "get_contract_issue_context") return "계약 정보를 불러오지 못했습니다.";
  return USER_GENERIC_ERROR;
}

function looksSensitive(text) {
  return /\d{6,}/.test(String(text || "")) || /data:image\//i.test(String(text || ""));
}

function logHrFailure(action, status, code) {
  console.warn("teacher-hr request failed");
  console.warn("status:", status ?? "network");
  console.warn("code:", code || "UNKNOWN");
}

async function readFunctionError(error, data) {
  let status = error?.context?.status ?? data?.status ?? null;
  let code = data?.code || error?.name || null;
  let message = data?.error || null;
  let field = data?.field || null;
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = typeof ctx.clone === "function"
        ? await ctx.clone().json()
        : await ctx.json();
      code = body?.code || code;
      message = body?.error || message;
      field = body?.field || field;
      status = ctx.status || status;
    }
  } catch { /* ignore */ }
  if (!status && /Failed to send a request/i.test(error?.message || "")) {
    code = "NETWORK_OR_CORS";
  }
  if (!code && !status) code = "NETWORK_OR_CORS";
  return { status, code, message, field };
}

export class TeacherHrError extends Error {
  constructor(userMessage, { status, code, field } = {}) {
    super(userMessage);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export async function invokeTeacherHr(supabase, action, payload = {}) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      logHrFailure(action, 401, "INVALID_SESSION");
      throw new TeacherHrError(userMessageForAction(action), { status: 401, code: "INVALID_SESSION" });
    }

    const { data, error } = await supabase.functions.invoke("teacher-hr", {
      headers: { Authorization: `Bearer ${token}` },
      body: { action, ...payload },
    });

    if (error) {
      const parsed = await readFunctionError(error, data);
      logHrFailure(action, parsed.status, parsed.code);
      if (parsed.code === "VALIDATION_ERROR") {
        throw new TeacherHrError(parsed.message || userMessageForAction(action), parsed);
      }
      throw new TeacherHrError(userMessageForAction(action), parsed);
    }
    if (data?.error) {
      const code = data.code || "APPLICATION_ERROR";
      logHrFailure(action, 200, code);
      if (code === "VALIDATION_ERROR" && data.error && !looksSensitive(data.error)) {
        throw new TeacherHrError(data.error, { status: 400, code, field: data.field });
      }
      throw new TeacherHrError(userMessageForAction(action), { status: 200, code });
    }
    return data?.data ?? data;
  } catch (err) {
    if (err instanceof TeacherHrError) throw err;
    logHrFailure(action, null, err?.name || "UNKNOWN");
    throw new TeacherHrError(userMessageForAction(action), { code: err?.name || "UNKNOWN" });
  }
}

export async function sha256HexOfFile(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createContractPdfUrl(supabase, path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("teacher-contracts")
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data?.signedUrl || null;
}

export function signedContractPdfPath(row) {
  if (!row) return null;
  if (row.status === "서명완료") {
    return row.signed_pdf_path || row.signed_pdf_url || null;
  }
  return row.original_pdf_path || row.original_pdf_url || null;
}
