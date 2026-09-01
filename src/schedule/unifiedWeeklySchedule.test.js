import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildUnifiedWeeklyItems } from "./unifiedWeeklySchedule.js";

describe("buildUnifiedWeeklyItems", () => {
  const slot = (id, overrides = {}) => ({
    id,
    institution_id: "inst-1",
    teacher_id: "t1",
    day_of_week: 1,
    start_time: "10:00:00",
    end_time: "10:30:00",
    class_type: "정규",
    institutions: { id: "inst-1", name: "테스트원" },
    ...overrides,
  });

  it("만료된 기관 수업은 주간 시간표에서 제외한다", () => {
    const items = buildUnifiedWeeklyItems(
      [
        slot("ended", { effective_from: "2026-03-01", effective_to: "2026-08-30" }),
        slot("current", { effective_from: "2026-03-01", effective_to: null }),
        slot("upcoming", { effective_from: "2026-09-07", effective_to: null }),
      ],
      [],
      {},
      { asOfYmd: "2026-08-31" },
    );
    assert.deepEqual(items.map((i) => i.raw.id), ["current"]);
  });
});
