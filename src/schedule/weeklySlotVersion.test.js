import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  historyRowsForSlot,
  openTeacherSlots,
  payTypesAfterSlotTransfer,
  slotTeacherChangePlan,
} from "./weeklySlotVersion.js";

describe("slotTeacherChangePlan", () => {
  const today = "2026-10-02";

  it("이미 시작한 수업은 적용일이 시작일보다 뒤일 때 새 버전으로 남긴다", () => {
    const plan = slotTeacherChangePlan({
      effective_from: "2026-03-01",
      effective_to: null,
    }, "2026-09-01", today);
    assert.deepEqual(plan, { ok: true, mode: "version" });
  });

  it("적용일이 기존 시작일과 같거나 앞이면 거절한다", () => {
    const plan = slotTeacherChangePlan({
      effective_from: "2026-03-01",
      effective_to: null,
    }, "2026-03-01", today);
    assert.equal(plan.ok, false);
  });

  it("아직 시작 전인 예정 수업은 같은 행의 선생님만 고친다", () => {
    const plan = slotTeacherChangePlan({
      effective_from: "2026-10-10",
      effective_to: null,
    }, "2026-10-02", today);
    assert.deepEqual(plan, { ok: true, mode: "inplace" });
  });

  it("기존 종료일보다 늦은 적용일은 거절한다", () => {
    const plan = slotTeacherChangePlan({
      effective_from: "2026-03-01",
      effective_to: "2026-09-30",
    }, "2026-10-01", today);
    assert.equal(plan.ok, false);
  });
});

describe("openTeacherSlots", () => {
  it("그 선생님의 종료되지 않은 슬롯만 고른다", () => {
    const rows = openTeacherSlots([
      { id: "a", teacher_id: "oh", institution_id: "bek", effective_from: "2026-03-01", effective_to: null },
      { id: "b", teacher_id: "hwang", institution_id: "bek", effective_from: "2026-03-01", effective_to: null },
      { id: "c", teacher_id: "oh", institution_id: "bek", effective_from: "2026-03-01", effective_to: "2026-09-01" },
    ], { teacherId: "oh", institutionId: "bek", today: "2026-10-02" });
    assert.deepEqual(rows.map((row) => row.id), ["a"]);
  });
});

describe("historyRowsForSlot", () => {
  it("같은 시리즈를 적용일 최근 순으로 모은다", () => {
    const rows = historyRowsForSlot([
      { id: "old", schedule_series_id: "s1", effective_from: "2026-03-01" },
      { id: "other", schedule_series_id: "s2", effective_from: "2026-08-01" },
      { id: "new", schedule_series_id: "s1", effective_from: "2026-10-02" },
    ], { id: "new", schedule_series_id: "s1" });
    assert.deepEqual(rows.map((row) => row.id), ["new", "old"]);
  });
});

describe("payTypesAfterSlotTransfer", () => {
  it("남은 슬롯이 없으면 원래 선생님 명단을 내린다", () => {
    const next = payTypesAfterSlotTransfer({
      fromPayTypes: ["정규"],
      toPayTypes: ["방과후"],
      transferredTypes: ["정규"],
      remainingTypes: [],
      fromHasOpenSlots: false,
    });
    assert.equal(next.deactivateFrom, true);
    assert.deepEqual(next.toPayTypes, ["방과후", "정규"]);
  });

  it("다른 슬롯이 남으면 그 유형은 원래 선생님에게 둔다", () => {
    const next = payTypesAfterSlotTransfer({
      fromPayTypes: ["정규", "어린이집"],
      toPayTypes: [],
      transferredTypes: ["정규"],
      remainingTypes: ["어린이집"],
      fromHasOpenSlots: true,
    });
    assert.equal(next.deactivateFrom, false);
    assert.deepEqual(next.fromPayTypes, ["어린이집"]);
    assert.deepEqual(next.toPayTypes, ["정규"]);
  });
});
