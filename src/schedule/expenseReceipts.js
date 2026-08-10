import { scheduleSupabase } from "./api.js";

export const EXPENSE_RECEIPT_BUCKET = "expense-receipts";
export const EXPENSE_RECEIPT_MAX_WIDTH = 1600;
export const EXPENSE_RECEIPT_JPEG_QUALITY = 0.78;

export const EXPENSE_TYPES = [
  "식비",
  "자격증",
  "교통비",
  "교육·연수비",
  "소모품 구입",
  "기타",
];

export function isExpenseType(type) {
  return EXPENSE_TYPES.includes(type);
}

/**
 * @param {File|Blob} file
 * @returns {Promise<Blob>}
 */
export async function compressExpenseReceipt(file) {
  if (!file) throw new Error("파일이 없습니다");
  if (typeof createImageBitmap !== "function") {
    return file;
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, EXPENSE_RECEIPT_MAX_WIDTH / Math.max(bitmap.width, 1));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))),
      "image/jpeg",
      EXPENSE_RECEIPT_JPEG_QUALITY,
    );
  });
  return blob;
}

/**
 * @param {string} teacherId 비용 대상 선생님
 * @param {File} file
 * @returns {Promise<string>} public URL
 */
export async function uploadExpenseReceipt(teacherId, file) {
  if (!teacherId) throw new Error("선생님 정보가 없습니다");
  if (!file) throw new Error("영수증 파일이 없습니다");

  const { data: authData, error: authErr } = await scheduleSupabase.auth.getUser();
  if (authErr) throw new Error(authErr.message || "로그인 확인 실패");
  const uploaderId = authData?.user?.id;
  if (!uploaderId) throw new Error("로그인이 필요합니다. 다시 로그인한 뒤 시도해주세요.");

  const blob = await compressExpenseReceipt(file);
  // 1단계 폴더 = 업로더(auth.uid) — RLS 통과 / 2단계 = 대상 선생님
  const path = `${uploaderId}/${teacherId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await scheduleSupabase.storage
    .from(EXPENSE_RECEIPT_BUCKET)
    .upload(path, blob, {
      upsert: false,
      contentType: "image/jpeg",
      cacheControl: "3600",
    });
  if (error) throw new Error(error.message || "영수증 업로드 실패");
  const { data } = scheduleSupabase.storage
    .from(EXPENSE_RECEIPT_BUCKET)
    .getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("영수증 URL을 만들지 못했습니다");
  return data.publicUrl;
}

export function formatExpensePaymentReason(expenseType, detail) {
  const type = String(expenseType || "").trim() || "비용";
  const d = String(detail || "").trim();
  return d ? `[${type}] ${d}` : `[${type}]`;
}
