/**
 * teacher-hr API 권한·검증 규칙.
 * Edge Function과 QA 테스트가 같은 구현을 사용한다.
 * 민감값(계좌, 주민번호, 서명)은 에러 메시지/로그에 넣지 않는다.
 */

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

export function maskResidentId(raw) {
  const d = digitsOnly(raw);
  if (d.length < 7) return "******-*******";
  return `${d.slice(0, 6)}-${d[6]}******`;
}

export function maskAccountNumber(raw) {
  const d = digitsOnly(raw);
  if (!d) return "";
  if (d.length <= 6) return `${d.slice(0, 1)}${"*".repeat(Math.max(0, d.length - 1))}`;
  return `${d.slice(0, 3)}${"*".repeat(d.length - 6)}${d.slice(-3)}`;
}

export function isHrSuperAdmin(caller, superAdminId = "") {
  if (!caller?.id) return false;
  return caller.role === "superadmin" || (!!superAdminId && caller.id === superAdminId);
}

/** 정산정보 get/upsert: 본인 또는 superadmin만 */
export function canAccessHr(caller, targetTeacherId, superAdminId = "") {
  if (!caller?.id || !targetTeacherId) return false;
  if (caller.id === targetTeacherId) return true;
  return isHrSuperAdmin(caller, superAdminId);
}

/**
 * 정산정보 전체보기(원문 복호화): teacher는 본인만, superadmin은 전원.
 * 일반 admin은 본인 포함 불가 — 마스킹 조회·수정만 가능.
 */
export function canRevealSettlement(caller, targetTeacherId, superAdminId = "") {
  if (!caller?.id || !targetTeacherId) return false;
  if (isHrSuperAdmin(caller, superAdminId)) return true;
  if (caller.role === "admin") return false;
  return caller.id === targetTeacherId;
}

export const SETTLEMENT_REVEAL_FIELDS = ["account_number", "resident_id"];
export const SETTLEMENT_REVEAL_TTL_MS = 3 * 60 * 1000;

export function formatRevealedAccount(raw) {
  return digitsOnly(raw);
}

export function formatRevealedResidentId(raw) {
  const d = digitsOnly(raw);
  if (d.length === 13) return `${d.slice(0, 6)}-${d.slice(6)}`;
  return d;
}

/** 복호화 성공 필드만 반환. 암호문·원문은 audit 객체에 넣지 않는다. */
export function buildSettlementRevealResult(accountPlain, residentPlain) {
  const fields = [];
  const account_number = accountPlain ? formatRevealedAccount(accountPlain) : "";
  const resident_id = residentPlain ? formatRevealedResidentId(residentPlain) : "";
  if (account_number) fields.push("account_number");
  if (resident_id) fields.push("resident_id");
  return { account_number, resident_id, revealed_fields: fields };
}

export function settlementRevealAuditRow(viewerId, teacherId, fields) {
  const allowed = new Set(SETTLEMENT_REVEAL_FIELDS);
  return {
    viewer_id: viewerId,
    teacher_id: teacherId,
    fields: (Array.isArray(fields) ? fields : []).filter((name) => allowed.has(name)),
  };
}

/** 선생님 목록용 정산/계약 상태 배지: admin·superadmin. 암호문/원문은 포함하지 않음. */
export function canListHrStatus(caller, superAdminId = "") {
  if (!caller?.id) return false;
  if (isHrSuperAdmin(caller, superAdminId)) return true;
  return caller.role === "admin";
}

export function requireEncryptionKey(secret) {
  if (!String(secret || "").trim()) {
    throw fieldError(null, "정산정보 암호화 키가 설정되지 않아 저장할 수 없습니다.", "ENCRYPTION_KEY_MISSING");
  }
}

function isValidRrnDate(digits) {
  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  const g = Number(digits[6]);
  let century = 1900;
  if (g === 3 || g === 4 || g === 7 || g === 8) century = 2000;
  else if (g === 9 || g === 0) century = 1800;
  else if (!(g === 1 || g === 2 || g === 5 || g === 6)) return false;
  const year = century + yy;
  const dt = new Date(Date.UTC(year, mm - 1, dd));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === mm - 1 && dt.getUTCDate() === dd;
}

function isValidRrnChecksum(digits) {
  const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(digits[i]) * weights[i];
  const check = (11 - (sum % 11)) % 10;
  return check === Number(digits[12]);
}

export function fieldError(field, message, code = "VALIDATION_ERROR") {
  const err = new Error(message);
  err.code = code;
  err.field = field || undefined;
  return err;
}

export function validateAccountNumber(raw) {
  const d = digitsOnly(raw);
  if (!d) throw new Error("계좌번호를 입력해 주세요.");
  if (d.length < 8 || d.length > 16) {
    throw new Error("계좌번호는 8~16자리 숫자여야 합니다.");
  }
  if (/^0+$/.test(d)) throw new Error("계좌번호가 올바르지 않습니다.");
  return d;
}

