import assert from "node:assert/strict";
import test from "node:test";
import { unreturnedGearBlockMessage } from "./unreturnedGear.js";

test("반납이 끝나면 막을 문구가 없다", () => {
  assert.equal(unreturnedGearBlockMessage("양의인", []), "");
  assert.equal(unreturnedGearBlockMessage("양의인", null), "");
});

test("대여 중인 교구가 있으면 비활성화를 막는다", () => {
  const message = unreturnedGearBlockMessage("김선생", [
    { items: { name: "매트" }, quantity: 1 },
    { name: "공", quantity: 2 },
  ]);
  assert.match(message, /김선생 선생님은 반납되지 않은 교구가 2건/);
  assert.match(message, /· 매트 × 1/);
  assert.match(message, /· 공 × 2/);
  assert.match(message, /교구를 반납한 뒤에 비활성화할 수 있습니다/);
});

test("퇴직 처리에도 같은 반납 확인을 쓴다", () => {
  const message = unreturnedGearBlockMessage("김선생", [
    { items: { name: "후프" }, quantity: 1 },
  ], "퇴직 처리");
  assert.match(message, /퇴직 처리할 수 있습니다/);
});
