/**
 * 반납 사진·위치 헬퍼
 *
 * RETURN_PHOTO_REQUIRED
 *   false → 사진 권장(건너뛰기 가능), 위치는 항상 필수
 *   true  → 사진도 필수 (그룹/개별 모두)
 */

/** @type {boolean} 나중에 true로 바꾸면 반납 사진 필수 */
export const RETURN_PHOTO_REQUIRED = false;

export const RETURN_PHOTO_BUCKET = "item-photos";
export const RETURN_PHOTO_MAX_WIDTH = 1280;
export const RETURN_PHOTO_JPEG_QUALITY = 0.72;

export function returnPhotoStoragePath(itemId) {
  return `returns/${itemId}.jpg`;
}

/**
 * 이미지 파일을 canvas로 리사이즈·JPEG 압축 (목표 ~100–300KB)
 * @param {File|Blob} file
 * @returns {Promise<Blob>}
 */
export async function compressReturnPhoto(file) {
  if (!file) throw new Error("파일이 없습니다");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, RETURN_PHOTO_MAX_WIDTH / Math.max(bitmap.width, 1));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("이미지 압축을 지원하지 않는 환경입니다");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("JPEG 변환 실패"))),
      "image/jpeg",
      RETURN_PHOTO_JPEG_QUALITY,
    );
  });
  return blob;
}

/**
 * 교구별 고정 경로에 업로드 (이전 파일 삭제 후 덮어쓰기)
 * @returns {Promise<string>} public URL (cache-bust query 포함)
 */
export async function uploadReturnPhoto(client, itemId, blob) {
  const path = returnPhotoStoragePath(itemId);
  await client.storage.from(RETURN_PHOTO_BUCKET).remove([path]);
  const { error } = await client.storage
    .from(RETURN_PHOTO_BUCKET)
    .upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "60" });
  if (error) throw new Error(error.message);
  const { data } = client.storage.from(RETURN_PHOTO_BUCKET).getPublicUrl(path);
  const base = data?.publicUrl;
  if (!base) throw new Error("사진 URL을 만들지 못했습니다");
  return `${base}?t=${Date.now()}`;
}

/**
 * 위치 그룹별 사진 검증
 * @param {{ location: string, photoFile?: File|null, skippedPhoto?: boolean }[]} locationGroups
 * @param {{ photoRequired?: boolean }} [opts]
 * @returns {string|null} 오류 메시지 또는 null
 */
export function validateReturnLocationGroups(locationGroups, opts = {}) {
  const photoRequired = opts.photoRequired ?? RETURN_PHOTO_REQUIRED;
  if (!locationGroups?.length) return "반납할 항목이 없습니다";
  for (const g of locationGroups) {
    if (!String(g.location || "").trim()) {
      return "반납 위치를 모두 선택해 주세요";
    }
    if (photoRequired && !g.photoFile && !g.skippedPhoto) {
      return `"${g.location}" 위치 그룹의 사진을 촬영하거나 업로드해 주세요`;
    }
    if (photoRequired && g.skippedPhoto && !g.photoFile) {
      return "사진이 필수입니다. 건너뛰기를 사용할 수 없습니다";
    }
  }
  return null;
}