export function validateResidentId(raw) {
  const d = digitsOnly(raw);
  if (d.length !== 13) throw new Error("주민등록번호는 숫자 13자리로 입력해 주세요.");
  if (!isValidRrnDate(d)) throw new Error("주민등록번호 앞자리가 올바른 날짜가 아닙니다.");
  if (!isValidRrnChecksum(d)) throw new Error("주민등록번호 형식이 올바르지 않습니다.");
  return d;
}

export function validateSettlementInput(existing, input = {}) {
  const bankName = String(input.bankName || "").trim();
  const accountHolder = String(input.accountHolder || "").trim();
  if (!bankName) throw fieldError("bank_name", "은행명을 입력해 주세요.");
  if (!accountHolder) throw fieldError("account_holder", "예금주를 입력해 주세요.");

  const accountRaw = String(input.accountNumber || "").trim();
  const residentRaw = String(input.residentId || "").trim();
  if (!existing && !accountRaw) throw fieldError("account_number", "계좌번호를 입력해 주세요.");

  let accountDigits = null;
  let residentDigits = null;
  try {
    accountDigits = accountRaw ? validateAccountNumber(accountRaw) : null;
  } catch (err) {
    throw fieldError("account_number", err.message);
  }
  try {
    residentDigits = residentRaw ? validateResidentId(residentRaw) : null;
  } catch (err) {
    throw fieldError("resident_id", err.message);
  }

  return {
    bankName,
    accountHolder,
    accountDigits,
    residentDigits,
  };
}

export function publicSettlementPayload(row, teacherId) {
  return {
    teacher_id: teacherId || row?.teacher_id || "",
    bank_name: row?.bank_name || "",
    account_holder: row?.account_holder || "",
    account_number_mask: row?.account_number_mask || "",
    resident_id_mask: row?.resident_id_mask || "",
    has_account_number: Boolean(row?.account_number_ciphertext || row?.account_number_mask),
    has_resident_id: Boolean(row?.resident_id_ciphertext || row?.resident_id_mask),
    updated_at: row?.updated_at || null,
  };
}

export function isSettlementComplete(row) {
  if (!row) return false;
  return Boolean(
    String(row.bank_name || "").trim()
    && String(row.account_holder || "").trim()
    && (row.has_account_number || row.account_number_mask || row.account_number_ciphertext)
    && (row.has_resident_id || row.resident_id_mask || row.resident_id_ciphertext),
  );
}

export function summarizeContractStatus(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return "미등록";
  if (list.some((r) => r.status === "서명대기")) return "서명대기";
  if (list.some((r) => r.status === "서명완료")) return "서명완료";
  return "미등록";
}

export function buildHrStatusMap(settlementRows = [], contractRows = []) {
  const map = {};
  for (const row of settlementRows) {
    if (!row?.teacher_id) continue;
    map[row.teacher_id] = {
      settlement: isSettlementComplete(row) ? "완료" : "미등록",
      contract: "미등록",
    };
  }
  const byTeacher = new Map();
  for (const row of contractRows) {
    if (!row?.teacher_id) continue;
    if (!byTeacher.has(row.teacher_id)) byTeacher.set(row.teacher_id, []);
    byTeacher.get(row.teacher_id).push(row);
  }
  for (const [teacherId, rows] of byTeacher) {
    if (!map[teacherId]) map[teacherId] = { settlement: "미등록", contract: "미등록" };
    map[teacherId].contract = summarizeContractStatus(rows);
  }
  return map;
}

export function isSignedContractLocked(row) {
  return row?.status === "서명완료";
}

export function assertContractMutable(row, op = "update") {
  if (!isSignedContractLocked(row)) return;
  if (op === "delete") {
    throw new Error("서명 완료된 계약서는 삭제할 수 없습니다. 변경이 필요하면 새 계약서를 등록하세요.");
  }
  throw new Error("서명 완료된 계약서는 수정할 수 없습니다. 변경이 필요하면 새 계약서를 등록하세요.");
}

export function requireSignAgreement(agreed) {
  if (agreed !== true) {
    throw new Error("계약내용을 확인하고 전자서명에 동의한 뒤 서명할 수 있습니다.");
  }
}

const SENSITIVE_KEY = /account_number|resident_id|signature|ciphertext|ssn|rrn|password|secret/i;

export function sanitizeLogValue(value, key = "") {
  if (value == null) return value;
  if (SENSITIVE_KEY.test(String(key))) return "[redacted]";
  if (typeof value === "string") {
    return value
      .replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g, "[redacted-signature]")
      .replace(/\d{6}-?\d{7}/g, "[redacted-rrn]")
      .replace(/\b\d{8,16}\b/g, "[redacted-num]");
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeLogValue(item));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeLogValue(v, k);
    return out;
  }
  return value;
}

export function safeErrorMessage(err) {
  const message = String(err?.message || "Internal error");
  return sanitizeLogValue(message);
}
