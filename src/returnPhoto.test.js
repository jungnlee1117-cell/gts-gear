import assert from "node:assert/strict";
import test from "node:test";
import { isReturnPhotoRequired, isReturnPhotoRequiredFor, listReturnPhotoUrls, returnPhotoStoragePath, returnPhotoThumbUrl } from "./returnPhoto.js";

const afterCutoff = new Date("2026-10-07T12:00:00+09:00");

test("2026-09-23 이후에는 반납 사진이 필수다", () => {
  assert.equal(isReturnPhotoRequired(afterCutoff), true);
});

test("반납 사진은 건마다 다른 경로에 두고, 없는 값은 빈 목록이다", () => {
  const itemId = "item-1";
  assert.notEqual(returnPhotoStoragePath(itemId, 1), returnPhotoStoragePath(itemId, 2));
  assert.equal(returnPhotoStoragePath(itemId, 1).startsWith("returns/item-1/"), true);
  assert.deepEqual(listReturnPhotoUrls(null), []);
  assert.deepEqual(listReturnPhotoUrls(""), []);
  assert.deepEqual(listReturnPhotoUrls(" https://example.com/a.jpg "), ["https://example.com/a.jpg"]);
  assert.deepEqual(listReturnPhotoUrls([" https://example.com/a.jpg ", "", "https://example.com/b.jpg"]), [
    "https://example.com/a.jpg",
    "https://example.com/b.jpg",
  ]);
});

test("목록 썸네일은 작은 변환 주소이고, 그 외에는 원본이다", () => {
  const original = "https://ivphpmjaddrubshchxck.supabase.co/storage/v1/object/public/item-photos/returns/abc/1.jpg?t=9";
  const thumb = new URL(returnPhotoThumbUrl(original));
  assert.equal(thumb.pathname, "/storage/v1/render/image/public/item-photos/returns/abc/1.jpg");
  assert.equal(thumb.searchParams.get("width"), "112");
  assert.equal(thumb.searchParams.get("height"), "112");
  assert.equal(thumb.searchParams.get("resize"), "cover");
  assert.equal(thumb.searchParams.get("quality"), "60");
  assert.equal(thumb.searchParams.has("t"), false);
  assert.equal(returnPhotoThumbUrl("https://example.com/a.jpg"), "https://example.com/a.jpg");
  assert.equal(returnPhotoThumbUrl(""), "");
});

test("대표만 사진 없이 반납할 수 있다", () => {
  assert.equal(isReturnPhotoRequiredFor({ role: "superadmin" }, afterCutoff), false);
  assert.equal(isReturnPhotoRequiredFor({ role: "admin" }, afterCutoff), true);
  assert.equal(isReturnPhotoRequiredFor({ role: "teacher" }, afterCutoff), true);
});
