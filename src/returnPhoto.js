/**
 * 반납 사진·위치 헬퍼
 *
 * 2026-09-23 (한국 시간) 전 → 사진 권장(건너뛰기 가능)
 * 2026-09-23 (한국 시간)부터 → 사진 필수
 * 대표(role superadmin)는 날짜와 관계없이 사진 없이 반납할 수 있다.
 */

export const RETURN_PHOTO_REQUIRED_FROM = "2026-09-23";
export const RETURN_PHOTO_REQUIRED_MESSAGE = "반납 사진을 업로드해야 반납이 완료됩니다";
export const RETURN_ALBUM_PHOTO_HINT =
  "사진첩에서 고르실 때는, 지금 반납하는 교구 사진이 맞는지 한 번만 확인해 주세요. 다른 사진이 올라가면 재고가 어긋나서, 다음에 그 교구를 쓰시는 선생님이 찾기 어려울 수 있어요.";

export const RETURN_PHOTO_BUCKET = "item-photos";
export const RETURN_PHOTO_MAX_WIDTH = 1280;
export const RETURN_PHOTO_JPEG_QUALITY = 0.72;

export function kstDateYmd(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isReturnPhotoRequired(date = new Date()) {
  return kstDateYmd(date) >= RETURN_PHOTO_REQUIRED_FROM;
}

export function isReturnPhotoRequiredFor(user, date = new Date()) {
  if (user?.role === "superadmin") return false;
  return isReturnPhotoRequired(date);
}

export function returnPhotoStoragePath(itemId, stamp = Date.now()) {
  return `returns/${itemId}/${stamp}.jpg`;
}

/** 목록 칸(56px)의 2배. 레티나에서도 깨지지 않는 썸네일 한 변. */
export const RETURN_PHOTO_THUMB_PX = 112;

/**
 * 공개 item-photos 원본 주소를 목록용 변환 주소로 바꾼다.
 * 변환을 쓸 수 없는 주소는 원본을 그대로 돌려준다.
 */
export function returnPhotoThumbUrl(url, size = RETURN_PHOTO_THUMB_PX) {
  const text = String(url || "").trim();
  if (!text) return "";
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return text;
  }
  const marker = "/storage/v1/object/public/";
  const at = parsed.pathname.indexOf(marker);
  if (at < 0) return text;
  const objectPath = decodeURIComponent(parsed.pathname.slice(at + marker.length));
  if (!objectPath.startsWith(`${RETURN_PHOTO_BUCKET}/`)) return text;
  const render = new URL(`${parsed.origin}/storage/v1/render/image/public/${objectPath}`);
  render.searchParams.set("width", String(size));
  render.searchParams.set("height", String(size));
  render.searchParams.set("resize", "cover");
  render.searchParams.set("quality", "60");
  return render.toString();
}

/** return_photo_url 한 칸에 들어 있는 사진을 모두 꺼낸다. 없으면 빈 배열. */
export function listReturnPhotoUrls(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item || "").trim()).filter(Boolean);
  }
  const text = String(value ?? "").trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return listReturnPhotoUrls(parsed);
    } catch {
      /* 단일 URL로 취급 */
    }
  }
  return [text];
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
 * 반납 건마다 새 경로에 업로드한다. 이전 반납 파일은 지우지 않는다.
 * @returns {Promise<string>} public URL (cache-bust query 포함)
 */
export async function uploadReturnPhoto(client, itemId, blob) {
  const path = returnPhotoStoragePath(itemId);
  const { error } = await client.storage
    .from(RETURN_PHOTO_BUCKET)
    .upload(path, blob, { upsert: false, contentType: "image/jpeg", cacheControl: "3600" });
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
  const photoRequired = opts.photoRequired ?? isReturnPhotoRequired();
  if (!locationGroups?.length) return "반납할 항목이 없습니다";
  for (const g of locationGroups) {
    if (!String(g.location || "").trim()) {
      return "반납 위치를 모두 선택해 주세요";
    }
    if (photoRequired && !g.photoFile && !g.skippedPhoto) {
      return RETURN_PHOTO_REQUIRED_MESSAGE;
    }
    if (photoRequired && g.skippedPhoto && !g.photoFile) {
      return RETURN_PHOTO_REQUIRED_MESSAGE;
    }
  }
  return null;
}
