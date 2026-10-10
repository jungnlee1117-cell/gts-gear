import assert from "node:assert/strict";
import test from "node:test";
import { isUnresolvedEnglishEquipmentName, storedEnglishEquipmentName } from "./lessonPlan.js";

test("DB에 있는 영문명만 교구명으로 남긴다", () => {
  assert.equal(storedEnglishEquipmentName("Balance stepping stone"), "Balance stepping stone");
  assert.equal(storedEnglishEquipmentName("Egg"), "Egg");
  assert.equal(storedEnglishEquipmentName("스쿠프"), "");
  assert.equal(storedEnglishEquipmentName(""), "");
});

test("대체 이름은 없는 영문명으로 본다", () => {
  assert.equal(storedEnglishEquipmentName("GTS Activity Set"), "");
  assert.equal(storedEnglishEquipmentName("Selected Equipment"), "");
  assert.equal(isUnresolvedEnglishEquipmentName("GTS Activity Set"), true);
  assert.equal(isUnresolvedEnglishEquipmentName("Selected Equipment"), true);
  assert.equal(isUnresolvedEnglishEquipmentName(""), true);
  assert.equal(isUnresolvedEnglishEquipmentName("Balance stepping stone"), false);
});
