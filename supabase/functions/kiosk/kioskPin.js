/**
 * 키오스크 PIN 해시·검증 (Edge Function + 클라이언트 테스트 공유)
 * 원문 PIN은 저장/로그에 넣지 않는다.
 */

export function normalizePin(raw) {
  return String(raw || "").replace(/\D/g, "").slice(0, 4);
}

export function isValidPin(raw) {
  return /^\d{4}$/.test(normalizePin(raw));
}

export function assertValidPin(raw, field = "pin") {
  const pin = normalizePin(raw);
  if (!/^\d{4}$/.test(pin)) {
    const err = new Error("PIN은 숫자 4자리여야 합니다.");
    err.code = "VALIDATION_ERROR";
    err.field = field;
    throw err;
  }
  return pin;
}

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** HMAC-SHA256(secret, `${teacherId}:${pin}`) → hex */
export async function hashKioskPin(teacherId, pin, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret || "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const payload = `${teacherId}:${normalizePin(pin)}`;
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToHex(new Uint8Array(sig));
}

export async function verifyKioskPin(teacherId, pin, storedHash, secret) {
  if (!storedHash || !secret) return false;
  const candidate = await hashKioskPin(teacherId, pin, secret);
  if (candidate.length !== String(storedHash).length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i += 1) {
    diff |= candidate.charCodeAt(i) ^ String(storedHash).charCodeAt(i);
  }
  return diff === 0;
}

export function timingSafeEqual(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
