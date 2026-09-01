import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dateRangesOverlap,
  findOverlappingInstitutionSlots,
  formatInstitutionOverlapWarning,
} from "./weeklySlotOverlap.js";

describe("dateRangesOverlap", () => {
  it("종료일이 없는 기존 수업과 새 수업은 겹친다", () => {
    assert.equal(dateRangesOverlap("2026-08-01", "2026-09-30", "2026-03-01", null), true);
  });

  it("끝난 수업과는 겹치지 않는다", () => {
    assert.equal(dateRangesOverlap("2026-08-31", null, "2026-03-01", "2026-08-30"), false);
  });
});

describe("findOverlappingInstitutionSlots", () => {
  const existing = {
    id: "slot-a",
    institution_id: "inst-1",
    teacher_id: "t-kim",
    day_of_week: 1,
    start_time: "10:00:00",
    end_time: "10:30:00",
    effective_from: "2026-03-01",
    effective_to: null,
  };

  it("같은 요일·같은 기관·시간 겹침을 찾는다", () => {
    const hits = findOverlappingInstitutionSlots({
      slots: [existing],
      institutionId: "inst-1",
      dayOfWeek: 1,
      startTime: "10:15",
      endTime: "10:45",
      effectiveFrom: "2026-08-31",
      effectiveTo: null,
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].id, "slot-a");
  });

  it("다른 기관이면 겹치지 않는다", () => {
    const hits = findOverlappingInstitutionSlots({
      slots: [existing],
      institutionId: "inst-2",
      dayOfWeek: 1,
      startTime: "10:00",
      endTime: "10:30",
      effectiveFrom: "2026-08-31",
    });
    assert.equal(hits.length, 0);
  });

  it("자기 자신은 제외한다", () => {
    const hits = findOverlappingInstitutionSlots({
      slots: [existing],
      institutionId: "inst-1",
      dayOfWeek: 1,
      startTime: "10:00",
      endTime: "10:30",
      effectiveFrom: "2026-08-31",
      excludeSlotIds: ["slot-a"],
    });
    assert.equal(hits.length, 0);
  });
});

describe("formatInstitutionOverlapWarning", () => {
  it("요청한 경고 문구 형식이다", () => {
    const msg = formatInstitutionOverlapWarning(
      { teacher_id: "t-kim", start_time: "10:00:00", end_time: "10:30:00" },
      new Map([["t-kim", "김순환"]]),
    );
    assert.equal(msg, "이미 이 시간에 등록된 수업이 있어요 (김순환 선생님 10:00~10:30)");
  });
});
