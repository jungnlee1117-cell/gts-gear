import assert from "node:assert/strict";
import test from "node:test";
import { isReturnPhotoRequired, isReturnPhotoRequiredFor } from "./returnPhoto.js";

const afterCutoff = new Date("2026-10-07T12:00:00+09:00");

test("2026-09-23 이후에는 반납 사진이 필수다", () => {
  assert.equal(isReturnPhotoRequired(afterCutoff), true);
});

test("대표만 사진 없이 반납할 수 있다", () => {
  assert.equal(isReturnPhotoRequiredFor({ role: "superadmin" }, afterCutoff), false);
  assert.equal(isReturnPhotoRequiredFor({ role: "admin" }, afterCutoff), true);
  assert.equal(isReturnPhotoRequiredFor({ role: "teacher" }, afterCutoff), true);
});
