import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConfirmedPayrollDayLines,
  buildScheduleCalendarDayLines,
} from "./payrollCalendar.js";

const hwang = "hwang";
const entries = [
  {
    id: "a",
    class_date: "2026-09-08",
    minutes: 30,
    pay_type: "방과후",
    entry_status: "custom",
    schedule_slot_id: "slot-1",
    institution_id: "francis",
    teacher_id: "seo",
    substitute_teacher_id: hwang,
    institutions: { id: "francis", name: "프랜시스파커" },
  },
  {
    id: "b",
    class_date: "2026-09-08",
    minutes: 45,
    pay_type: "방과후",
    entry_status: "custom",
    schedule_slot_id: "slot-2",
    institution_id: "francis",
    teacher_id: "seo",
    substitute_teacher_id: hwang,
    institutions: { id: "francis", name: "프랜시스파커" },
  },
];

describe("다른 선생님 슬롯 대체 수업", () => {
  it("급여 달력에 원 이름과 합계 분을 보여 준다", () => {
    const lines = buildConfirmedPayrollDayLines([], entries, "2026-09-08", hwang);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].label, "프랜시스파커 방과후 75분");
  });

  it("월간 달력에도 같은 원 이름을 보여 준다", () => {
    const lines = buildScheduleCalendarDayLines([], entries, {
      dateStr: "2026-09-08",
      teacherId: hwang,
    });
    assert.equal(lines[0].label, "프랜시스파커 방과후 75분");
  });

  it("원래 선생님 달력에는 그 대체 급여를 넣지 않는다", () => {
    const lines = buildConfirmedPayrollDayLines([], entries, "2026-09-08", "seo");
    assert.equal(lines.length, 0);
  });
});
