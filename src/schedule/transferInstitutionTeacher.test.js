import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classTypesHeldByTeacher,
  matchingSlotsForTransfer,
} from "./transferTeacherScope.js";

const slots = [
  { teacher_id: "oh", class_type: "정규", effective_to: null },
  { teacher_id: "hwang", class_type: "정규", effective_to: null },
  { teacher_id: "oh", class_type: "방과후", effective_to: "2026-09-01" },
  { teacher_id: "oh", class_type: "센터", effective_to: null },
];

describe("matchingSlotsForTransfer", () => {
  it("지정한 선생님의 해당 유형 슬롯만 고른다", () => {
    const matched = matchingSlotsForTransfer(slots, {
      classType: "정규",
      fromTeacherId: "oh",
      toTeacherId: "new",
      transferDate: "2026-10-02",
    });
    assert.deepEqual(matched.map((slot) => slot.teacher_id), ["oh"]);
  });

  it("이미 끝난 슬롯과 받을 선생님 자신의 슬롯은 제외한다", () => {
    const matched = matchingSlotsForTransfer(slots, {
      classType: "방과후",
      fromTeacherId: "oh",
      toTeacherId: "oh",
      transferDate: "2026-10-02",
    });
    assert.equal(matched.length, 0);
  });
});

describe("classTypesHeldByTeacher", () => {
  it("배정 유형과 아직 유효한 시간표 유형만 모은다", () => {
    const types = classTypesHeldByTeacher(
      { teacher_id: "oh", pay_types: ["정규", "어린이집"] },
      slots,
      "2026-10-02",
    );
    assert.deepEqual(types, ["정규", "어린이집", "센터"]);
  });
});
