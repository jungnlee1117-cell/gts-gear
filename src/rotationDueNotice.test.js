import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { earliestRotationConflictByItem } from "./rotationDueNotice.js";

describe("earliestRotationConflictByItem", () => {
  const hoop = (weekStart, teacherName = "김순환") => ({
    itemId: "item-hoop",
    itemName: "후프",
    teacherName,
    weekStart,
    weekEnd: "2026-09-06",
  });

  it("오늘 이전에 시작된 순환 주차는 반납 기한 안내에서 제외한다", () => {
    const conflicts = [
      hoop("2026-08-24", "지난주"),
      hoop("2026-08-31", "이번주"),
      hoop("2026-09-07", "다음주"),
    ];
    const picked = earliestRotationConflictByItem(conflicts, { afterYmd: "2026-08-31" });
    assert.equal(picked.length, 1);
    assert.equal(picked[0].weekStart, "2026-09-07");
    assert.equal(picked[0].teacherName, "다음주");
  });

  it("오늘 시작하는 주차도 제외한다 (시작 전날=어제)", () => {
    const picked = earliestRotationConflictByItem(
      [hoop("2026-08-31")],
      { afterYmd: "2026-08-31" },
    );
    assert.deepEqual(picked, []);
  });

  it("교구가 여러 개면 각각 가장 빠른 미래 주차만 남긴다", () => {
    const conflicts = [
      { itemId: "a", itemName: "후프", teacherName: "A", weekStart: "2026-08-24" },
      { itemId: "a", itemName: "후프", teacherName: "B", weekStart: "2026-09-07" },
      { itemId: "b", itemName: "콘", teacherName: "C", weekStart: "2026-09-14" },
    ];
    const picked = earliestRotationConflictByItem(conflicts, { afterYmd: "2026-08-31" });
    assert.equal(picked.length, 2);
    const hoopPick = picked.find((c) => c.itemId === "a");
    const conePick = picked.find((c) => c.itemId === "b");
    assert.equal(hoopPick.weekStart, "2026-09-07");
    assert.equal(conePick.weekStart, "2026-09-14");
  });
});
